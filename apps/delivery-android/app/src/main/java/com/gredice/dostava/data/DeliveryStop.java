package com.gredice.dostava.data;

import java.util.Objects;

/** Immutable, privacy-minimized navigation stop validated from the mobile route contract. */
public final class DeliveryStop {
    private final String navigationId;
    private final String kind;
    private final int sequence;
    private final String actionState;
    private final String title;
    private final String address;
    private final double latitude;
    private final double longitude;
    private final Long estimatedArrivalAtMillis;
    private final Long travelSeconds;
    private final Long distanceMeters;

    public DeliveryStop(
            String navigationId,
            String kind,
            int sequence,
            String actionState,
            String title,
            String address,
            double latitude,
            double longitude,
            Long estimatedArrivalAtMillis,
            Long travelSeconds,
            Long distanceMeters
    ) {
        this.navigationId = navigationId;
        this.kind = kind;
        this.sequence = sequence;
        this.actionState = actionState;
        this.title = title;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.estimatedArrivalAtMillis = estimatedArrivalAtMillis;
        this.travelSeconds = travelSeconds;
        this.distanceMeters = distanceMeters;
    }

    public String getNavigationId() {
        return navigationId;
    }

    public String getKind() {
        return kind;
    }

    public int getSequence() {
        return sequence;
    }

    public String getActionState() {
        return actionState;
    }

    public String getTitle() {
        return title;
    }

    public String getAddress() {
        return address;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public Long getEstimatedArrivalAtMillis() {
        return estimatedArrivalAtMillis;
    }

    public Long getTravelSeconds() {
        return travelSeconds;
    }

    public Long getDistanceMeters() {
        return distanceMeters;
    }

    public String getMarkerLabel() {
        return Integer.toString(sequence);
    }

    public boolean isCurrent() {
        return "current".equals(actionState);
    }

    @Override
    public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof DeliveryStop)) return false;
        DeliveryStop other = (DeliveryStop) value;
        return sequence == other.sequence
                && Double.compare(latitude, other.latitude) == 0
                && Double.compare(longitude, other.longitude) == 0
                && navigationId.equals(other.navigationId)
                && kind.equals(other.kind)
                && actionState.equals(other.actionState)
                && title.equals(other.title)
                && address.equals(other.address)
                && Objects.equals(estimatedArrivalAtMillis, other.estimatedArrivalAtMillis)
                && Objects.equals(travelSeconds, other.travelSeconds)
                && Objects.equals(distanceMeters, other.distanceMeters);
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                navigationId,
                kind,
                sequence,
                actionState,
                title,
                address,
                latitude,
                longitude,
                estimatedArrivalAtMillis,
                travelSeconds,
                distanceMeters
        );
    }
}
