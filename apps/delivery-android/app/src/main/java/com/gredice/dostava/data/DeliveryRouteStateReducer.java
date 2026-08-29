package com.gredice.dostava.data;

import java.util.Collections;

/** Pure state transitions for route, cache, authentication, and contract events. */
public final class DeliveryRouteStateReducer {
    public static final long FRESH_CACHE_MILLIS = 2 * 60 * 1_000L;

    public DeliveryRouteViewState signedOut() {
        return state(DeliveryRouteStatus.SIGNED_OUT, null, null, null);
    }

    public DeliveryRouteViewState loading() {
        return state(DeliveryRouteStatus.LOADING, null, null, null);
    }

    public DeliveryRouteViewState ready(
            DeliveryRouteSnapshot snapshot,
            String sessionBinding
    ) {
        if (snapshot.getStops().isEmpty()) {
            return empty(sessionBinding);
        }
        return state(DeliveryRouteStatus.READY, snapshot, sessionBinding, null);
    }

    public DeliveryRouteViewState empty() {
        return empty(null);
    }

    public DeliveryRouteViewState empty(String sessionBinding) {
        return state(DeliveryRouteStatus.EMPTY, null, sessionBinding, null);
    }

    public DeliveryRouteViewState restored(
            DeliveryRouteSnapshot snapshot,
            long nowMillis,
            String sessionBinding
    ) {
        return offline(snapshot, nowMillis, sessionBinding, "CACHE_RESTORED");
    }

    public DeliveryRouteViewState temporaryFailure(
            DeliveryRouteSnapshot snapshot,
            long nowMillis,
            String sessionBinding,
            String errorCode
    ) {
        if (snapshot == null) {
            return state(
                    DeliveryRouteStatus.ERROR,
                    null,
                    sessionBinding,
                    errorCode
            );
        }
        return offline(snapshot, nowMillis, sessionBinding, errorCode);
    }

    public DeliveryRouteViewState temporaryFailure(
            DeliveryRouteSnapshot snapshot,
            long nowMillis,
            String errorCode
    ) {
        return temporaryFailure(snapshot, nowMillis, null, errorCode);
    }

    public DeliveryRouteViewState unsupported(String sessionBinding) {
        return state(
                DeliveryRouteStatus.UNSUPPORTED,
                null,
                sessionBinding,
                "ROUTE_RESPONSE_UNSUPPORTED"
        );
    }

    public DeliveryRouteViewState unsupported() {
        return unsupported(null);
    }

    public DeliveryRouteViewState disabled(String sessionBinding) {
        return state(
                DeliveryRouteStatus.DISABLED,
                null,
                sessionBinding,
                "ANDROID_AUTO_DISABLED"
        );
    }

    private DeliveryRouteViewState offline(
            DeliveryRouteSnapshot snapshot,
            long nowMillis,
            String sessionBinding,
            String errorCode
    ) {
        if (snapshot.getStops().isEmpty()) return empty(sessionBinding);
        long age = Math.max(0, nowMillis - snapshot.getVerifiedAtMillis());
        DeliveryRouteStatus status = age <= FRESH_CACHE_MILLIS
                ? DeliveryRouteStatus.FRESH_OFFLINE
                : DeliveryRouteStatus.STALE_OFFLINE;
        return state(status, snapshot, sessionBinding, errorCode);
    }

    private DeliveryRouteViewState state(
            DeliveryRouteStatus status,
            DeliveryRouteSnapshot snapshot,
            String sessionBinding,
            String errorCode
    ) {
        return new DeliveryRouteViewState(
                status,
                snapshot == null ? Collections.emptyList() : snapshot.getStops(),
                snapshot == null ? null : snapshot.getRouteId(),
                snapshot == null ? null : snapshot.getRevision(),
                sessionBinding,
                errorCode
        );
    }
}
