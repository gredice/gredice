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
                "OFFLINE"
        );
        DeliveryRouteViewState oneMillisecondLater = reducer.temporaryFailure(
                snapshot,
                1_001L + DeliveryRouteStateReducer.FRESH_CACHE_MILLIS,
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

        DeliveryRouteViewState state = reducer.ready(snapshot);

        assertEquals(DeliveryRouteStatus.READY, state.getStatus());
        assertEquals(Long.valueOf(8), state.getRouteRevision());
        assertEquals(snapshot.getStops(), state.getStops());
        assertTrue(state.allowsNavigation());
    }

    @Test
    public void immutableRouteCopiesRejectNullStops() {
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
                        DeliveryRouteStatus.LOADING,
                        Collections.singletonList(null),
                        null,
                        null
                )
        );
    }
}
