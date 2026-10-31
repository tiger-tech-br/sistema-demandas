package com.viviani.sistemademandas;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int REQUEST_NOTIFICATION_PERMISSION = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SessaoPlugin.class);
        super.onCreate(savedInstanceState);
        limparCacheDeArquivos();
        solicitarPermissaoNotificacao();

        if (SessaoStore.obter(this) != null) {
            AlarmScheduler.schedule(this);
        } else {
            AlarmScheduler.cancel(this);
        }
    }

    private void limparCacheDeArquivos() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();

        if (webView != null) {
            webView.setBackgroundColor(Color.WHITE);
            webView.clearCache(true);
        }
    }

    private void solicitarPermissaoNotificacao() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }

        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
        ) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{ Manifest.permission.POST_NOTIFICATIONS },
                    REQUEST_NOTIFICATION_PERMISSION
            );
        }
    }
}
