package com.gredice.dostava.data;

/** Default for isolated tests and embedders that do not configure metrics. */
public final class NoOpDeliveryRouteTelemetry implements DeliveryRouteTelemetry {
    @Override
    public void recordTransition(
            DeliveryRouteStatus from,
            DeliveryRouteStatus to,
            LatencyBucket latency,
            Long routeRevision,
            CacheStatus cacheStatus,
            String errorCode
    ) { }

    @Override
    public void recordDisplayedRows(
            DeliveryRouteStatus status,
            Long routeRevision,
            int displayedRowCount
    ) { }

    @Override
    public void recordNavigationHandoff(
            long routeRevision,
            String navigationId,
            String kind,
            String resultCode
    ) { }
}
