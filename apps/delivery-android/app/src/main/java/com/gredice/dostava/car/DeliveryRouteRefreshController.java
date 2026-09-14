package com.gredice.dostava.car;

import com.gredice.dostava.data.DeliveryStopRepository;

import java.util.concurrent.Executor;

/** Keeps route revalidation active only while the root car screen is visible. */
final class DeliveryRouteRefreshController {
    static final long REFRESH_INTERVAL_MILLIS = 30_000L;

    private final DeliveryStopRepository repository;
    private final Scheduler scheduler;
    private final Executor callbackExecutor;
    private final Runnable invalidate;
    private volatile boolean resumed;

    DeliveryRouteRefreshController(
            DeliveryStopRepository repository,
            Scheduler scheduler,
            Executor callbackExecutor,
            Runnable invalidate
    ) {
        this.repository = repository;
        this.scheduler = scheduler;
        this.callbackExecutor = callbackExecutor;
        this.invalidate = invalidate;
    }

    void onStart() {
        refresh(false);
    }

    void onResume() {
        resumed = true;
        refresh(true);
    }

    void onPause() {
        stopVisibleWork();
    }

    void onStop() {
        stopVisibleWork();
    }

    void onDestroy() {
        stopVisibleWork();
    }

    void refreshNow() {
        refresh(resumed);
    }

    private void refresh(boolean scheduleNext) {
        repository.refresh(stateChanged -> callbackExecutor.execute(() -> {
            if (stateChanged) invalidate.run();
            if (scheduleNext && resumed) {
                scheduler.replace(this::poll, REFRESH_INTERVAL_MILLIS);
            }
        }));
    }

    private void poll() {
        if (resumed) refresh(true);
    }

    private void stopVisibleWork() {
        resumed = false;
        scheduler.cancel();
        repository.cancelRefresh();
    }

    interface Scheduler {
        void replace(Runnable task, long delayMillis);

        void cancel();
    }
}
