package com.gredice.dostava.data;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/** One atomically replaceable active-route projection plus local verification metadata. */
public final class DeliveryRouteSnapshot {
    private final String routeId;
    private final long revision;
    private final String currentNavigationId;
    private final List<DeliveryStop> stops;
    private final String etag;
    private final long verifiedAtMillis;

    public DeliveryRouteSnapshot(
            String routeId,
            long revision,
            String currentNavigationId,
            List<DeliveryStop> stops,
            String etag,
            long verifiedAtMillis
    ) {
        this.routeId = routeId;
        this.revision = revision;
        this.currentNavigationId = currentNavigationId;
        ArrayList<DeliveryStop> copiedStops = new ArrayList<>(stops.size());
        for (DeliveryStop stop : stops) {
            copiedStops.add(Objects.requireNonNull(stop));
        }
        this.stops = Collections.unmodifiableList(copiedStops);
        this.etag = etag;
        this.verifiedAtMillis = verifiedAtMillis;
    }

    public String getRouteId() {
        return routeId;
    }

    public long getRevision() {
        return revision;
    }

    public String getCurrentNavigationId() {
        return currentNavigationId;
    }

    public List<DeliveryStop> getStops() {
        return stops;
    }

    public String getEtag() {
        return etag;
    }

    public long getVerifiedAtMillis() {
        return verifiedAtMillis;
    }

    public DeliveryRouteSnapshot verifiedAt(long verifiedAt) {
        return new DeliveryRouteSnapshot(
                routeId,
                revision,
                currentNavigationId,
                stops,
                etag,
                verifiedAt
        );
    }

    @Override
    public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof DeliveryRouteSnapshot)) return false;
        DeliveryRouteSnapshot other = (DeliveryRouteSnapshot) value;
        return revision == other.revision
                && verifiedAtMillis == other.verifiedAtMillis
                && routeId.equals(other.routeId)
                && Objects.equals(currentNavigationId, other.currentNavigationId)
                && stops.equals(other.stops)
                && Objects.equals(etag, other.etag);
    }

    @Override
    public int hashCode() {
        return Objects.hash(
                routeId,
                revision,
                currentNavigationId,
                stops,
                etag,
                verifiedAtMillis
        );
    }
}
