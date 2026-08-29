package com.gredice.dostava.data;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import com.gredice.dostava.auth.ApiFailure;
import com.gredice.dostava.auth.NativeAuthApi;
import com.gredice.dostava.auth.NativeCredentialStore;
import com.gredice.dostava.auth.NativeSessionManager;
import com.gredice.dostava.auth.NativeTokenResponse;
import com.gredice.dostava.auth.PairingRequest;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.AbstractExecutorService;
import java.util.concurrent.TimeUnit;

import org.junit.Test;

public final class NativeDeliveryStopRepositoryTest {
    @Test
    public void restoresFreshCacheAndAgesItToStaleAtRuntime() {
        Fixture fixture = new Fixture(100_000L, TestDeliveryRoutes.snapshot(1, 0));
        fixture.api.enqueue(new ApiFailure(503, "ROUTE_TEMPORARILY_UNAVAILABLE"));

        assertEquals(DeliveryRouteStatus.LOADING, fixture.repository.getViewState().getStatus());
        assertEquals(0, fixture.store.readCount);
        assertEquals(0, fixture.cache.readCount);

        fixture.repository.refresh(changed -> { });
        assertEquals(0, fixture.store.readCount);
        assertEquals(0, fixture.cache.readCount);
        fixture.executor.runNext();

        assertEquals(
                DeliveryRouteStatus.FRESH_OFFLINE,
                fixture.repository.getViewState().getStatus()
        );
        assertTrue(fixture.store.readCount > 0);
        assertEquals(1, fixture.cache.readCount);

        fixture.clock.nowMillis = DeliveryRouteStateReducer.FRESH_CACHE_MILLIS + 1;

        assertEquals(
                DeliveryRouteStatus.STALE_OFFLINE,
                fixture.repository.getViewState().getStatus()
        );
    }

    @Test
    public void coalescesConcurrentRefreshesAndReplacesTheWholeRoute() {
        Fixture fixture = new Fixture(5_000L, null);
        fixture.api.enqueue(DeliveryRouteResponse.active(
                TestDeliveryRoutes.snapshot(2, 5_000L)
        ));
        List<Boolean> callbacks = new ArrayList<>();

        fixture.repository.refresh(callbacks::add);
        fixture.repository.refresh(callbacks::add);

        assertEquals(1, fixture.executor.pendingCount());
        fixture.executor.runNext();

        assertEquals(1, fixture.api.callCount);
        assertEquals(List.of(true, false), callbacks);
        assertEquals(
                DeliveryRouteStatus.READY,
                fixture.repository.getViewState().getStatus()
        );
        assertEquals(
                Long.valueOf(2),
                fixture.repository.getViewState().getRouteRevision()
        );
        assertEquals(
                "pickup:opaque-2",
                fixture.repository.getViewState().getStops().get(1).getNavigationId()
        );
        assertEquals(DeliveryRouteStatus.LOADING, fixture.telemetry.from);
        assertEquals(DeliveryRouteStatus.READY, fixture.telemetry.to);
        assertEquals(
                DeliveryRouteTelemetry.CacheStatus.REPLACED,
                fixture.telemetry.cacheStatus
        );
        assertEquals(
                DeliveryRouteTelemetry.LatencyBucket.UNDER_250_MS,
                fixture.telemetry.latency
        );
    }

    @Test
    public void sendsTheCachedEtagAndUses304ToRenewFreshness() {
        DeliveryRouteSnapshot cached = TestDeliveryRoutes.snapshot(4, 0);
        Fixture fixture = new Fixture(200_000L, cached);
        fixture.api.enqueue(DeliveryRouteResponse.notModified());

        fixture.repository.refresh(changed -> { });
        fixture.executor.runNext();

        assertEquals(List.of(cached.getEtag()), fixture.api.etags);
        assertEquals(
                DeliveryRouteStatus.READY,
                fixture.repository.getViewState().getStatus()
        );
        assertEquals(200_000L, fixture.cache.snapshot.getVerifiedAtMillis());
    }

