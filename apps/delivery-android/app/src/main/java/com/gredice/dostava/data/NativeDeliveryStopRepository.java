package com.gredice.dostava.data;

import com.gredice.dostava.auth.ApiFailure;
import com.gredice.dostava.auth.NativeSessionManager;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;

/** Coordinates ETag refreshes and one encrypted, bounded active-route snapshot. */
public final class NativeDeliveryStopRepository implements DeliveryStopRepository {
    private final NativeSessionManager sessionManager;
    private final DeliveryRouteApi routeApi;
    private final DeliveryRouteCache routeCache;
    private final ExecutorService executor;
    private final Clock clock;
    private final DeliveryRouteTelemetry telemetry;
    private final DeliveryRouteStateReducer reducer = new DeliveryRouteStateReducer();
    private final List<RefreshCallback> pendingCallbacks = new ArrayList<>();
    private long generation;
    private long activeRequestId;
    private Future<?> activeRequest;
    private DeliveryRouteSnapshot snapshot;
    private DeliveryRouteViewState viewState;

    public NativeDeliveryStopRepository(
            NativeSessionManager sessionManager,
            DeliveryRouteApi routeApi,
            DeliveryRouteCache routeCache,
            ExecutorService executor,
            Clock clock,
            DeliveryRouteTelemetry telemetry
    ) {
        this.sessionManager = sessionManager;
        this.routeApi = routeApi;
        this.routeCache = routeCache;
        this.executor = executor;
        this.clock = clock;
        this.telemetry = telemetry;
        if (!sessionManager.hasSession()) {
            routeCache.clear();
            viewState = reducer.signedOut();
            return;
        }
        snapshot = routeCache.read();
        viewState = snapshot == null
                ? reducer.loading()
                : reducer.restored(snapshot, clock.nowMillis());
    }

    public NativeDeliveryStopRepository(
            NativeSessionManager sessionManager,
            DeliveryRouteApi routeApi,
            DeliveryRouteCache routeCache,
            ExecutorService executor,
            Clock clock
    ) {
        this(
                sessionManager,
                routeApi,
                routeCache,
                executor,
                clock,
                new NoOpDeliveryRouteTelemetry()
        );
    }

    public NativeDeliveryStopRepository(
            NativeSessionManager sessionManager,
            DeliveryRouteApi routeApi,
            DeliveryRouteCache routeCache,
            ExecutorService executor
    ) {
        this(
                sessionManager,
                routeApi,
                routeCache,
                executor,
                System::currentTimeMillis,
                new NoOpDeliveryRouteTelemetry()
        );
    }

    @Override
    public synchronized DeliveryRouteViewState getViewState() {
        if ((viewState.getStatus() == DeliveryRouteStatus.READY
                || viewState.getStatus() == DeliveryRouteStatus.FRESH_OFFLINE)
                && snapshot != null
                && clock.nowMillis() - snapshot.getVerifiedAtMillis()
                > DeliveryRouteStateReducer.FRESH_CACHE_MILLIS) {
            viewState = reducer.temporaryFailure(
                    snapshot,
                    clock.nowMillis(),
                    viewState.getErrorCode() == null
                            ? "CACHE_EXPIRED"
                            : viewState.getErrorCode()
            );
        }
        return viewState;
    }

    @Override
    public void refresh(RefreshCallback onComplete) {
        boolean signedOutChanged = false;
        synchronized (this) {
            if (!sessionManager.hasSession()) {
                signedOutChanged = applySignedOut();
            } else if (activeRequestId != 0) {
                pendingCallbacks.add(onComplete);
                return;
            } else {
                if (snapshot == null) viewState = reducer.loading();
                long requestId = ++generation;
                activeRequestId = requestId;
                pendingCallbacks.add(onComplete);
                String etag = snapshot == null ? null : snapshot.getEtag();
                long startedAtMillis = clock.nowMillis();
                try {
                    activeRequest = executor.submit(
                            () -> load(requestId, etag, startedAtMillis)
                    );
                } catch (RejectedExecutionException failure) {
                    activeRequestId = 0;
                    pendingCallbacks.clear();
                    DeliveryRouteViewState previous = viewState;
                    viewState = reducer.temporaryFailure(
                            snapshot,
                            clock.nowMillis(),
                            "ROUTE_REFRESH_REJECTED"
                    );
                    onComplete.onComplete(!previous.equals(viewState));
                }
                return;
            }
        }
        onComplete.onComplete(signedOutChanged);
    }

    private void load(long requestId, String etag, long startedAtMillis) {
        boolean stateChanged = false;
        DeliveryRouteViewState previous = null;
        DeliveryRouteTelemetry.CacheStatus cacheStatus =
                DeliveryRouteTelemetry.CacheStatus.NONE;
        try {
            DeliveryRouteResponse response = sessionManager.executeAuthorized(
                    accessToken -> routeApi.getActiveRoute(accessToken, etag)
            );
            synchronized (this) {
                if (activeRequestId != requestId) return;
                previous = viewState;
                cacheStatus = cacheStatus(response);
                applyResponse(response);
                stateChanged = !previous.equals(viewState);
            }
        } catch (ApiFailure failure) {
            synchronized (this) {
                if (activeRequestId != requestId) return;
                previous = viewState;
                applyFailure(failure.getErrorCode());
                cacheStatus = fallbackCacheStatus();
                stateChanged = !previous.equals(viewState);
            }
        } catch (RuntimeException failure) {
            synchronized (this) {
                if (activeRequestId != requestId) return;
                previous = viewState;
                viewState = reducer.temporaryFailure(
                        snapshot,
                        clock.nowMillis(),
                        "ROUTE_TEMPORARILY_UNAVAILABLE"
                );
                cacheStatus = fallbackCacheStatus();
                stateChanged = !previous.equals(viewState);
            }
        } finally {
            if (previous != null) {
                telemetry.recordTransition(
                        previous.getStatus(),
                        getViewState().getStatus(),
                        latencyBucket(clock.nowMillis() - startedAtMillis),
                        getViewState().getRouteRevision(),
                        cacheStatus,
                        getViewState().getErrorCode()
                );
            }
            complete(requestId, stateChanged);
        }
    }

