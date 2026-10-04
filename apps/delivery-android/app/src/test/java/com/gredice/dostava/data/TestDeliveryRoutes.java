package com.gredice.dostava.data;

import java.util.List;

final class TestDeliveryRoutes {
    private TestDeliveryRoutes() { }

    static DeliveryStop stop(int sequence, boolean current) {
        String kind = sequence % 2 == 0 ? "pickup" : "delivery";
        return new DeliveryStop(
                kind + ":opaque-" + sequence,
                kind,
                sequence,
                current ? "current" : "upcoming",
                ("pickup".equals(kind) ? "Preuzimanje " : "Dostava ") + sequence,
                "Testna adresa " + sequence,
                45.8 + sequence / 1_000.0,
                16.0 + sequence / 1_000.0,
                1_777_000_000_000L + sequence * 60_000L,
                sequence * 60L,
                sequence * 1_000L
        );
    }

    static DeliveryRouteSnapshot snapshot(long revision, long verifiedAtMillis) {
        DeliveryStop current = stop(1, true);
        return new DeliveryRouteSnapshot(
                "route-opaque",
                revision,
                current.getNavigationId(),
                List.of(current, stop(2, false)),
                "\"route-etag-" + revision + "\"",
                verifiedAtMillis
        );
    }
}
