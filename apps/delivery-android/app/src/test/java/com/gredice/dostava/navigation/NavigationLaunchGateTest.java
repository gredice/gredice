package com.gredice.dostava.navigation;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.Test;

public final class NavigationLaunchGateTest {
    @Test
    public void suppressesRapidRepeatedLaunchesUntilTheWindowEnds() {
        NavigationLaunchGate gate = new NavigationLaunchGate(1_500L);
        AtomicInteger launchCount = new AtomicInteger();

        assertTrue(gate.launchIfAllowed(10_000L, launchCount::incrementAndGet));
        assertFalse(gate.launchIfAllowed(11_499L, launchCount::incrementAndGet));
        assertTrue(gate.launchIfAllowed(11_500L, launchCount::incrementAndGet));
        assertEquals(2, launchCount.get());
    }

    @Test
    public void permitsImmediateRetryAfterTheLaunchAttemptFails() {
        NavigationLaunchGate gate = new NavigationLaunchGate(1_500L);
        RuntimeException noHandler = new RuntimeException("No navigation handler");
        AtomicInteger launchCount = new AtomicInteger();

        assertThrows(
                RuntimeException.class,
                () -> gate.launchIfAllowed(10_000L, () -> {
                    launchCount.incrementAndGet();
                    throw noHandler;
                })
        );

        assertTrue(gate.launchIfAllowed(10_000L, launchCount::incrementAndGet));
        assertEquals(2, launchCount.get());
    }

    @Test
    public void permitsOnlyOneLaunchWhileAnAttemptIsInProgress() {
        NavigationLaunchGate gate = new NavigationLaunchGate(1_500L);
        AtomicBoolean nestedLaunchAllowed = new AtomicBoolean(true);
        AtomicInteger launchCount = new AtomicInteger();

        assertTrue(gate.launchIfAllowed(10_000L, () -> {
            launchCount.incrementAndGet();
            nestedLaunchAllowed.set(
                    gate.launchIfAllowed(10_000L, launchCount::incrementAndGet)
            );
        }));

        assertFalse(nestedLaunchAllowed.get());
        assertEquals(1, launchCount.get());
    }
}
