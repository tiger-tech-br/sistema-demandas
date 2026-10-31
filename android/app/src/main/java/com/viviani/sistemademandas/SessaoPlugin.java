package com.viviani.sistemademandas;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

@CapacitorPlugin(name = "Sessao")
public class SessaoPlugin extends Plugin {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void salvar(PluginCall call) {
        String token = call.getString("token");
        if (!SessaoStore.tokenValido(token)) {
            call.reject("Sessão inválida. Entre novamente na sua conta.");
            return;
        }

        try {
            SessaoStore.salvar(getContext(), token);
            mainHandler.post(() -> {
                interromperAlarmes();
                AlarmScheduler.schedule(getContext());
                call.resolve();
            });
        } catch (Exception erro) {
            SessaoStore.limpar(getContext());
            mainHandler.post(() -> {
                interromperAlarmes();
                call.reject("Não foi possível guardar sua sessão com segurança. Entre novamente.");
            });
        }
    }

    @PluginMethod
    public void obter(PluginCall call) {
        String token = SessaoStore.obter(getContext());
        JSObject resultado = new JSObject();
        resultado.put("token", token == null ? JSONObject.NULL : token);

        if (token == null) {
            mainHandler.post(() -> {
                interromperAlarmes();
                call.resolve(resultado);
            });
        } else {
            call.resolve(resultado);
        }
    }

    @PluginMethod
    public void limpar(PluginCall call) {
        SessaoStore.limpar(getContext());
        mainHandler.post(() -> {
            interromperAlarmes();
            call.resolve();
        });
    }

    private void interromperAlarmes() {
        AlarmScheduler.cancel(getContext());
        getContext().stopService(new Intent(getContext(), AlarmService.class));
        NotificationManager notificacoes =
                (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificacoes != null) {
            notificacoes.cancel(1);
            notificacoes.cancel(2);
        }
    }
}
