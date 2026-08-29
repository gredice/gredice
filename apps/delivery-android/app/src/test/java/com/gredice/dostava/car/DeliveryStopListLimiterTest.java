package com.gredice.dostava.car;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;

import com.gredice.dostava.data.DeliveryStop;

import java.util.ArrayList;
import java.util.List;

import org.junit.Test;

public final class DeliveryStopListLimiterTest {
    private final DeliveryStopListLimiter limiter = new DeliveryStopListLimiter();

    @Test
    public void obeysTheHostLimitAndAlwaysRetainsTheCurrentFirstRow() {
        List<DeliveryStop> stops = stops(5);

        List<DeliveryStop> one = limiter.limit(stops, 0);
        List<DeliveryStop> three = limiter.limit(stops, 3);

        assertEquals(1, one.size());
        assertSame(stops.get(0), one.get(0));
        assertEquals(3, three.size());
        assertSame(stops.get(0), three.get(0));
    }

    @Test
    public void neverExceedsTheServerProjectionLimit() {
        assertEquals(5, limiter.limit(stops(6), 20).size());
    }

    private List<DeliveryStop> stops(int count) {
        List<DeliveryStop> result = new ArrayList<>();
        for (int sequence = 1; sequence <= count; sequence++) {
            result.add(new DeliveryStop(
                    "delivery:opaque-" + sequence,
                    "delivery",
                    sequence,
                    sequence == 1 ? "current" : "upcoming",
                    "Dostava " + sequence,
                    "Testna adresa " + sequence,
                    45.8,
                    16.0,
                    null,
                    null,
                    null
            ));
        }
        return result;
    }
}
