package com.gredice.dostava.data;

/** Minimal immutable projection consumed by the car UI. */
public final class DeliveryStop {
    private final String title;
    private final String subtitle;
    private final String markerLabel;
    private final double latitude;
    private final double longitude;
    private final double plannedDistanceKilometers;

    public DeliveryStop(
            String title,
            String subtitle,
            String markerLabel,
            double latitude,
            double longitude,
            double plannedDistanceKilometers
    ) {
        this.title = title;
        this.subtitle = subtitle;
        this.markerLabel = markerLabel;
        this.latitude = latitude;
        this.longitude = longitude;
        this.plannedDistanceKilometers = plannedDistanceKilometers;
    }

    public String getTitle() {
        return title;
    }

    public String getSubtitle() {
        return subtitle;
    }

    public String getMarkerLabel() {
        return markerLabel;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public double getPlannedDistanceKilometers() {
        return plannedDistanceKilometers;
    }
}
