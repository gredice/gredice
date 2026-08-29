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
    private boolean storageInitialized;
    private String sessionBinding;
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
        viewState = reducer.loading();
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
                    sessionBinding,
                    viewState.getErrorCode() == null
                            ? "CACHE_EXPIRED"
                            : viewState.getErrorCode()
            );
        }
        return viewState;
    }

    @Override
    public void refresh(RefreshCallback onComplete) {
        synchronized (this) {
            if (activeRequestId != 0) {
                pendingCallbacks.add(onComplete);
                return;
            }
            if (snapshot == null) viewState = reducer.loading();
            long requestId = ++generation;
            activeRequestId = requestId;
            pendingCallbacks.add(onComplete);
            long startedAtMillis = clock.nowMillis();
            try {
                activeRequest = executor.submit(
                        () -> load(requestId, startedAtMillis)
                );
            } catch (RejectedExecutionException failure) {
                activeRequestId = 0;
                pendingCallbacks.clear();
                DeliveryRouteViewState previous = viewState;
                viewState = reducer.temporaryFailure(
                        snapshot,
                        clock.nowMillis(),
                        sessionBinding,
                        "ROUTE_REFRESH_REJECTED"
                );
                onComplete.onComplete(!previous.equals(viewState));
            }
        }
    }

    private void load(long requestId, long startedAtMillis) {
        boolean stateChanged = false;
        DeliveryRouteViewState previous = null;
        DeliveryRouteTelemetry.CacheStatus cacheStatus =
                DeliveryRouteTelemetry.CacheStatus.NONE;
        try {
            if (!sessionManager.hasSession()) {
                synchronized (this) {
                    if (activeRequestId != requestId) return;
                    previous = viewState;
                    applySignedOut();
                    stateChanged = !previous.equals(viewState);
                }
                return;
            }
            String loadedSessionBinding = sessionManager.getSessionBinding();
            if (loadedSessionBinding == null) {
                synchronized (this) {
                    if (activeRequestId != requestId) return;
                    previous = viewState;
                    applySignedOut();
                    stateChanged = !previous.equals(viewState);
                }
                return;
            }
            synchronized (this) {
                if (activeRequestId != requestId) return;
                sessionBinding = loadedSessionBinding;
            }
            restoreCachedRoute(requestId);
            String etag;
            synchronized (this) {
                if (activeRequestId != requestId) return;
                etag = snapshot == null ? null : snapshot.getEtag();
            }
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
                        sessionBinding,
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

    private void restoreCachedRoute(long requestId) {
        synchronized (this) {
            if (activeRequestId != requestId || storageInitialized) return;
        }
        DeliveryRouteSnapshot restored = routeCache.read();
        synchronized (this) {
            if (activeRequestId != requestId || storageInitialized) return;
            storageInitialized = true;
            snapshot = restored;
            if (snapshot != null) {
                viewState = reducer.restored(
                        snapshot,
                        clock.nowMillis(),
                        sessionBinding
                );
            }
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
        storageInitialized = true;
        if (response.getKind() == DeliveryRouteResponse.Kind.EMPTY) {
            snapshot = null;
            routeCache.clear();
            viewState = reducer.empty(sessionBinding);
            return;
        }
        if (response.getKind() == DeliveryRouteResponse.Kind.NOT_MODIFIED) {
            if (snapshot == null) {
                routeCache.clear();
                viewState = reducer.unsupported(sessionBinding);
                return;
            }
            snapshot = snapshot.verifiedAt(clock.nowMillis());
        } else {
            snapshot = response.getSnapshot();
        }
        if (snapshot.getStops().isEmpty()) {
            snapshot = null;
            routeCache.clear();
            viewState = reducer.empty(sessionBinding);
            return;
        }
        writeCacheSafely(snapshot);
        viewState = reducer.ready(snapshot, sessionBinding);
    }

    private void applyFailure(String errorCode) {
        if (!sessionManager.hasSession()) {
            applySignedOut();
            return;
        }
        if ("ANDROID_AUTO_DISABLED".equals(errorCode)) {
            snapshot = null;
            viewState = reducer.disabled(sessionBinding);
            clearCacheSafely();
            return;
        }
        if ("ROUTE_RESPONSE_UNSUPPORTED".equals(errorCode)
                || "ROUTE_RESPONSE_INVALID".equals(errorCode)) {
            snapshot = null;
            routeCache.clear();
            viewState = reducer.unsupported(sessionBinding);
            return;
        }
        viewState = reducer.temporaryFailure(
                snapshot,
                clock.nowMillis(),
                sessionBinding,
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

    private void clearCacheSafely() {
        try {
            routeCache.clear();
        } catch (RuntimeException ignored) {
            // The authoritative in-memory terminal state must survive storage failure.
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
            viewState = reducer.restored(
                    snapshot,
                    clock.nowMillis(),
                    sessionBinding
            );
        }
    }

    @Override
    public synchronized void clear() {
        cancelRefresh();
        applySignedOut();
    }

    private boolean applySignedOut() {
        DeliveryRouteViewState previous = viewState;
        storageInitialized = true;
        sessionBinding = null;
        snapshot = null;
        routeCache.clear();
        viewState = reducer.signedOut();
        return previous == null || !previous.equals(viewState);
    }

    public interface Clock {
        long nowMillis();
    }
}
