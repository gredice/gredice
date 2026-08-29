package com.gredice.dostava.data;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Immutable state consumed by the single root car screen. */
public final class DeliveryRouteViewState {
    private final DeliveryRouteStatus status;
    private final List<DeliveryStop> stops;
    private final Long routeRevision;
    private final String errorCode;

    public DeliveryRouteViewState(
            DeliveryRouteStatus status,
            List<DeliveryStop> stops,
            Long routeRevision,
            String errorCode
    ) {
        this.status = status;
        this.stops = Collections.unmodifiableList(List.copyOf(stops));
        this.routeRevision = routeRevision;
        this.errorCode = errorCode;
    }

    public DeliveryRouteStatus getStatus() {
        return status;
    }

    public List<DeliveryStop> getStops() {
        return stops;
    }

    public Long getRouteRevision() {
        return routeRevision;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public boolean allowsNavigation() {
        return status == DeliveryRouteStatus.READY
                || status == DeliveryRouteStatus.FRESH_OFFLINE;
    }

    @Override
    public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof DeliveryRouteViewState)) return false;
        DeliveryRouteViewState other = (DeliveryRouteViewState) value;
        return status == other.status
                && stops.equals(other.stops)
                && Objects.equals(routeRevision, other.routeRevision)
                && Objects.equals(errorCode, other.errorCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(status, stops, routeRevision, errorCode);
    }
}
