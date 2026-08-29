package com.gredice.dostava.auth;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** AES-GCM credential persistence whose key material never leaves Android Keystore. */
public final class EncryptedNativeCredentialStore implements NativeCredentialStore {
    private static final String PREFERENCES = "delivery_native_session";
    private static final String KEY_ALIAS = "gredice_delivery_native_session_v1";
    private static final String REFRESH_TOKEN = "refresh_token";
    private static final String PAIRING_STATE = "pairing_state";
    private static final String PAIRING_VERIFIER = "pairing_verifier";
    private static final String PAIRING_CHALLENGE = "pairing_challenge";
    private static final String PAIRING_CREATED_AT = "pairing_created_at";

    private final SharedPreferences preferences;

    public EncryptedNativeCredentialStore(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(
                PREFERENCES,
                Context.MODE_PRIVATE
        );
    }

    @Override
    public synchronized String getRefreshToken() {
        return read(REFRESH_TOKEN);
    }

    @Override
    public synchronized void setRefreshToken(String refreshToken) {
        write(REFRESH_TOKEN, refreshToken);
    }

    @Override
    public synchronized PairingRequest getPairingRequest() {
        String state = read(PAIRING_STATE);
        String verifier = read(PAIRING_VERIFIER);
        String challenge = read(PAIRING_CHALLENGE);
        String createdAt = read(PAIRING_CREATED_AT);
        if (state == null || verifier == null || challenge == null || createdAt == null) {
            clearPairingRequest();
            return null;
        }
        try {
            return new PairingRequest(
                    state,
                    verifier,
                    challenge,
                    Long.parseLong(createdAt)
            );
        } catch (NumberFormatException exception) {
            clearPairingRequest();
            return null;
        }
    }

    @Override
    public synchronized void setPairingRequest(PairingRequest request) {
        SharedPreferences.Editor editor = preferences.edit();
        editor.putString(PAIRING_STATE, encrypt(request.getState()));
        editor.putString(PAIRING_VERIFIER, encrypt(request.getVerifier()));
        editor.putString(PAIRING_CHALLENGE, encrypt(request.getChallenge()));
        editor.putString(
                PAIRING_CREATED_AT,
                encrypt(Long.toString(request.getCreatedAtMillis()))
        );
        if (!editor.commit()) {
            throw new IllegalStateException("Unable to persist pairing request");
        }
    }

    @Override
    public synchronized void clearPairingRequest() {
        preferences.edit()
                .remove(PAIRING_STATE)
                .remove(PAIRING_VERIFIER)
                .remove(PAIRING_CHALLENGE)
                .remove(PAIRING_CREATED_AT)
                .apply();
    }

    @Override
    public synchronized void clearSession() {
        preferences.edit().clear().apply();
    }

    private String read(String key) {
        String encrypted = preferences.getString(key, null);
        if (encrypted == null) return null;
        try {
            return decrypt(encrypted);
        } catch (RuntimeException exception) {
            preferences.edit().remove(key).apply();
            return null;
        }
    }

    private void write(String key, String value) {
        if (!preferences.edit().putString(key, encrypt(value)).commit()) {
            throw new IllegalStateException("Unable to persist native session");
        }
    }

    private String encrypt(String value) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            String iv = Base64.getUrlEncoder().withoutPadding().encodeToString(
                    cipher.getIV()
            );
            String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                    cipher.doFinal(value.getBytes(StandardCharsets.UTF_8))
            );
            return iv + "." + payload;
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Unable to encrypt native session", exception);
        }
    }

    private String decrypt(String encrypted) {
        String[] parts = encrypted.split("\\.", -1);
        if (parts.length != 2) throw new IllegalArgumentException("Invalid ciphertext");
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    getOrCreateKey(),
                    new GCMParameterSpec(
                            128,
                            Base64.getUrlDecoder().decode(parts[0])
                    )
            );
            return new String(
                    cipher.doFinal(Base64.getUrlDecoder().decode(parts[1])),
                    StandardCharsets.UTF_8
            );
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new IllegalStateException("Unable to decrypt native session", exception);
        }
    }

    private SecretKey getOrCreateKey() throws GeneralSecurityException {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        try {
            keyStore.load(null);
        } catch (IOException exception) {
            throw new GeneralSecurityException(
                    "Unable to load Android Keystore",
                    exception
            );
        }
        SecretKey existing = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (existing != null) return existing;

        KeyGenerator generator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                "AndroidKeyStore"
        );
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }
}
