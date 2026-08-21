package com.gredice.dostava.navigation;

import java.util.Objects;

/** Suppresses repeated navigation launches while allowing an immediate retry after failure. */
public final class NavigationLaunchGate {
    static final long DEFAULT_SUPPRESSION_WINDOW_MILLIS = 1_500L;

    private final long suppressionWindowMillis;
    private boolean launchInProgress;
    private boolean hasSuccessfulLaunch;
    private long lastSuccessfulLaunchMillis;

    public NavigationLaunchGate() {
        this(DEFAULT_SUPPRESSION_WINDOW_MILLIS);
    }

    NavigationLaunchGate(long suppressionWindowMillis) {
        if (suppressionWindowMillis <= 0) {
            throw new IllegalArgumentException("Suppression window must be positive.");
        }
        this.suppressionWindowMillis = suppressionWindowMillis;
    }

    public boolean launchIfAllowed(
            long elapsedRealtimeMillis,
            Runnable launchAttempt
    ) {
        Objects.requireNonNull(launchAttempt, "Launch attempt is required.");
        if (!tryBegin(elapsedRealtimeMillis)) {
            return false;
        }

        try {
            launchAttempt.run();
        } catch (RuntimeException | Error failure) {
            markFailed();
            throw failure;
        }

        markSucceeded(elapsedRealtimeMillis);
        return true;
    }

    private synchronized boolean tryBegin(long elapsedRealtimeMillis) {
        if (launchInProgress) {
            return false;
        }
        if (hasSuccessfulLaunch) {
            long elapsedSinceSuccess =
                    elapsedRealtimeMillis - lastSuccessfulLaunchMillis;
            if (elapsedSinceSuccess >= 0
                    && elapsedSinceSuccess < suppressionWindowMillis) {
                return false;
            }
        }

        launchInProgress = true;
        return true;
    }

    private synchronized void markSucceeded(long elapsedRealtimeMillis) {
        launchInProgress = false;
        hasSuccessfulLaunch = true;
        lastSuccessfulLaunchMillis = elapsedRealtimeMillis;
    }

    private synchronized void markFailed() {
        launchInProgress = false;
    }
}
