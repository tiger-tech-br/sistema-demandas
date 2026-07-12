package com.demandas.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class OpenAppReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {

        Intent abrir = new Intent(context, MainActivity.class);

        abrir.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP
        );

        context.startActivity(abrir);

        Intent service = new Intent(context, AlarmService.class);

        context.stopService(service);

    }

}