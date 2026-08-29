package com.gredice.dostava.data;

import android.content.Context;
import android.content.SharedPreferences;

import com.gredice.dostava.security.KeystoreAesGcmCipher;

/** Keystore-encrypted, backup-excluded persistence for one bounded route snapshot. */
public final class EncryptedDeliveryRouteCache implements DeliveryRouteCache {
    private static final String PREFERENCES = "delivery_native_route_cache";
    private static final String KEY_ALIAS = "gredice_delivery_native_route_cache_v1";
    private static final String SNAPSHOT = "snapshot";

    private final SharedPreferences preferences;
    private final KeystoreAesGcmCipher cipher;
    private final DeliveryRouteCacheCodec codec = new DeliveryRouteCacheCodec();

    public EncryptedDeliveryRouteCache(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(
                PREFERENCES,
                Context.MODE_PRIVATE
        );
        cipher = new KeystoreAesGcmCipher(KEY_ALIAS);
    }

    @Override
    public synchronized DeliveryRouteSnapshot read() {
        String encrypted = preferences.getString(SNAPSHOT, null);
        if (encrypted == null) return null;
        try {
            return codec.decode(cipher.decrypt(encrypted));
        } catch (RuntimeException exception) {
            clear();
            return null;
        }
    }

    @Override
    public synchronized void write(DeliveryRouteSnapshot snapshot) {
        String encrypted = cipher.encrypt(codec.encode(snapshot));
        if (!preferences.edit().putString(SNAPSHOT, encrypted).commit()) {
            throw new IllegalStateException("Unable to persist native route cache");
        }
    }

    @Override
    public synchronized void clear() {
        preferences.edit().remove(SNAPSHOT).apply();
    }
}
