package com.gredice.dostava.navigation;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.SharedPreferences;

/** App-private metadata store containing no address, coordinates, label, or credentials. */
@SuppressLint("ApplySharedPref") // The marker must reach disk before startCarApp is called.
public final class SharedPreferencesNavigationHandoffStore
        implements NavigationHandoffStore {
    private static final String PREFERENCES = "delivery_navigation_handoff";
    private static final String SESSION_BINDING = "session_binding";
    private static final String ROUTE_ID = "route_id";
    private static final String ROUTE_REVISION = "route_revision";
    private static final String NAVIGATION_ID = "navigation_id";
    private static final String KIND = "kind";
    private static final String LAUNCHED_AT = "launched_at";

    private final SharedPreferences preferences;

    public SharedPreferencesNavigationHandoffStore(Context context) {
        preferences = context.getApplicationContext().getSharedPreferences(
                PREFERENCES,
                Context.MODE_PRIVATE
        );
    }

    @Override
    public synchronized PendingNavigationHandoff read() {
        String sessionBinding = preferences.getString(SESSION_BINDING, null);
        String routeId = preferences.getString(ROUTE_ID, null);
        String navigationId = preferences.getString(NAVIGATION_ID, null);
        String kind = preferences.getString(KIND, null);
        if (sessionBinding == null
                || routeId == null
                || navigationId == null
                || kind == null
                || !preferences.contains(ROUTE_REVISION)
                || !preferences.contains(LAUNCHED_AT)) {
            clear();
            return null;
        }
        try {
            return new PendingNavigationHandoff(
                    sessionBinding,
                    routeId,
                    preferences.getLong(ROUTE_REVISION, -1),
                    navigationId,
                    kind,
                    preferences.getLong(LAUNCHED_AT, -1)
            );
        } catch (ClassCastException | IllegalArgumentException exception) {
            clear();
            return null;
        }
    }

    @Override
    public synchronized void write(PendingNavigationHandoff pending) {
        boolean committed = preferences.edit()
                .putString(SESSION_BINDING, pending.getSessionBinding())
                .putString(ROUTE_ID, pending.getRouteId())
                .putLong(ROUTE_REVISION, pending.getRouteRevision())
                .putString(NAVIGATION_ID, pending.getNavigationId())
                .putString(KIND, pending.getKind())
                .putLong(LAUNCHED_AT, pending.getLaunchedAtMillis())
                .commit();
        if (!committed) {
            throw new IllegalStateException("Unable to persist navigation handoff");
        }
    }

    @Override
    public synchronized void clear() {
        if (!preferences.edit().clear().commit()) {
            throw new IllegalStateException("Unable to clear navigation handoff");
        }
    }
}
