package com.gredice.dostava.car;

import com.gredice.dostava.data.DeliveryStopRepository;

/** Keeps route revalidation active only while the root car screen is visible. */
final class DeliveryRouteRefreshController {
    static final long REFRESH_INTERVAL_MILLIS = 30_000L;

    private final DeliveryStopRepository repository;
    private final Scheduler scheduler;
    private final Runnable invalidate;
    private boolean resumed;

    DeliveryRouteRefreshController(
            DeliveryStopRepository repository,
            Scheduler scheduler,
            Runnable invalidate
    ) {
        this.repository = repository;
        this.scheduler = scheduler;
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
        repository.refresh(stateChanged -> {
            if (stateChanged) invalidate.run();
            if (scheduleNext && resumed) {
                scheduler.replace(this::poll, REFRESH_INTERVAL_MILLIS);
            }
        });
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