    @Test
    public void changedRevisionAtomicallyRemovesEveryOldRow() {
        Fixture fixture = new Fixture(10_000L, TestDeliveryRoutes.snapshot(1, 0));
        DeliveryStop newCurrent = TestDeliveryRoutes.stop(3, true);
        DeliveryRouteSnapshot replacement = new DeliveryRouteSnapshot(
                "route-new",
                2,
                newCurrent.getNavigationId(),
                List.of(newCurrent, TestDeliveryRoutes.stop(4, false)),
                "\"replacement\"",
                10_000L
        );
        fixture.api.enqueue(DeliveryRouteResponse.active(replacement));

        fixture.repository.refresh(changed -> { });
        fixture.executor.runNext();

        assertEquals(replacement.getStops(), fixture.repository.getViewState().getStops());
        assertEquals("delivery:opaque-3", fixture.repository.getViewState()
                .getStops().get(0).getNavigationId());
        assertEquals("pickup:opaque-4", fixture.repository.getViewState()
                .getStops().get(1).getNavigationId());
    }

    @Test
    public void retainsOnlyAFreshCacheAfterATemporaryFailure() {
        Fixture fixture = new Fixture(60_000L, TestDeliveryRoutes.snapshot(5, 0));
        fixture.api.enqueue(new ApiFailure(503, "ROUTE_TEMPORARILY_UNAVAILABLE"));

        fixture.repository.refresh(changed -> { });
        fixture.executor.runNext();

        assertEquals(
                DeliveryRouteStatus.FRESH_OFFLINE,
                fixture.repository.getViewState().getStatus()
        );
        fixture.clock.nowMillis = DeliveryRouteStateReducer.FRESH_CACHE_MILLIS + 1;
        assertEquals(
                DeliveryRouteStatus.STALE_OFFLINE,
                fixture.repository.getViewState().getStatus()
        );
    }

    @Test
    public void noRouteAndUnsupportedContractClearTheCache() {
        Fixture noRoute = new Fixture(10_000L, TestDeliveryRoutes.snapshot(1, 0));
        noRoute.api.enqueue(DeliveryRouteResponse.empty());
        noRoute.repository.refresh(changed -> { });
        noRoute.executor.runNext();

        assertEquals(DeliveryRouteStatus.EMPTY, noRoute.repository.getViewState().getStatus());
        assertNull(noRoute.cache.snapshot);
        assertTrue(noRoute.cache.clearCount > 0);

        Fixture unsupported = new Fixture(10_000L, TestDeliveryRoutes.snapshot(1, 0));
        unsupported.api.enqueue(new ApiFailure(422, "ROUTE_RESPONSE_UNSUPPORTED"));
        unsupported.repository.refresh(changed -> { });
        unsupported.executor.runNext();

        assertEquals(
                DeliveryRouteStatus.UNSUPPORTED,
                unsupported.repository.getViewState().getStatus()
        );
        assertNull(unsupported.cache.snapshot);
    }

    @Test
    public void disabledServiceClearsFreshCacheAndNavigationImmediately() {
        Fixture fixture = new Fixture(10_000L, TestDeliveryRoutes.snapshot(1, 0));
        fixture.api.enqueue(new ApiFailure(503, "ANDROID_AUTO_DISABLED"));

        fixture.repository.refresh(changed -> { });
        fixture.executor.runNext();

        assertEquals(
                DeliveryRouteStatus.DISABLED,
                fixture.repository.getViewState().getStatus()
        );
        assertEquals(
                "ANDROID_AUTO_DISABLED",
                fixture.repository.getViewState().getErrorCode()
        );
        assertTrue(fixture.repository.getViewState().getStops().isEmpty());
        assertFalse(fixture.repository.getViewState().allowsNavigation());
        assertNull(fixture.cache.snapshot);
        assertTrue(fixture.cache.clearCount > 0);
    }

    @Test
    public void disabledStateCommitsEvenWhenCacheCleanupFails() {
        Fixture fixture = new Fixture(10_000L, TestDeliveryRoutes.snapshot(1, 0));
        fixture.cache.throwOnClear = true;
        fixture.api.enqueue(new ApiFailure(503, "ANDROID_AUTO_DISABLED"));

        fixture.repository.refresh(changed -> { });
        fixture.executor.runNext();

        assertEquals(
                DeliveryRouteStatus.DISABLED,
                fixture.repository.getViewState().getStatus()
        );
        assertTrue(fixture.repository.getViewState().getStops().isEmpty());
        assertFalse(fixture.repository.getViewState().allowsNavigation());
        assertTrue(fixture.cache.clearCount > 0);
    }

