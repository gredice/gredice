package com.gredice.dostava.data;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** Immutable state consumed by the single root car screen. */
public final class DeliveryRouteViewState {
    private final DeliveryRouteStatus status;
    private final List<DeliveryStop> stops;
    private final String routeId;
    private final Long routeRevision;
    private final String sessionBinding;
    private final String errorCode;

    public DeliveryRouteViewState(
            DeliveryRouteStatus status,
            List<DeliveryStop> stops,
            Long routeRevision,
            String errorCode
    ) {
        this(status, stops, null, routeRevision, null, errorCode);
    }

    public DeliveryRouteViewState(
            DeliveryRouteStatus status,
            List<DeliveryStop> stops,
            String routeId,
            Long routeRevision,
            String sessionBinding,
            String errorCode
    ) {
        this.status = Objects.requireNonNull(status, "status");
        ArrayList<DeliveryStop> copiedStops = new ArrayList<>(stops.size());
        for (DeliveryStop stop : stops) {
            copiedStops.add(Objects.requireNonNull(stop));
        }
        this.stops = Collections.unmodifiableList(copiedStops);
        this.routeId = routeId;
        this.routeRevision = routeRevision;
        this.sessionBinding = sessionBinding;
        this.errorCode = errorCode;
    }

    public DeliveryRouteStatus getStatus() {
        return status;
    }

    public List<DeliveryStop> getStops() {
        return stops;
    }

    public String getRouteId() {
        return routeId;
    }

    public Long getRouteRevision() {
        return routeRevision;
    }

    public String getSessionBinding() {
        return sessionBinding;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public boolean allowsNavigation() {
        return (status == DeliveryRouteStatus.READY
                || status == DeliveryRouteStatus.FRESH_OFFLINE)
                && routeId != null
                && routeRevision != null
                && sessionBinding != null;
    }

    @Override
    public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof DeliveryRouteViewState)) return false;
        DeliveryRouteViewState other = (DeliveryRouteViewState) value;
        return status == other.status
                && stops.equals(other.stops)
                && Objects.equals(routeId, other.routeId)
                && Objects.equals(routeRevision, other.routeRevision)
                && Objects.equals(sessionBinding, other.sessionBinding)
                && Objects.equals(errorCode, other.errorCode);
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                status,
                stops,
                routeId,
                routeRevision,
                sessionBinding,
                errorCode
        );
    }
}
