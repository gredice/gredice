package com.gredice.dostava.navigation;

/** Persists the generic active flag and one-way identity fingerprints. */
interface ActiveRouteReturnStateStore {
    boolean isActive();

    boolean matchesIdentity(String sessionKey, String activeRunKey);

    void markActive(String sessionKey, String activeRunKey);

    void clear();
}
