package com.gredice.dostava.data;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.util.Collections;

import org.junit.Test;

public final class DeliveryRouteStateReducerTest {
    private final DeliveryRouteStateReducer reducer = new DeliveryRouteStateReducer();

    @Test
    public void exposesEveryDeterministicNonRouteState() {
        assertEquals(DeliveryRouteStatus.SIGNED_OUT, reducer.signedOut().getStatus());
        assertEquals(DeliveryRouteStatus.LOADING, reducer.loading().getStatus());
        assertEquals(DeliveryRouteStatus.EMPTY, reducer.empty().getStatus());
        assertEquals(
                DeliveryRouteStatus.DISABLED,
                reducer.disabled("session:opaque").getStatus()
        );
        assertEquals(DeliveryRouteStatus.UNSUPPORTED, reducer.unsupported().getStatus());
        assertEquals(
                DeliveryRouteStatus.ERROR,
                reducer.temporaryFailure(null, 20, "TEMPORARY").getStatus()
        );
    }

    @Test
    public void treatsTheExactTwoMinuteCacheBoundaryAsFresh() {
        DeliveryRouteSnapshot snapshot = TestDeliveryRoutes.snapshot(3, 1_000L);

        DeliveryRouteViewState exactBoundary = reducer.temporaryFailure(
                snapshot,
                1_000L + DeliveryRouteStateReducer.FRESH_CACHE_MILLIS,
                "session:opaque",
                "OFFLINE"
        );
        DeliveryRouteViewState oneMillisecondLater = reducer.temporaryFailure(
                snapshot,
                1_001L + DeliveryRouteStateReducer.FRESH_CACHE_MILLIS,
                "session:opaque",
                "OFFLINE"
        );

        assertEquals(DeliveryRouteStatus.FRESH_OFFLINE, exactBoundary.getStatus());
        assertTrue(exactBoundary.allowsNavigation());
        assertEquals(DeliveryRouteStatus.STALE_OFFLINE, oneMillisecondLater.getStatus());
        assertFalse(oneMillisecondLater.allowsNavigation());
    }

    @Test
    public void replacesTheWholeReadyRouteAtomically() {
        DeliveryRouteSnapshot snapshot = TestDeliveryRoutes.snapshot(8, 4_000L);

        DeliveryRouteViewState state = reducer.ready(snapshot, "session:opaque");

        assertEquals(DeliveryRouteStatus.READY, state.getStatus());
        assertEquals(snapshot.getRouteId(), state.getRouteId());
        assertEquals(Long.valueOf(8), state.getRouteRevision());
        assertEquals("session:opaque", state.getSessionBinding());
        assertEquals(snapshot.getStops(), state.getStops());
        assertTrue(state.allowsNavigation());
    }

    @Test
    public void routeModelsRejectInvalidNulls() {
        DeliveryStop stop = TestDeliveryRoutes.stop(1, true);
        assertThrows(
                NullPointerException.class,
                () -> new DeliveryRouteSnapshot(
                        null,
                        1,
                        null,
                        Collections.singletonList(stop),
                        "\"route-v1\"",
                        1_000L
                )
        );
        assertThrows(
                NullPointerException.class,
                () -> new DeliveryRouteSnapshot(
                        "route",
                        1,
                        null,
                        Collections.singletonList(null),
                        "\"route-v1\"",
                        1_000L
                )
        );
        assertThrows(
                NullPointerException.class,
                () -> new DeliveryRouteViewState(
                        null,
                        Collections.emptyList(),
                        null,
                        null
                )
        );
        assertThrows(
                NullPointerException.class,
                () -> new DeliveryRouteViewState(
                        DeliveryRouteStatus.LOADING,
                        Collections.singletonList(null),
                        null,
                        null
                )
        );
        assertThrows(
                NullPointerException.class,
                () -> new DeliveryStop(
                        null,
                        "delivery",
                        1,
                        "current",
                        "Dostava 1",
                        "Testna adresa 1",
                        45.8,
                        16.0,
                        null,
                        null,
                        null
                )
        );
        assertThrows(
                NullPointerException.class,
                () -> DeliveryRouteResponse.active(null)
        );
    }
}
