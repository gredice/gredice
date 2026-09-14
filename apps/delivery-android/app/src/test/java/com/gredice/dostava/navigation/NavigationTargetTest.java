package com.gredice.dostava.navigation;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import com.gredice.dostava.data.DeliveryRouteStatus;
import com.gredice.dostava.data.DeliveryRouteViewState;
import com.gredice.dostava.data.DeliveryStop;

import java.util.Collections;

import org.junit.Test;

public final class NavigationTargetTest {
    @Test
    public void createsTheSharedTargetFromAFreshValidatedRoute() {
        DeliveryStop stop = stop(45.81, 16.02);
        NavigationTarget target = NavigationTarget.from(
                route(DeliveryRouteStatus.READY, stop),
                stop
        );

        assertEquals("route:opaque", target.getRouteId());
        assertEquals(7L, target.getRouteRevision());
        assertEquals("delivery:opaque-1", target.getNavigationId());
        assertEquals("delivery", target.getKind());
        assertEquals("Dostava 1", target.getLabel());
        assertEquals("Testna adresa 1", target.getAddress());
        assertEquals(45.81, target.getLatitude(), 0);
        assertEquals(16.02, target.getLongitude(), 0);
    }

    @Test
    public void omitsTargetsForStaleOrIncompleteRouteState() {
        DeliveryStop valid = stop(45.81, 16.02);

        assertNull(NavigationTarget.from(
                route(DeliveryRouteStatus.STALE_OFFLINE, valid),
                valid
        ));
        assertNull(NavigationTarget.from(
                new DeliveryRouteViewState(
                        DeliveryRouteStatus.READY,
                        Collections.singletonList(valid),
                        null,
                        7L,
                        "session:opaque",
                        null
                ),
                valid
        ));
    }

    @Test
    public void omitsTargetsWithInvalidCoordinatesBeforeTemplateCreation() {
        DeliveryStop invalid = stop(Double.NaN, 16.02);

        assertNull(NavigationTarget.from(
                route(DeliveryRouteStatus.READY, invalid),
                invalid
        ));
    }

    private DeliveryRouteViewState route(
            DeliveryRouteStatus status,
            DeliveryStop stop
    ) {
        return new DeliveryRouteViewState(
                status,
                Collections.singletonList(stop),
                "route:opaque",
                7L,
                "session:opaque",
                status == DeliveryRouteStatus.READY ? null : "CACHE_EXPIRED"
        );
    }

    private DeliveryStop stop(double latitude, double longitude) {
        return new DeliveryStop(
                "delivery:opaque-1",
                "delivery",
                1,
                "current",
                "Dostava 1",
                "Testna adresa 1",
                latitude,
                longitude,
                null,
                60L,
                1_000L
        );
    }
}
