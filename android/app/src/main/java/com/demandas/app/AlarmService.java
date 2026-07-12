package com.demandas.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

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

                    if (demandas.length() == 0) {

                        stopSelf();

                    } else {

                        mostrarNotificacao();

                    }

                } catch (Exception e) {

                    stopSelf();

                }

            }

        });

    }

    private void mostrarNotificacao() {

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setContentTitle("Sistema de Demandas")
                .setContentText("Existe demanda vencendo amanhã.")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setOngoing(true)
                .build();

        NotificationManager manager =
                (NotificationManager) getSystemService(NOTIFICATION_SERVICE);

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

            NotificationManager manager =

                    getSystemService(NotificationManager.class);

            manager.createNotificationChannel(channel);

        }

    }

    @Override
    public void onDestroy() {

        super.onDestroy();

    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {

        return null;

    }

}