    @Test
    public void ignoresAQueuedResponseAfterLogoutClearsTheRoute() {
        Fixture fixture = new Fixture(10_000L, null);
        fixture.api.enqueue(DeliveryRouteResponse.active(
                TestDeliveryRoutes.snapshot(9, 10_000L)
        ));

        fixture.repository.refresh(changed -> { });
        fixture.repository.clear();
        fixture.executor.runNext();

        assertEquals(
                DeliveryRouteStatus.SIGNED_OUT,
                fixture.repository.getViewState().getStatus()
        );
        assertTrue(fixture.repository.getViewState().getStops().isEmpty());
        assertEquals(0, fixture.api.callCount);
    }

    @Test
    public void cancelDropsTheQueuedRefreshAndItsCallback() {
        Fixture fixture = new Fixture(10_000L, null);
        fixture.api.enqueue(DeliveryRouteResponse.active(
                TestDeliveryRoutes.snapshot(9, 10_000L)
        ));
        List<Boolean> callbacks = new ArrayList<>();

        fixture.repository.refresh(callbacks::add);
        fixture.repository.cancelRefresh();
        fixture.executor.runNext();

        assertEquals(0, fixture.api.callCount);
        assertTrue(callbacks.isEmpty());
        assertEquals(
                DeliveryRouteStatus.LOADING,
                fixture.repository.getViewState().getStatus()
        );
    }

    @Test
    public void pausedReadyRouteBecomesOfflineAndCannotOutliveTheSafetyWindow() {
        Fixture fixture = new Fixture(10_000L, null);
        fixture.api.enqueue(DeliveryRouteResponse.active(
                TestDeliveryRoutes.snapshot(3, 10_000L)
        ));
        fixture.repository.refresh(changed -> { });
        fixture.executor.runNext();
        assertEquals(
                DeliveryRouteStatus.READY,
                fixture.repository.getViewState().getStatus()
        );

        fixture.repository.cancelRefresh();
        assertEquals(
                DeliveryRouteStatus.FRESH_OFFLINE,
                fixture.repository.getViewState().getStatus()
        );

        fixture.clock.nowMillis = 10_001L
                + DeliveryRouteStateReducer.FRESH_CACHE_MILLIS;
        assertEquals(
                DeliveryRouteStatus.STALE_OFFLINE,
                fixture.repository.getViewState().getStatus()
        );
        assertFalse(fixture.repository.getViewState().allowsNavigation());
    }

    private static final class Fixture {
        private final FakeStore store = new FakeStore();
        private final FakeRouteApi api = new FakeRouteApi();
        private final FakeCache cache;
        private final ControlledExecutor executor = new ControlledExecutor();
        private final FakeClock clock;
        private final FakeTelemetry telemetry = new FakeTelemetry();
        private final NativeDeliveryStopRepository repository;

        private Fixture(long nowMillis, DeliveryRouteSnapshot cached) {
            store.refreshToken = "refresh-0";
            cache = new FakeCache(cached);
            clock = new FakeClock(nowMillis);
            repository = new NativeDeliveryStopRepository(
                    new NativeSessionManager(store, new FakeAuthApi(), clock::nowMillis),
                    api,
                    cache,
                    executor,
                    clock,
                    telemetry
            );
        }
    }

    private static final class FakeTelemetry implements DeliveryRouteTelemetry {
        private DeliveryRouteStatus from;
        private DeliveryRouteStatus to;
        private LatencyBucket latency;
        private CacheStatus cacheStatus;

        @Override
        public void recordTransition(
                DeliveryRouteStatus from,
                DeliveryRouteStatus to,
                LatencyBucket latency,
                Long routeRevision,
                CacheStatus cacheStatus,
                String errorCode
        ) {
            this.from = from;
            this.to = to;
            this.latency = latency;
            this.cacheStatus = cacheStatus;
        }

