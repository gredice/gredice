package com.gredice.dostava.navigation;

import android.content.Context;
import android.content.SharedPreferences;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/** Backup-excluded active flag and one-way identity fingerprints for recovery. */
final class SharedPreferencesActiveRouteReturnStateStore
        implements ActiveRouteReturnStateStore {
    private static final String PREFERENCES = "active_route_return_notification";
    private static final String KEY_ACTIVE = "active";
    private static final String KEY_SESSION_FINGERPRINT = "session_fingerprint";
    private static final String KEY_RUN_FINGERPRINT = "run_fingerprint";
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private final SharedPreferences preferences;

    SharedPreferencesActiveRouteReturnStateStore(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(
                PREFERENCES,
                Context.MODE_PRIVATE
        );
    }

    @Override
    public synchronized boolean isActive() {
        return preferences.getBoolean(KEY_ACTIVE, false);
    }

    @Override
    public synchronized boolean matchesIdentity(
            String sessionKey,
            String activeRunKey
    ) {
        if (!isActive()) return true;
        String storedSession = preferences.getString(
                KEY_SESSION_FINGERPRINT,
                null
        );
        if (!fingerprint(sessionKey).equals(storedSession)) return false;
        return activeRunKey == null || fingerprint(activeRunKey).equals(
                preferences.getString(KEY_RUN_FINGERPRINT, null)
        );
    }

    @Override
    public synchronized void markActive(
            String sessionKey,
            String activeRunKey
    ) {
        if (!preferences.edit()
                .putBoolean(KEY_ACTIVE, true)
                .putString(KEY_SESSION_FINGERPRINT, fingerprint(sessionKey))
                .putString(KEY_RUN_FINGERPRINT, fingerprint(activeRunKey))
                .commit()) {
            throw new IllegalStateException("Quick-return state could not be stored.");
        }
    }

    @Override
    public synchronized void clear() {
        if (!preferences.edit()
                .remove(KEY_ACTIVE)
                .remove(KEY_SESSION_FINGERPRINT)
                .remove(KEY_RUN_FINGERPRINT)
                .commit()) {
            throw new IllegalStateException("Quick-return state could not be cleared.");
        }
    }

    private String fingerprint(String value) {
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException("Quick-return identity is required.");
        }
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(
                    value.getBytes(StandardCharsets.UTF_8)
            );
            char[] encoded = new char[digest.length * 2];
            for (int index = 0; index < digest.length; index++) {
                int current = digest[index] & 0xff;
                encoded[index * 2] = HEX[current >>> 4];
                encoded[index * 2 + 1] = HEX[current & 0x0f];
            }
            return new String(encoded);
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable.", unavailable);
        }
    }
}
