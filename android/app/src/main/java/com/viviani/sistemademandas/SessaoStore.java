package com.viviani.sistemademandas;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Guarda somente a sessão opaca; a senha do usuário nunca é recebida pelo código nativo. */
final class SessaoStore {
    private static final String PREFERENCIAS = "sessao_saas_v1";
    private static final String CHAVE = "com.viviani.sistemademandas.sessao.v1";
    private static final String PROVEDOR = "AndroidKeyStore";
    private static final String CIFRA = "AES/GCM/NoPadding";
    private static final byte[] CONTEXTO = "sistema-demandas:sessao:v1".getBytes(StandardCharsets.UTF_8);

    private SessaoStore() {}

    private static SharedPreferences preferencias(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFERENCIAS, Context.MODE_PRIVATE);
    }

    static boolean tokenValido(String token) {
        return token != null && token.matches("^[a-f0-9]{64}$");
    }

    private static SecretKey chave(boolean criar) throws GeneralSecurityException, IOException {
        KeyStore keyStore = KeyStore.getInstance(PROVEDOR);
        keyStore.load(null);

        if (keyStore.containsAlias(CHAVE)) {
            return (SecretKey) keyStore.getKey(CHAVE, null);
        }

        if (!criar) {
            return null;
        }

        KeyGenerator gerador = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVEDOR);
        gerador.init(new KeyGenParameterSpec.Builder(
                CHAVE, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .setKeySize(256)
                .build());
        return gerador.generateKey();
    }

    static synchronized void salvar(Context context, String token) throws GeneralSecurityException, IOException {
        if (!tokenValido(token)) {
            throw new GeneralSecurityException("Sessão inválida.");
        }

        Cipher cifra = Cipher.getInstance(CIFRA);
        cifra.init(Cipher.ENCRYPT_MODE, chave(true));
        cifra.updateAAD(CONTEXTO);
        byte[] cifrado = cifra.doFinal(token.getBytes(StandardCharsets.UTF_8));

        boolean gravado = preferencias(context).edit()
                .putString("iv", Base64.encodeToString(cifra.getIV(), Base64.NO_WRAP))
                .putString("token_cifrado", Base64.encodeToString(cifrado, Base64.NO_WRAP))
                .commit();

        if (!gravado) {
            limpar(context);
            throw new IOException("Não foi possível guardar a sessão.");
        }
    }

    static synchronized String obter(Context context) {
        SharedPreferences preferencias = preferencias(context);
        String iv = preferencias.getString("iv", null);
        String cifrado = preferencias.getString("token_cifrado", null);

        if (iv == null || cifrado == null) {
            return null;
        }

        try {
            SecretKey chave = chave(false);
            if (chave == null) {
                limpar(context);
                return null;
            }

            byte[] ivDecodificado = Base64.decode(iv, Base64.NO_WRAP);
            byte[] tokenCifrado = Base64.decode(cifrado, Base64.NO_WRAP);
            if (ivDecodificado.length != 12 || tokenCifrado.length != 80) {
                limpar(context);
                return null;
            }

            Cipher cifra = Cipher.getInstance(CIFRA);
            cifra.init(Cipher.DECRYPT_MODE, chave, new GCMParameterSpec(128, ivDecodificado));
            cifra.updateAAD(CONTEXTO);
            String token = new String(cifra.doFinal(tokenCifrado), StandardCharsets.UTF_8);
            if (tokenValido(token)) {
                return token;
            }
        } catch (GeneralSecurityException | IOException | IllegalArgumentException erro) {
            // Cópias restauradas sem a chave e arquivos corrompidos exigem um novo login.
        }

        limpar(context);
        return null;
    }

    static synchronized boolean corresponde(Context context, String token) {
        return token != null && token.equals(obter(context));
    }

    static synchronized boolean limparSeCorresponde(Context context, String token) {
        if (!corresponde(context, token)) {
            return false;
        }

        limpar(context);
        return true;
    }

    static synchronized void limpar(Context context) {
        preferencias(context).edit().clear().commit();

        try {
            KeyStore keyStore = KeyStore.getInstance(PROVEDOR);
            keyStore.load(null);
            keyStore.deleteEntry(CHAVE);
        } catch (GeneralSecurityException | IOException erro) {
            // Nunca retorna nem registra uma credencial mesmo se a chave já estiver indisponível.
        }
    }
}
