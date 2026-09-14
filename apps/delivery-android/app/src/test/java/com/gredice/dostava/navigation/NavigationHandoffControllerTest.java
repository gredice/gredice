package com.gredice.dostava.navigation;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import com.gredice.dostava.data.DeliveryRouteStatus;
import com.gredice.dostava.data.DeliveryRouteTelemetry;
import com.gredice.dostava.data.DeliveryRouteViewState;
import com.gredice.dostava.data.DeliveryStop;

import java.util.Collections;

import org.junit.Test;

public final class NavigationHandoffControllerTest {
    @Test
    public void launchesOneExactCoordinateAndPersistsOnlyOpaqueMetadata() {
        Fixture fixture = new Fixture();
        StringBuilder launchedUri = new StringBuilder();

        NavigationHandoffController.Result result = fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_000L,
                20_000L,
                launchedUri::append
        );

        assertEquals(NavigationHandoffController.Result.LAUNCHED, result);
        assertEquals("geo:45.810000,16.020000", launchedUri.toString());
        assertNotNull(fixture.store.pending);
        assertEquals("session:opaque", fixture.store.pending.getSessionBinding());
        assertEquals("route:opaque", fixture.store.pending.getRouteId());
        assertEquals(7L, fixture.store.pending.getRouteRevision());
        assertEquals("delivery:opaque-1", fixture.store.pending.getNavigationId());
        assertEquals("delivery", fixture.store.pending.getKind());
        assertEquals(20_000L, fixture.store.pending.getLaunchedAtMillis());
        assertEquals("LAUNCHED", fixture.telemetry.resultCode);
        assertEquals("delivery:opaque-1", fixture.telemetry.navigationId);
        assertEquals(1, fixture.notifier.postCount);
    }

    @Test
    public void suppressesDuplicateTapsWithoutLaunchingOrRewritingMetadata() {
        Fixture fixture = new Fixture();
        int[] launches = {0};
        fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_000L,
                20_000L,
                ignored -> launches[0] += 1
        );

        NavigationHandoffController.Result result = fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_500L,
                30_000L,
                ignored -> launches[0] += 1
        );

        assertEquals(NavigationHandoffController.Result.SUPPRESSED, result);
        assertEquals(1, launches[0]);
        assertEquals(1, fixture.store.writeCount);
        assertEquals(20_000L, fixture.store.pending.getLaunchedAtMillis());
        assertEquals(1, fixture.notifier.postCount);
    }

    @Test
    public void mapsEveryExpectedLaunchFailureAndPermitsImmediateRetry() {
        assertFailure(NavigationHandoffController.Result.NO_HANDLER);
        assertFailure(NavigationHandoffController.Result.HOST_FAILURE);
        assertFailure(NavigationHandoffController.Result.SECURITY_FAILURE);
        assertFailure(NavigationHandoffController.Result.UNEXPECTED_FAILURE);

        Fixture fixture = new Fixture();
        NavigationHandoffController.Result failed = fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_000L,
                20_000L,
                ignored -> {
                    throw new IllegalArgumentException("malformed");
                }
        );
        assertEquals(NavigationHandoffController.Result.MALFORMED_URI, failed);
        assertNull(fixture.store.pending);

        NavigationHandoffController.Result retried = fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_000L,
                20_001L,
                ignored -> { }
        );
        assertEquals(NavigationHandoffController.Result.LAUNCHED, retried);
    }

    @Test
    public void rejectsMissingSessionAndStorageFailureWithoutLaunching() {
        Fixture missingSession = new Fixture();
        int[] launches = {0};
        assertEquals(
                NavigationHandoffController.Result.INVALID_TARGET,
                missingSession.controller.launch(
                        missingSession.target,
                        null,
                        10_000L,
                        20_000L,
                        ignored -> launches[0] += 1
                )
        );
        assertEquals(0, launches[0]);

        Fixture storageFailure = new Fixture();
        storageFailure.store.failWrite = true;
        assertEquals(
                NavigationHandoffController.Result.STORAGE_FAILURE,
                storageFailure.controller.launch(
                        storageFailure.target,
                        "session:opaque",
                        10_000L,
                        20_000L,
                        ignored -> launches[0] += 1
                )
        );
        assertEquals(0, launches[0]);
    }

    @Test
    public void telemetryFailureCannotDuplicateOrFailASuccessfulHandoff() {
        Fixture fixture = new Fixture();
        fixture.telemetry.fail = true;
        int[] launches = {0};

        NavigationHandoffController.Result result = fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_000L,
                20_000L,
                ignored -> launches[0] += 1
        );

        assertEquals(NavigationHandoffController.Result.LAUNCHED, result);
        assertEquals(1, launches[0]);
        assertNotNull(fixture.store.pending);
    }

    @Test
    public void notificationFailureCannotPreventTheNavigatorHandoff() {
        Fixture fixture = new Fixture();
        fixture.notifier.failPost = true;
        int[] launches = {0};

        NavigationHandoffController.Result result = fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_000L,
                20_000L,
                ignored -> launches[0] += 1
        );

        assertEquals(NavigationHandoffController.Result.LAUNCHED, result);
        assertEquals(1, launches[0]);
        assertNotNull(fixture.store.pending);
        assertEquals("POST_FAILED", fixture.telemetry.quickReturnError);
    }

    @Test
    public void processRecreationRetainsOnlyTheMatchingFreshHandoff() {
        Fixture fixture = new Fixture();
        fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_000L,
                20_000L,
                ignored -> { }
        );

        NavigationHandoffController recreated = new NavigationHandoffController(
                new NavigationLaunchGate(1_500L),
                fixture.store,
                fixture.telemetry
        );
        recreated.reconcile(route(
                DeliveryRouteStatus.READY,
                "route:opaque",
                7L,
                "session:opaque"
        ));
        assertNotNull(fixture.store.pending);

        recreated.reconcile(route(
                DeliveryRouteStatus.READY,
                "route:opaque",
                8L,
                "session:opaque"
        ));
        assertNull(fixture.store.pending);
    }

    @Test
    public void clearsPendingMetadataForAccountChangeOrMissingRun() {
        Fixture fixture = new Fixture();
        fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_000L,
                20_000L,
                ignored -> { }
        );

        fixture.controller.reconcile(route(
                DeliveryRouteStatus.LOADING,
                null,
                null,
                null
        ));
        assertNotNull(fixture.store.pending);

        fixture.controller.reconcile(route(
                DeliveryRouteStatus.ERROR,
                null,
                null,
                "another-session"
        ));
        assertNull(fixture.store.pending);

        fixture.store.pending = PendingNavigationHandoff.from(
                "session:opaque",
                fixture.target,
                20_000L
        );
        fixture.controller.reconcile(route(
                DeliveryRouteStatus.EMPTY,
                null,
                null,
                "session:opaque"
        ));
        assertNull(fixture.store.pending);

        fixture.store.pending = PendingNavigationHandoff.from(
                "session:opaque",
                fixture.target,
                20_000L
        );
        fixture.controller.reconcile(route(
                DeliveryRouteStatus.DISABLED,
                null,
                null,
                "session:opaque"
        ));
        assertNull(fixture.store.pending);
    }

    private static void assertFailure(NavigationHandoffController.Result result) {
        Fixture fixture = new Fixture();
        NavigationHandoffController.Result actual = fixture.controller.launch(
                fixture.target,
                "session:opaque",
                10_000L,
                20_000L,
                ignored -> {
                    throw new NavigationHandoffController.LaunchFailure(
                            result,
                            new RuntimeException("host failure")
                    );
                }
        );

        assertEquals(result, actual);
        assertNull(fixture.store.pending);
        assertEquals(result.name(), fixture.telemetry.resultCode);
    }

    private static DeliveryRouteViewState route(
            DeliveryRouteStatus status,
            String routeId,
            Long revision,
            String sessionBinding
    ) {
        return new DeliveryRouteViewState(
                status,
                Collections.emptyList(),
                routeId,
                revision,
                sessionBinding,
                status == DeliveryRouteStatus.ERROR ? "TEMPORARY" : null
        );
    }

    private static final class Fixture {
        private final FakeStore store = new FakeStore();
        private final FakeTelemetry telemetry = new FakeTelemetry();
        private final FakeNotifier notifier = new FakeNotifier();
        private final NavigationTarget target;
        private final NavigationHandoffController controller;

        private Fixture() {
            DeliveryStop stop = new DeliveryStop(
                    "delivery:opaque-1",
                    "delivery",
                    1,
                    "current",
                    "Dostava 1",
                    "Testna adresa 1",
                    45.81,
                    16.02,
                    null,
                    60L,
                    1_000L
            );
            DeliveryRouteViewState route = new DeliveryRouteViewState(
                    DeliveryRouteStatus.READY,
                    Collections.singletonList(stop),
                    "route:opaque",
                    7L,
                    "session:opaque",
                    null
            );
            target = NavigationTarget.from(route, stop);
            controller = new NavigationHandoffController(
                    new NavigationLaunchGate(1_500L),
                    store,
                    telemetry,
                    new ActiveRouteReturnController(notifier, telemetry)
            );
        }
    }

    private static final class FakeNotifier implements ActiveRouteReturnNotifier {
        private int postCount;
        private boolean active;
        private boolean failPost;

        @Override
        public void initializeChannel() { }

        @Override
        public PostResult postOrUpdate(String sessionKey, String activeRunKey) {
            postCount += 1;
            if (failPost) throw new IllegalStateException("unavailable");
            active = true;
            return PostResult.POSTED;
        }

        @Override
        public boolean matchesActiveIdentity(
                String sessionKey,
                String activeRunKey
        ) {
            return true;
        }

        @Override
        public boolean cancel() {
            boolean wasActive = active;
            active = false;
            return wasActive;
        }
    }

    private static final class FakeStore implements NavigationHandoffStore {
        private PendingNavigationHandoff pending;
        private int writeCount;
        private boolean failWrite;

        @Override
        public PendingNavigationHandoff read() {
            return pending;
        }

        @Override
        public void write(PendingNavigationHandoff value) {
            if (failWrite) throw new IllegalStateException("storage unavailable");
            pending = value;
            writeCount += 1;
        }

        @Override
        public void clear() {
            pending = null;
        }
    }

    private static final class FakeTelemetry implements DeliveryRouteTelemetry {
        private String navigationId;
        private String resultCode;
        private String quickReturnError;
        private boolean fail;

        @Override
        public void recordTransition(
                DeliveryRouteStatus from,
                DeliveryRouteStatus to,
                LatencyBucket latency,
                Long routeRevision,
                CacheStatus cacheStatus,
                String errorCode
        ) { }

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
        ) {
            if (fail) throw new IllegalStateException("telemetry unavailable");
            this.navigationId = navigationId;
            this.resultCode = resultCode;
        }

        @Override
        public void recordQuickReturnNotification(
                QuickReturnEvent event,
                String errorCode
        ) {
            quickReturnError = errorCode;
        }
    }
}
