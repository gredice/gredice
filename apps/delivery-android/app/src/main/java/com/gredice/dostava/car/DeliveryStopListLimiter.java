package com.gredice.dostava.car;

import com.gredice.dostava.data.DeliveryStop;

import java.util.List;

/** Applies the host limit while always retaining the canonical first row. */
final class DeliveryStopListLimiter {
    private static final int SERVER_LIMIT = 5;

    List<DeliveryStop> limit(List<DeliveryStop> stops, int hostLimit) {
        int effectiveLimit = Math.min(
                SERVER_LIMIT,
                Math.max(1, hostLimit)
        );
        return stops.subList(0, Math.min(stops.size(), effectiveLimit));
    }
}
