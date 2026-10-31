package com.viviani.sistemademandas;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class AlarmService extends Service {
    private static final String CHANNEL_ID = "demandas_channel";
    private static final String ALERTAS_URL =
            "https://sistema-demandas-production.up.railway.app/demandas/vencendo-amanha";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private MediaPlayer mediaPlayer;
    private Vibrator vibrator;
    private Call consulta;
    private boolean encerrado;

    @Override
    public void onCreate() {
        super.onCreate();
        criarCanal();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Sistema de Demandas")
                .setContentText("Verificando suas demandas...")
                .setOngoing(true)
                .build();

        startForeground(1, notification);
        verificarDemandas();
        return START_NOT_STICKY;
    }

    private void verificarDemandas() {
        if (consulta != null) {
            consulta.cancel();
        }

        final String token = SessaoStore.obter(this);
        if (token == null) {
            AlarmScheduler.cancel(this);
            stopSelf();
            return;
        }

        OkHttpClient client = new OkHttpClient.Builder()
                .followRedirects(false)
                .callTimeout(30, TimeUnit.SECONDS)
                .build();
        Request request = new Request.Builder()
                .url(ALERTAS_URL)
                .header("Authorization", "Bearer " + token)
                .header("Accept", "application/json")
                .build();

        consulta = client.newCall(request);
        consulta.enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException erro) {
                mainHandler.post(() -> {
                    if (!encerrado && consulta == call) {
                        stopSelf();
                    }
                });
            }

            @Override
            public void onResponse(Call call, Response response) {
                int status;
                boolean temDemandas = false;

                try (Response resposta = response) {
                    status = resposta.code();
                    if (resposta.isSuccessful() && resposta.body() != null) {
                        temDemandas = new JSONArray(resposta.body().string()).length() > 0;
                    }
                } catch (Exception erro) {
                    mainHandler.post(() -> {
                        if (!encerrado && consulta == call) {
                            stopSelf();
                        }
                    });
                    return;
                }

                final boolean possuiDemandas = temDemandas;
                final int codigo = status;
                mainHandler.post(() -> {
                    if (encerrado || consulta != call) {
                        return;
                    }

                    // Uma resposta anterior ao logout ou à troca de conta nunca gera alarme.
                    if (!SessaoStore.corresponde(AlarmService.this, token)) {
                        stopSelf();
                        return;
                    }

                    if (codigo == 401) {
                        if (SessaoStore.limparSeCorresponde(AlarmService.this, token)) {
                            AlarmScheduler.cancel(AlarmService.this);
                        }
                        stopSelf();
                        return;
                    }

                    if (codigo >= 200 && codigo < 300 && possuiDemandas) {
                        tocarAlarme();
                        mostrarNotificacao();
                    } else {
                        stopSelf();
                    }
                });
            }
        });
    }

    private void tocarAlarme() {
        if (mediaPlayer == null) {
            mediaPlayer = MediaPlayer.create(this, R.raw.alarme);
            if (mediaPlayer != null) {
                mediaPlayer.setLooping(true);
            }
        }

        if (mediaPlayer != null && !mediaPlayer.isPlaying()) {
            mediaPlayer.start();
        }

        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 1000, 600}, 0));
            } else {
                vibrator.vibrate(new long[]{0, 1000, 600}, 0);
            }
        }
    }

    private void mostrarNotificacao() {
        PendingIntent abrir = PendingIntent.getBroadcast(
                this, 1, new Intent(this, OpenAppReceiver.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent parar = PendingIntent.getBroadcast(
                this, 2, new Intent(this, StopAlarmReceiver.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("Demanda vencendo amanhã")
                .setContentText("Você tem uma demanda para verificar.")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setOngoing(true)
                .addAction(android.R.drawable.ic_menu_view, "Abrir Sistema", abrir)
                .addAction(android.R.drawable.ic_media_pause, "Parar Alarme", parar)
                .build();

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(2, notification);
        }
    }

    private void criarCanal() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Sistema de Demandas", NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        encerrado = true;
        if (consulta != null) {
            consulta.cancel();
        }
        mainHandler.removeCallbacksAndMessages(null);
        if (mediaPlayer != null) {
            if (mediaPlayer.isPlaying()) {
                mediaPlayer.stop();
            }
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (vibrator != null) {
            vibrator.cancel();
        }

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.cancel(2);
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
