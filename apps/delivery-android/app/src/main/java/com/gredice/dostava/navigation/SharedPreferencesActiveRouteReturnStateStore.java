package com.gredice.dostava.navigation;

import android.content.Context;
import android.content.SharedPreferences;

/** Backup-excluded process-recovery flag for notification cancellation/deduplication. */
final class SharedPreferencesActiveRouteReturnStateStore
        implements ActiveRouteReturnStateStore {
    private static final String PREFERENCES = "active_route_return_notification";
    private static final String KEY_ACTIVE = "active";

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
    public synchronized void markActive() {
        if (!preferences.edit().putBoolean(KEY_ACTIVE, true).commit()) {
            throw new IllegalStateException("Quick-return state could not be stored.");
        }
    }

    @Override
    public synchronized void clear() {
        if (!preferences.edit().remove(KEY_ACTIVE).commit()) {
            throw new IllegalStateException("Quick-return state could not be cleared.");
        }
    }
}
