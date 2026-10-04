package com.gredice.dostava.navigation;

import com.gredice.dostava.data.DeliveryRouteViewState;
import com.gredice.dostava.data.DeliveryStop;

import java.util.Objects;

/** Immutable navigation-only projection used for one provider-neutral handoff. */
public final class NavigationTarget {
    private final String routeId;
    private final long routeRevision;
    private final String navigationId;
    private final String kind;
    private final String label;
    private final String address;
    private final double latitude;
    private final double longitude;

    private NavigationTarget(
            String routeId,
            long routeRevision,
            String navigationId,
            String kind,
            String label,
            String address,
            double latitude,
            double longitude
    ) {
        this.routeId = requireText(routeId, 128, "routeId");
        if (routeRevision < 0) {
            throw new IllegalArgumentException("routeRevision must not be negative");
        }
        this.routeRevision = routeRevision;
        this.navigationId = requireText(navigationId, 96, "navigationId");
        if (!("pickup".equals(kind) || "delivery".equals(kind))) {
            throw new IllegalArgumentException("kind must be pickup or delivery");
        }
        this.kind = kind;
        this.label = requireText(label, 80, "label");
        this.address = requireText(address, 300, "address");
        NavigationUri.forCoordinates(latitude, longitude);
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public static NavigationTarget from(
            DeliveryRouteViewState route,
            DeliveryStop stop
    ) {
        Objects.requireNonNull(route, "route");
        Objects.requireNonNull(stop, "stop");
        if (!route.allowsNavigation()
                || route.getRouteId() == null
                || route.getRouteRevision() == null) {
            return null;
        }
        try {
            return new NavigationTarget(
                    route.getRouteId(),
                    route.getRouteRevision(),
                    stop.getNavigationId(),
                    stop.getKind(),
                    stop.getTitle(),
                    stop.getAddress(),
                    stop.getLatitude(),
                    stop.getLongitude()
            );
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    public String getRouteId() {
        return routeId;
    }

    public long getRouteRevision() {
        return routeRevision;
    }

    public String getNavigationId() {
        return navigationId;
    }

    public String getKind() {
        return kind;
    }

    public String getLabel() {
        return label;
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

    private static String requireText(String value, int maximum, String field) {
        Objects.requireNonNull(value, field);
        if (value.isEmpty() || value.length() > maximum) {
            throw new IllegalArgumentException(field + " has an invalid length");
        }
        return value;
    }
}
