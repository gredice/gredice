package com.gredice.dostava.car;

import android.os.Handler;
import android.os.Looper;

/** Main-loop delayed task used only while the car screen is resumed. */
final class HandlerRefreshScheduler implements DeliveryRouteRefreshController.Scheduler {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable scheduled;

    @Override
    public void replace(Runnable task, long delayMillis) {
        cancel();
        scheduled = task;
        handler.postDelayed(task, delayMillis);
    }

    @Override
    public void cancel() {
        if (scheduled != null) handler.removeCallbacks(scheduled);
        scheduled = null;
    }
}