        @Override
        public void recordDisplayedRows(
                DeliveryRouteStatus status,
                Long routeRevision,
                int displayedRowCount
        ) { }

        @Override
        public void recordNavigationHandoff(
                long routeRevision,
                String navigationId,
                String kind,
                String resultCode
        ) { }

        @Override
        public void recordQuickReturnNotification(
                QuickReturnEvent event,
                String errorCode
        ) { }
    }

    private static final class FakeRouteApi implements DeliveryRouteApi {
        private final Queue<Object> results = new ArrayDeque<>();
        private final List<String> etags = new ArrayList<>();
        private int callCount;

        void enqueue(Object result) {
            results.add(result);
        }

        @Override
        public DeliveryRouteResponse getActiveRoute(String accessToken, String etag)
                throws ApiFailure {
            callCount += 1;
            etags.add(etag);
            Object result = results.remove();
            if (result instanceof ApiFailure) throw (ApiFailure) result;
            return (DeliveryRouteResponse) result;
        }
    }

    private static final class FakeCache implements DeliveryRouteCache {
        private DeliveryRouteSnapshot snapshot;
        private int readCount;
        private int clearCount;
        private boolean throwOnClear;

        private FakeCache(DeliveryRouteSnapshot snapshot) {
            this.snapshot = snapshot;
        }

        @Override
        public DeliveryRouteSnapshot read() {
            readCount += 1;
            return snapshot;
        }

        @Override
        public void write(DeliveryRouteSnapshot value) {
            snapshot = value;
        }

        @Override
        public void clear() {
            clearCount += 1;
            if (throwOnClear) {
                throw new IllegalStateException("cache unavailable");
            }
            snapshot = null;
        }
    }

    private static final class FakeClock implements NativeDeliveryStopRepository.Clock {
        private long nowMillis;

        private FakeClock(long nowMillis) {
            this.nowMillis = nowMillis;
        }

        @Override
        public long nowMillis() {
            return nowMillis;
        }
    }

    private static final class ControlledExecutor extends AbstractExecutorService {
        private final Queue<Runnable> pending = new ArrayDeque<>();
        private boolean shutdown;

        @Override
        public void execute(Runnable command) {
            pending.add(command);
        }

        int pendingCount() {
            return pending.size();
        }

        void runNext() {
            pending.remove().run();
        }

        @Override
        public void shutdown() {
            shutdown = true;
        }

        @Override
        public List<Runnable> shutdownNow() {
            shutdown = true;
            List<Runnable> remaining = new ArrayList<>(pending);
            pending.clear();
            return remaining;
        }

        @Override
        public boolean isShutdown() {
            return shutdown;
        }

        @Override
        public boolean isTerminated() {
            return shutdown && pending.isEmpty();
        }

        @Override
        public boolean awaitTermination(long timeout, TimeUnit unit) {
            return isTerminated();
        }
    }

    private static final class FakeStore implements NativeCredentialStore {
        private String refreshToken;
        private String sessionBinding = "session-test";
        private int readCount;

        @Override
        public String getRefreshToken() {
            readCount += 1;
            return refreshToken;
        }

        @Override
        public void setRefreshToken(String value) {
            refreshToken = value;
        }

        @Override
        public String getSessionBinding() {
            return sessionBinding;
        }

        @Override
        public PairingRequest getPairingRequest() {
            return null;
        }

        @Override
        public void setPairingRequest(PairingRequest value) { }

        @Override
        public void clearPairingRequest() { }

        @Override
        public void clearSession() {
            refreshToken = null;
            sessionBinding = null;
        }
    }

    private static final class FakeAuthApi implements NativeAuthApi {
        @Override
        public NativeTokenResponse exchange(String code, String verifier) {
            return tokenResponse();
        }

        @Override
        public NativeTokenResponse refresh(String refreshToken) {
            return tokenResponse();
        }

        @Override
        public void revoke(String refreshToken) { }

        private NativeTokenResponse tokenResponse() {
            return new NativeTokenResponse("access-1", 900, "refresh-1");
        }
    }
}
