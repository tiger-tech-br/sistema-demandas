package com.demandas.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {

        Intent serviceIntent = new Intent(context, AlarmService.class);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

            ContextCompat.startForegroundService(
                    context,
                    serviceIntent
            );

        } else {

            context.startService(serviceIntent);

        }

    }

}