    private DeliveryRouteTelemetry.CacheStatus cacheStatus(
            DeliveryRouteResponse response
    ) {
        if (response.getKind() == DeliveryRouteResponse.Kind.NOT_MODIFIED) {
            return DeliveryRouteTelemetry.CacheStatus.REVALIDATED;
        }
        if (response.getKind() == DeliveryRouteResponse.Kind.ACTIVE) {
            return DeliveryRouteTelemetry.CacheStatus.REPLACED;
        }
        return DeliveryRouteTelemetry.CacheStatus.NONE;
    }

    private DeliveryRouteTelemetry.CacheStatus fallbackCacheStatus() {
        if (viewState.getStatus() == DeliveryRouteStatus.FRESH_OFFLINE) {
            return DeliveryRouteTelemetry.CacheStatus.FRESH_FALLBACK;
        }
        if (viewState.getStatus() == DeliveryRouteStatus.STALE_OFFLINE) {
            return DeliveryRouteTelemetry.CacheStatus.STALE_FALLBACK;
        }
        return DeliveryRouteTelemetry.CacheStatus.NONE;
    }

    private DeliveryRouteTelemetry.LatencyBucket latencyBucket(long millis) {
        long boundedMillis = Math.max(0, millis);
        if (boundedMillis < 250) {
            return DeliveryRouteTelemetry.LatencyBucket.UNDER_250_MS;
        }
        if (boundedMillis < 1_000) {
            return DeliveryRouteTelemetry.LatencyBucket.UNDER_1_SECOND;
        }
        if (boundedMillis < 5_000) {
            return DeliveryRouteTelemetry.LatencyBucket.UNDER_5_SECONDS;
        }
        if (boundedMillis < 15_000) {
            return DeliveryRouteTelemetry.LatencyBucket.UNDER_15_SECONDS;
        }
        return DeliveryRouteTelemetry.LatencyBucket.AT_LEAST_15_SECONDS;
    }

    private void applyResponse(DeliveryRouteResponse response) {
        if (response.getKind() == DeliveryRouteResponse.Kind.EMPTY) {
            snapshot = null;
            routeCache.clear();
            viewState = reducer.empty();
            return;
        }
        if (response.getKind() == DeliveryRouteResponse.Kind.NOT_MODIFIED) {
            if (snapshot == null) {
                routeCache.clear();
                viewState = reducer.unsupported();
                return;
            }
            snapshot = snapshot.verifiedAt(clock.nowMillis());
        } else {
            snapshot = response.getSnapshot();
        }
        if (snapshot.getStops().isEmpty()) {
            snapshot = null;
            routeCache.clear();
            viewState = reducer.empty();
            return;
        }
        writeCacheSafely(snapshot);
        viewState = reducer.ready(snapshot);
    }

    private void applyFailure(String errorCode) {
        if (!sessionManager.hasSession()) {
            applySignedOut();
            return;
        }
        if ("ROUTE_RESPONSE_UNSUPPORTED".equals(errorCode)
                || "ROUTE_RESPONSE_INVALID".equals(errorCode)) {
            snapshot = null;
            routeCache.clear();
            viewState = reducer.unsupported();
            return;
        }
        viewState = reducer.temporaryFailure(
                snapshot,
                clock.nowMillis(),
                errorCode
        );
    }

    private void complete(long requestId, boolean stateChanged) {
        List<RefreshCallback> callbacks;
        synchronized (this) {
            if (activeRequestId != requestId) return;
            activeRequestId = 0;
            activeRequest = null;
            callbacks = new ArrayList<>(pendingCallbacks);
            pendingCallbacks.clear();
        }
        for (int index = 0; index < callbacks.size(); index++) {
            callbacks.get(index).onComplete(stateChanged && index == 0);
        }
    }

    private void writeCacheSafely(DeliveryRouteSnapshot value) {
        try {
            routeCache.write(value);
        } catch (RuntimeException ignored) {
            // A usable in-memory route must not be lost because offline recovery failed.
        }
    }

    @Override
    public synchronized void cancelRefresh() {
        generation += 1;
        activeRequestId = 0;
        pendingCallbacks.clear();
        if (activeRequest != null) activeRequest.cancel(true);
        activeRequest = null;
        if (viewState.getStatus() == DeliveryRouteStatus.READY
                && snapshot != null) {
            viewState = reducer.restored(snapshot, clock.nowMillis());
        }
    }

    @Override
    public synchronized void clear() {
        cancelRefresh();
        applySignedOut();
    }

    private boolean applySignedOut() {
        DeliveryRouteViewState previous = viewState;
        snapshot = null;
        routeCache.clear();
        viewState = reducer.signedOut();
        return previous == null || !previous.equals(viewState);
    }

    public interface Clock {
        long nowMillis();
    }
}
