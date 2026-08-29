package com.gredice.dostava.navigation;

import com.gredice.dostava.data.DeliveryRouteStatus;
import com.gredice.dostava.data.DeliveryRouteTelemetry;
import com.gredice.dostava.data.DeliveryRouteViewState;

import java.util.Objects;

/** Applies notification lifecycle policy without exposing route or destination data. */
public final class ActiveRouteReturnController {
    private final ActiveRouteReturnNotifier notifier;
    private final DeliveryRouteTelemetry telemetry;

    public ActiveRouteReturnController(
            ActiveRouteReturnNotifier notifier,
            DeliveryRouteTelemetry telemetry
    ) {
        this.notifier = Objects.requireNonNull(notifier, "notifier");
        this.telemetry = Objects.requireNonNull(telemetry, "telemetry");
    }

    public void initialize() {
        try {
            notifier.initializeChannel();
        } catch (RuntimeException failure) {
            recordFailure("CHANNEL_CREATE_FAILED");
        }
    }

    public void beforeNavigation(String sessionBinding, String routeId) {
        try {
            ActiveRouteReturnNotifier.PostResult result = notifier.postOrUpdate(
                    sessionBinding,
                    routeId
            );
            if (result == ActiveRouteReturnNotifier.PostResult.POSTED) {
                record(DeliveryRouteTelemetry.QuickReturnEvent.POSTED, null);
            } else if (result == ActiveRouteReturnNotifier.PostResult.DISABLED) {
                recordFailure("NOTIFICATIONS_DISABLED");
            }
        } catch (SecurityException failure) {
            recordFailure("POST_SECURITY_FAILED");
        } catch (RuntimeException failure) {
            recordFailure("POST_FAILED");
        }
    }

    public void reconcile(DeliveryRouteViewState route) {
        Objects.requireNonNull(route, "route");
        DeliveryRouteStatus status = route.getStatus();
        if (status == DeliveryRouteStatus.SIGNED_OUT
                || status == DeliveryRouteStatus.EMPTY
                || status == DeliveryRouteStatus.DISABLED
                || status == DeliveryRouteStatus.UNSUPPORTED) {
            cancel();
            return;
        }
        String sessionBinding = route.getSessionBinding();
        if (sessionBinding == null) return;
        String routeId = route.getRouteId();
        String comparableRouteId = status == DeliveryRouteStatus.READY
                || status == DeliveryRouteStatus.FRESH_OFFLINE
                || status == DeliveryRouteStatus.STALE_OFFLINE
                ? routeId
                : null;
        try {
            if (!notifier.matchesActiveIdentity(
                    sessionBinding,
                    comparableRouteId
            )) {
                cancel();
            }
        } catch (RuntimeException failure) {
            recordFailure("STATE_READ_FAILED");
        }
    }

    public void cancelAfterFailedNavigation() {
        cancel();
    }

    public void cancelForLogout() {
        cancel();
    }

    public void onTapped() {
        record(DeliveryRouteTelemetry.QuickReturnEvent.TAPPED, null);
    }

    private void cancel() {
        try {
            if (notifier.cancel()) {
                record(DeliveryRouteTelemetry.QuickReturnEvent.CANCELED, null);
            }
        } catch (SecurityException failure) {
            recordFailure("CANCEL_SECURITY_FAILED");
        } catch (RuntimeException failure) {
            recordFailure("CANCEL_FAILED");
        }
    }

    private void recordFailure(String errorCode) {
        record(DeliveryRouteTelemetry.QuickReturnEvent.FAILURE, errorCode);
    }

    private void record(
            DeliveryRouteTelemetry.QuickReturnEvent event,
            String errorCode
    ) {
        try {
            telemetry.recordQuickReturnNotification(event, errorCode);
        } catch (RuntimeException ignored) {
            // Operational telemetry must never affect notification or navigation.
        }
    }
}
