package com.gredice.dostava.data;

import java.util.Objects;

/** Typed transport outcome for a changed route, no route, or an ETag 304. */
public final class DeliveryRouteResponse {
    public enum Kind {
        ACTIVE,
        EMPTY,
        NOT_MODIFIED
    }

    private final Kind kind;
    private final DeliveryRouteSnapshot snapshot;

    private DeliveryRouteResponse(Kind kind, DeliveryRouteSnapshot snapshot) {
        this.kind = Objects.requireNonNull(kind, "kind");
        this.snapshot = snapshot;
    }

    public static DeliveryRouteResponse active(DeliveryRouteSnapshot snapshot) {
        return new DeliveryRouteResponse(
                Kind.ACTIVE,
                Objects.requireNonNull(snapshot, "snapshot")
        );
    }

    public static DeliveryRouteResponse empty() {
        return new DeliveryRouteResponse(Kind.EMPTY, null);
    }

    public static DeliveryRouteResponse notModified() {
        return new DeliveryRouteResponse(Kind.NOT_MODIFIED, null);
    }

    public Kind getKind() {
        return kind;
    }

    public DeliveryRouteSnapshot getSnapshot() {
        return snapshot;
    }
}
