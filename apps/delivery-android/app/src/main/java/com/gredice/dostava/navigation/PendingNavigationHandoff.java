package com.gredice.dostava.navigation;

import java.util.Objects;

/** Minimal process-recovery marker. It deliberately contains no destination payload. */
public final class PendingNavigationHandoff {
    private final String sessionBinding;
    private final String routeId;
    private final long routeRevision;
    private final String navigationId;
    private final String kind;
    private final long launchedAtMillis;

    public PendingNavigationHandoff(
            String sessionBinding,
            String routeId,
            long routeRevision,
            String navigationId,
            String kind,
            long launchedAtMillis
    ) {
        this.sessionBinding = requireText(sessionBinding, 64, "sessionBinding");
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
        if (launchedAtMillis < 0) {
            throw new IllegalArgumentException("launchedAtMillis must not be negative");
        }
        this.launchedAtMillis = launchedAtMillis;
    }

    public static PendingNavigationHandoff from(
            String sessionBinding,
            NavigationTarget target,
            long launchedAtMillis
    ) {
        Objects.requireNonNull(target, "target");
        return new PendingNavigationHandoff(
                sessionBinding,
                target.getRouteId(),
                target.getRouteRevision(),
                target.getNavigationId(),
                target.getKind(),
                launchedAtMillis
        );
    }

    public String getSessionBinding() {
        return sessionBinding;
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

    public long getLaunchedAtMillis() {
        return launchedAtMillis;
    }

    public boolean belongsTo(
            String expectedSessionBinding,
            String expectedRouteId,
            long expectedRouteRevision
    ) {
        return sessionBinding.equals(expectedSessionBinding)
                && routeId.equals(expectedRouteId)
                && routeRevision == expectedRouteRevision;
    }

    private static String requireText(String value, int maximum, String field) {
        Objects.requireNonNull(value, field);
        if (value.isEmpty() || value.length() > maximum) {
            throw new IllegalArgumentException(field + " has an invalid length");
        }
        return value;
    }
}
