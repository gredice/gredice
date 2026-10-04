package com.gredice.dostava.data;

/** Privacy-safe metrics boundary. Implementations must never receive route contents. */
public interface DeliveryRouteTelemetry {
    void recordTransition(
            DeliveryRouteStatus from,
            DeliveryRouteStatus to,
            LatencyBucket latency,
            Long routeRevision,
            CacheStatus cacheStatus,
            String errorCode
    );

    void recordDisplayedRows(
            DeliveryRouteStatus status,
            Long routeRevision,
            int displayedRowCount
    );

    void recordNavigationHandoff(
            long routeRevision,
            String navigationId,
            String kind,
            String resultCode
    );

    void recordQuickReturnNotification(
            QuickReturnEvent event,
            String errorCode
    );

    enum QuickReturnEvent {
        POSTED,
        TAPPED,
        CANCELED,
        FAILURE
    }

    enum LatencyBucket {
        UNDER_250_MS,
        UNDER_1_SECOND,
        UNDER_5_SECONDS,
        UNDER_15_SECONDS,
        AT_LEAST_15_SECONDS
    }

    enum CacheStatus {
        NONE,
        REPLACED,
        REVALIDATED,
        FRESH_FALLBACK,
        STALE_FALLBACK
    }
}
