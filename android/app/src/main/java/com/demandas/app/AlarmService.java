package com.demandas.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class AlarmService extends Service {

    private static final String CHANNEL_ID = "demandas_channel";

    private MediaPlayer mediaPlayer;

    private Vibrator vibrator;

    @Override
    public void onCreate() {

        super.onCreate();

        criarCanal();

        mediaPlayer = MediaPlayer.create(this, R.raw.alarme);

        mediaPlayer.setLooping(true);

        vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);

    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {

        Notification notification =
                new NotificationCompat.Builder(this, CHANNEL_ID)

                        .setSmallIcon(android.R.drawable.ic_dialog_alert)

                        .setContentTitle("Sistema de Demandas")

                        .setContentText("Existe uma demanda vencendo amanhã.")

                        .setPriority(NotificationCompat.PRIORITY_HIGH)

                        .setOngoing(true)

                        .build();

        startForeground(1, notification);

        if (mediaPlayer != null && !mediaPlayer.isPlaying()) {

            mediaPlayer.start();

        }

        if (vibrator != null) {

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

                vibrator.vibrate(

                        VibrationEffect.createWaveform(

                                new long[]{
                                        0,
                                        1000,
                                        700
                                },

                                0

                        )

                );

            } else {

                vibrator.vibrate(

                        new long[]{
                                0,
                                1000,
                                700
                        },

                        0

                );

            }

        }

        return START_STICKY;

    }

    @Override
    public void onDestroy() {

        super.onDestroy();

        if (mediaPlayer != null) {

            mediaPlayer.stop();

            mediaPlayer.release();

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

}