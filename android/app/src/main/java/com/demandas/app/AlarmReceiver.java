package com.viviani.sistemademandas;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {

        if (SessaoStore.obter(context) == null) {
            AlarmScheduler.cancel(context);
            return;
        }

        Intent serviceIntent = new Intent(context, AlarmService.class);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {

                ContextCompat.startForegroundService(context, serviceIntent);

            } else {

                context.startService(serviceIntent);

            }
        } catch (IllegalStateException | SecurityException erro) {
            // O sistema pode impedir serviços em segundo plano; a consulta ocorre ao abrir o app.
        }

    }

}
