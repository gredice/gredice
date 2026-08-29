package com.gredice.dostava.car;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import com.gredice.dostava.data.DeliveryRouteStateReducer;
import com.gredice.dostava.data.DeliveryRouteViewState;
import com.gredice.dostava.data.DeliveryStopRepository;

import java.util.ArrayList;
import java.util.List;

import org.junit.Test;

public final class DeliveryRouteRefreshControllerTest {
    @Test
    public void refreshesOnStartAndResumeThenPollsOnlyWhileResumed() {
        FakeRepository repository = new FakeRepository();
        FakeScheduler scheduler = new FakeScheduler();
        int[] invalidations = {0};
        DeliveryRouteRefreshController controller = new DeliveryRouteRefreshController(
                repository,
                scheduler,
                () -> invalidations[0] += 1
        );

        controller.onStart();
        controller.onResume();

        assertEquals(2, repository.callbacks.size());
        repository.complete(0, true);
        assertEquals(1, invalidations[0]);
        assertNull(scheduler.task);

        repository.complete(0, false);
        assertEquals(DeliveryRouteRefreshController.REFRESH_INTERVAL_MILLIS, scheduler.delayMillis);

        scheduler.run();
        assertEquals(1, repository.callbacks.size());
        repository.complete(0, true);
        assertEquals(2, invalidations[0]);
    }

    @Test
    public void pauseCancelsPollingAndTheInFlightRepositoryWork() {
        FakeRepository repository = new FakeRepository();
        FakeScheduler scheduler = new FakeScheduler();
        DeliveryRouteRefreshController controller = new DeliveryRouteRefreshController(
                repository,
                scheduler,
                () -> { }
        );

        controller.onResume();
        repository.complete(0, false);
        controller.onPause();

        assertEquals(1, scheduler.cancelCount);
        assertEquals(1, repository.cancelCount);
        assertNull(scheduler.task);
    }

    private static final class FakeRepository implements DeliveryStopRepository {
        private final List<RefreshCallback> callbacks = new ArrayList<>();
        private int cancelCount;

        @Override
        public DeliveryRouteViewState getViewState() {
            return new DeliveryRouteStateReducer().loading();
        }

        @Override
        public void refresh(RefreshCallback onComplete) {
            callbacks.add(onComplete);
        }

        void complete(int index, boolean changed) {
            callbacks.remove(index).onComplete(changed);
        }

        @Override
        public void cancelRefresh() {
            cancelCount += 1;
            callbacks.clear();
        }

        @Override
        public void clear() { }
    }

    private static final class FakeScheduler implements DeliveryRouteRefreshController.Scheduler {
        private Runnable task;
        private long delayMillis;
        private int cancelCount;

        @Override
        public void replace(Runnable value, long delay) {
            task = value;
            delayMillis = delay;
        }

        @Override
        public void cancel() {
            task = null;
            cancelCount += 1;
        }

        void run() {
            Runnable value = task;
            task = null;
            value.run();
        }
    }
}
