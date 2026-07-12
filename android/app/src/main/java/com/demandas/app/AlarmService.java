package com.demandas.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;

import java.io.IOException;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class AlarmService extends Service {

    private static final String CHANNEL_ID = "demandas_channel";

    private MediaPlayer mediaPlayer;

    private Vibrator vibrator;

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

                .setContentText("Verificando demandas...")

                .setOngoing(true)

                .build();

        startForeground(1, notification);

        verificarDemandas();

        return START_NOT_STICKY;

    }

    private void verificarDemandas() {

        OkHttpClient client = new OkHttpClient();

        Request request = new Request.Builder()

                .url("https://sistema-demandas-aw2w.onrender.com/demandas/vencendo-amanha")

                .build();

        client.newCall(request).enqueue(new Callback() {

            @Override
            public void onFailure(Call call, IOException e) {

                stopSelf();

            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {

                if (!response.isSuccessful()) {

                    stopSelf();

                    return;

                }

                String json = response.body().string();

                try {

                    JSONArray demandas = new JSONArray(json);

                    if (demandas.length() > 0) {

                        tocarAlarme();

                        mostrarNotificacao();

                    } else {

                        stopSelf();

                    }

                } catch (Exception e) {

                    stopSelf();

                }

            }

        });

    }

    private void tocarAlarme() {

        if (mediaPlayer == null) {

            mediaPlayer = MediaPlayer.create(this, R.raw.alarme);

            mediaPlayer.setLooping(true);

        }

        if (!mediaPlayer.isPlaying()) {

            mediaPlayer.start();

        }

        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);

        if (vibrator != null) {

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

                vibrator.vibrate(

                        VibrationEffect.createWaveform(

                                new long[]{
                                        0,
                                        1000,
                                        600
                                },

                                0

                        )

                );

            } else {

                vibrator.vibrate(

                        new long[]{
                                0,
                                1000,
                                600
                        },

                        0

                );

            }

        }

    }

    private void mostrarNotificacao() {

        Intent abrirIntent =
                new Intent(this, OpenAppReceiver.class);

        PendingIntent abrirPendingIntent =
                PendingIntent.getBroadcast(

                        this,

                        1,

                        abrirIntent,

                        PendingIntent.FLAG_UPDATE_CURRENT |
                        PendingIntent.FLAG_IMMUTABLE

                );

        Intent pararIntent =
                new Intent(this, StopAlarmReceiver.class);

        PendingIntent pararPendingIntent =
                PendingIntent.getBroadcast(

                        this,

                        2,

                        pararIntent,

                        PendingIntent.FLAG_UPDATE_CURRENT |
                        PendingIntent.FLAG_IMMUTABLE

                );

        Notification notification =

                new NotificationCompat.Builder(this, CHANNEL_ID)

                        .setSmallIcon(android.R.drawable.ic_dialog_alert)

                        .setContentTitle("⚠ Demanda vencendo amanhã")

                        .setContentText("Existe uma demanda para verificar.")

                        .setPriority(NotificationCompat.PRIORITY_MAX)

                        .setOngoing(true)

                        .addAction(

                                android.R.drawable.ic_menu_view,

                                "Abrir Sistema",

                                abrirPendingIntent

                        )

                        .addAction(

                                android.R.drawable.ic_media_pause,

                                "Parar Alarme",

                                pararPendingIntent

                        )

                        .build();

        NotificationManager manager =
                (NotificationManager)getSystemService(NOTIFICATION_SERVICE);

        manager.notify(2, notification);

    }
    private void criarCanal() {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            NotificationChannel channel =

                    new NotificationChannel(

                            CHANNEL_ID,

                            "Sistema de Demandas",

                            NotificationManager.IMPORTANCE_HIGH

                    );

            channel.enableVibration(true);

            NotificationManager manager =

                    getSystemService(NotificationManager.class);

            manager.createNotificationChannel(channel);

        }

    }

    @Override
    public void onDestroy() {

        super.onDestroy();

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

    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {

        return null;

    }

}