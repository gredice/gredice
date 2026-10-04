package com.gredice.dostava.car;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import com.gredice.dostava.data.DeliveryStop;

import java.time.Instant;

import org.junit.Test;

public final class DeliveryStopFormatterTest {
    private final DeliveryStopFormatter formatter = new DeliveryStopFormatter();

    @Test
    public void prefersRoundedUpTravelMinutes() {
        DeliveryStop stop = stop(Instant.parse("2026-08-29T10:30:00Z").toEpochMilli(), 61L, 400L);

        assertEquals("2 min", formatter.textMetric(stop));
        assertFalse(formatter.usesDistanceMetric(stop));
    }

    @Test
    public void fallsBackToCroatianLocalArrivalTime() {
        DeliveryStop stop = stop(Instant.parse("2026-08-29T10:30:00Z").toEpochMilli(), null, 400L);

        assertEquals("Dolazak 12:30", formatter.textMetric(stop));
        assertFalse(formatter.usesDistanceMetric(stop));
    }

    @Test
    public void usesDistanceOnlyWhenDurationAndEtaAreUnavailable() {
        DeliveryStop stop = stop(null, null, 400L);

        assertNull(formatter.textMetric(stop));
        assertTrue(formatter.usesDistanceMetric(stop));
    }

    @Test
    public void boundsExtremeDurationTextWithoutOverflowing() {
        assertEquals(
                "999+ min",
                formatter.textMetric(stop(null, Long.MAX_VALUE, null))
        );
    }

    private DeliveryStop stop(Long eta, Long travelSeconds, Long distanceMeters) {
        return new DeliveryStop(
                "delivery:opaque-1",
                "delivery",
                1,
                "current",
                "Dostava 1",
                "Testna adresa",
                45.8,
                16.0,
                eta,
                travelSeconds,
                distanceMeters
        );
    }
}
