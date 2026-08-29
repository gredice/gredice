package com.gredice.dostava.data;

import com.gredice.dostava.auth.ApiFailure;
import com.gredice.dostava.auth.NativeSessionManager;

import java.util.Collections;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/** Fetches the server allowlist projection without persisting route/customer details. */
public final class NativeDeliveryStopRepository implements DeliveryStopRepository {
    private final NativeSessionManager sessionManager;
    private final DeliveryRouteApi routeApi;
    private final Executor executor;
    private final AtomicBoolean refreshInProgress = new AtomicBoolean();
    private final AtomicLong generation = new AtomicLong();
    private volatile List<DeliveryStop> stops = Collections.emptyList();
    private volatile DeliveryRouteStatus status;

    public NativeDeliveryStopRepository(
            NativeSessionManager sessionManager,
            DeliveryRouteApi routeApi,
            Executor executor
    ) {
        this.sessionManager = sessionManager;
        this.routeApi = routeApi;
        this.executor = executor;
        status = sessionManager.hasSession()
                ? DeliveryRouteStatus.LOADING
                : DeliveryRouteStatus.SIGNED_OUT;
    }

    @Override
    public List<DeliveryStop> getStops() {
        return stops;
    }

    @Override
    public DeliveryRouteStatus getStatus() {
        return status;
    }

    @Override
    public void refresh(Runnable onComplete) {
        long requestGeneration = generation.get();
        if (!sessionManager.hasSession()) {
            clear();
            onComplete.run();
            return;
        }
        if (!refreshInProgress.compareAndSet(false, true)) return;
        if (stops.isEmpty()) status = DeliveryRouteStatus.LOADING;
        executor.execute(() -> {
            try {
                List<DeliveryStop> nextStops = sessionManager.executeAuthorized(
                        routeApi::getActiveRoute
                );
                if (generation.get() == requestGeneration) {
                    stops = Collections.unmodifiableList(nextStops);
                    status = nextStops.isEmpty()
                            ? DeliveryRouteStatus.EMPTY
                            : DeliveryRouteStatus.READY;
                }
            } catch (ApiFailure failure) {
                if (generation.get() == requestGeneration) {
                    if (!sessionManager.hasSession()) {
                        clear();
                    } else {
                        status = DeliveryRouteStatus.ERROR;
                    }
                }
            } finally {
                refreshInProgress.set(false);
                onComplete.run();
            }
        });
    }

    @Override
    public void clear() {
        generation.incrementAndGet();
        stops = Collections.emptyList();
        status = DeliveryRouteStatus.SIGNED_OUT;
    }
}
