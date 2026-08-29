package com.gredice.dostava.data;

import java.util.Collections;

/** Pure state transitions for route, cache, authentication, and contract events. */
public final class DeliveryRouteStateReducer {
    public static final long FRESH_CACHE_MILLIS = 2 * 60 * 1_000L;

    public DeliveryRouteViewState signedOut() {
        return state(DeliveryRouteStatus.SIGNED_OUT, null, null);
    }

    public DeliveryRouteViewState loading() {
        return state(DeliveryRouteStatus.LOADING, null, null);
    }

    public DeliveryRouteViewState ready(DeliveryRouteSnapshot snapshot) {
        if (snapshot.getStops().isEmpty()) {
            return state(DeliveryRouteStatus.EMPTY, null, null);
        }
        return state(DeliveryRouteStatus.READY, snapshot, null);
    }

    public DeliveryRouteViewState empty() {
        return state(DeliveryRouteStatus.EMPTY, null, null);
    }

    public DeliveryRouteViewState restored(
            DeliveryRouteSnapshot snapshot,
            long nowMillis
    ) {
        return offline(snapshot, nowMillis, "CACHE_RESTORED");
    }

    public DeliveryRouteViewState temporaryFailure(
            DeliveryRouteSnapshot snapshot,
            long nowMillis,
            String errorCode
    ) {
        if (snapshot == null) {
            return state(DeliveryRouteStatus.ERROR, null, errorCode);
        }
        return offline(snapshot, nowMillis, errorCode);
    }

    public DeliveryRouteViewState unsupported() {
        return state(
                DeliveryRouteStatus.UNSUPPORTED,
                null,
                "ROUTE_RESPONSE_UNSUPPORTED"
        );
    }

    private DeliveryRouteViewState offline(
            DeliveryRouteSnapshot snapshot,
            long nowMillis,
            String errorCode
    ) {
        if (snapshot.getStops().isEmpty()) return empty();
        long age = Math.max(0, nowMillis - snapshot.getVerifiedAtMillis());
        DeliveryRouteStatus status = age <= FRESH_CACHE_MILLIS
                ? DeliveryRouteStatus.FRESH_OFFLINE
                : DeliveryRouteStatus.STALE_OFFLINE;
        return state(status, snapshot, errorCode);
    }

    private DeliveryRouteViewState state(
            DeliveryRouteStatus status,
            DeliveryRouteSnapshot snapshot,
            String errorCode
    ) {
        return new DeliveryRouteViewState(
                status,
                snapshot == null ? Collections.emptyList() : snapshot.getStops(),
                snapshot == null ? null : snapshot.getRevision(),
                errorCode
        );
    }
}
