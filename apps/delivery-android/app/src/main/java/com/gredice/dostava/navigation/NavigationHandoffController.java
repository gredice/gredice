package com.gredice.dostava.navigation;

import com.gredice.dostava.data.DeliveryRouteStatus;
import com.gredice.dostava.data.DeliveryRouteTelemetry;
import com.gredice.dostava.data.DeliveryRouteViewState;

import java.util.Objects;

/** Performs one read-only navigator handoff and reconciles its process marker. */
public final class NavigationHandoffController {
    private final NavigationLaunchGate launchGate;
    private final NavigationHandoffStore store;
    private final DeliveryRouteTelemetry telemetry;
    private final ActiveRouteReturnController quickReturnController;

    public NavigationHandoffController(
            NavigationHandoffStore store,
            DeliveryRouteTelemetry telemetry
    ) {
        this(
                new NavigationLaunchGate(),
                store,
                telemetry,
                new ActiveRouteReturnController(
                        ActiveRouteReturnNotifier.NO_OP,
                        telemetry
                )
        );
    }

    public NavigationHandoffController(
            NavigationHandoffStore store,
            DeliveryRouteTelemetry telemetry,
            ActiveRouteReturnController quickReturnController
    ) {
        this(
                new NavigationLaunchGate(),
                store,
                telemetry,
                quickReturnController
        );
    }

    NavigationHandoffController(
            NavigationLaunchGate launchGate,
            NavigationHandoffStore store,
            DeliveryRouteTelemetry telemetry
    ) {
        this(
                launchGate,
                store,
                telemetry,
                new ActiveRouteReturnController(
                        ActiveRouteReturnNotifier.NO_OP,
                        telemetry
                )
        );
    }

    NavigationHandoffController(
            NavigationLaunchGate launchGate,
            NavigationHandoffStore store,
            DeliveryRouteTelemetry telemetry,
            ActiveRouteReturnController quickReturnController
    ) {
        this.launchGate = Objects.requireNonNull(launchGate, "launchGate");
        this.store = Objects.requireNonNull(store, "store");
        this.telemetry = Objects.requireNonNull(telemetry, "telemetry");
        this.quickReturnController = Objects.requireNonNull(
                quickReturnController,
                "quickReturnController"
        );
    }

    public Result launch(
            NavigationTarget target,
            String sessionBinding,
            long elapsedRealtimeMillis,
            long wallClockMillis,
            Launcher launcher
    ) {
        Objects.requireNonNull(target, "target");
        Objects.requireNonNull(launcher, "launcher");
        if (sessionBinding == null || sessionBinding.isEmpty()) {
            return record(target, Result.INVALID_TARGET);
        }
        try {
            boolean launched = launchGate.launchIfAllowed(
                    elapsedRealtimeMillis,
                    () -> performLaunch(target, sessionBinding, wallClockMillis, launcher)
            );
            return record(target, launched ? Result.LAUNCHED : Result.SUPPRESSED);
        } catch (LaunchFailure failure) {
            quickReturnController.cancelAfterFailedNavigation();
            clearSafely();
            return record(target, failure.getResult());
        } catch (IllegalArgumentException failure) {
            quickReturnController.cancelAfterFailedNavigation();
            clearSafely();
            return record(target, Result.MALFORMED_URI);
        } catch (RuntimeException failure) {
            quickReturnController.cancelAfterFailedNavigation();
            clearSafely();
            return record(target, Result.UNEXPECTED_FAILURE);
        }
    }

    public void reconcile(DeliveryRouteViewState route) {
        Objects.requireNonNull(route, "route");
        DeliveryRouteStatus status = route.getStatus();
        PendingNavigationHandoff pending = readSafely();
        quickReturnController.reconcile(route);
        if (status == DeliveryRouteStatus.SIGNED_OUT
                || status == DeliveryRouteStatus.EMPTY
                || status == DeliveryRouteStatus.DISABLED
                || status == DeliveryRouteStatus.UNSUPPORTED) {
            clearSafely();
            return;
        }

        if (pending == null) return;
        String sessionBinding = route.getSessionBinding();
        if (sessionBinding != null
                && !sessionBinding.equals(pending.getSessionBinding())) {
            clearSafely();
            return;
        }
        if ((status == DeliveryRouteStatus.READY
                || status == DeliveryRouteStatus.FRESH_OFFLINE
                || status == DeliveryRouteStatus.STALE_OFFLINE)
                && (route.getRouteId() == null
                || route.getRouteRevision() == null
                || sessionBinding == null
                || !pending.belongsTo(
                        sessionBinding,
                        route.getRouteId(),
                        route.getRouteRevision()
                ))) {
            clearSafely();
        }
    }

    private void performLaunch(
            NavigationTarget target,
            String sessionBinding,
            long wallClockMillis,
            Launcher launcher
    ) {
        PendingNavigationHandoff pending = PendingNavigationHandoff.from(
                sessionBinding,
                target,
                wallClockMillis
        );
        try {
            store.write(pending);
        } catch (RuntimeException failure) {
            throw new LaunchFailure(Result.STORAGE_FAILURE, failure);
        }
        quickReturnController.beforeNavigation(
                sessionBinding,
                target.getRouteId()
        );
        launcher.launch(NavigationUri.forCoordinates(
                target.getLatitude(),
                target.getLongitude()
        ));
    }

    private Result record(NavigationTarget target, Result result) {
        try {
            telemetry.recordNavigationHandoff(
                    target.getRouteRevision(),
                    target.getNavigationId(),
                    target.getKind(),
                    result.name()
            );
        } catch (RuntimeException ignored) {
            // Operational telemetry must never break or duplicate the handoff.
        }
        return result;
    }

    private PendingNavigationHandoff readSafely() {
        try {
            return store.read();
        } catch (RuntimeException failure) {
            clearSafely();
            return null;
        }
    }

    private void clearSafely() {
        try {
            store.clear();
        } catch (RuntimeException ignored) {
            // The in-memory route remains usable even if metadata cleanup fails.
        }
    }

    public interface Launcher {
        void launch(String uri);
    }

    public enum Result {
        LAUNCHED,
        SUPPRESSED,
        INVALID_TARGET,
        NO_HANDLER,
        HOST_FAILURE,
        SECURITY_FAILURE,
        STORAGE_FAILURE,
        MALFORMED_URI,
        UNEXPECTED_FAILURE;

        public boolean shouldNotifyUser() {
            return this != LAUNCHED && this != SUPPRESSED;
        }
    }

    public static final class LaunchFailure extends RuntimeException {
        private final Result result;

        public LaunchFailure(Result result, Throwable cause) {
            super(result.name(), cause);
            if (!result.shouldNotifyUser()) {
                throw new IllegalArgumentException("Launch failure requires an error result");
            }
            this.result = result;
        }

        Result getResult() {
            return result;
        }
    }
}
