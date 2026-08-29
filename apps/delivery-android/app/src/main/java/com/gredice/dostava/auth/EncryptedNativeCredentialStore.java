package com.gredice.dostava.auth;

import android.content.Context;
import android.content.SharedPreferences;

import com.gredice.dostava.security.KeystoreAesGcmCipher;

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
    private final KeystoreAesGcmCipher cipher;

    public EncryptedNativeCredentialStore(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(
                PREFERENCES,
                Context.MODE_PRIVATE
        );
        cipher = new KeystoreAesGcmCipher(KEY_ALIAS);
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
        editor.putString(PAIRING_STATE, cipher.encrypt(request.getState()));
        editor.putString(PAIRING_VERIFIER, cipher.encrypt(request.getVerifier()));
        editor.putString(PAIRING_CHALLENGE, cipher.encrypt(request.getChallenge()));
        editor.putString(
                PAIRING_CREATED_AT,
                cipher.encrypt(Long.toString(request.getCreatedAtMillis()))
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
            return cipher.decrypt(encrypted);
        } catch (RuntimeException exception) {
            preferences.edit().remove(key).apply();
            return null;
        }
    }

    private void write(String key, String value) {
        if (!preferences.edit().putString(key, cipher.encrypt(value)).commit()) {
            throw new IllegalStateException("Unable to persist native session");
        }
    }
}
