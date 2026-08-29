package com.gredice.dostava.navigation;

/** Persists only whether the one generic quick-return notification is active. */
interface ActiveRouteReturnStateStore {
    boolean isActive();

    void markActive();

    void clear();
}
