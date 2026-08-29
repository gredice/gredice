package com.gredice.dostava.data;

import android.util.Log;

import java.util.regex.Pattern;

/** Emits bounded operational fields without any stop or credential data. */
public final class LogcatDeliveryRouteTelemetry implements DeliveryRouteTelemetry {
    private static final String TAG = "GrediceDeliveryCar";
    private static final Pattern SAFE_ERROR_CODE = Pattern.compile("^[A-Z0-9_]{1,64}$");

    @Override
    public void recordTransition(
            DeliveryRouteStatus from,
            DeliveryRouteStatus to,
            LatencyBucket latency,
            Long routeRevision,
            CacheStatus cacheStatus,
            String errorCode
    ) {
        Log.i(TAG, "event=route_transition"
                + " from=" + from.name()
                + " to=" + to.name()
                + " latency=" + latency.name()
                + " revision=" + value(routeRevision)
                + " cache=" + cacheStatus.name()
                + " error=" + safeErrorCode(errorCode));
    }

    @Override
    public void recordDisplayedRows(
            DeliveryRouteStatus status,
            Long routeRevision,
            int displayedRowCount
    ) {
        Log.i(TAG, "event=route_render"
                + " state=" + status.name()
                + " revision=" + value(routeRevision)
                + " rows=" + Math.max(0, Math.min(5, displayedRowCount)));
    }

    private String safeErrorCode(String errorCode) {
        return errorCode != null && SAFE_ERROR_CODE.matcher(errorCode).matches()
                ? errorCode
                : "NONE";
    }

    private String value(Long revision) {
        return revision == null ? "none" : Long.toString(Math.max(0, revision));
    }
}
