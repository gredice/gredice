package com.gredice.dostava.navigation;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import com.gredice.dostava.data.DeliveryRouteStatus;
import com.gredice.dostava.data.DeliveryRouteTelemetry;
import com.gredice.dostava.data.DeliveryRouteViewState;

import java.util.Collections;

import org.junit.Test;

public final class ActiveRouteReturnControllerTest {
    @Test
    public void initializesAndPostsOneGenericShortcut() {
        Fixture fixture = new Fixture();

        fixture.controller.initialize();
        fixture.controller.beforeNavigation("session:opaque", "route:opaque");

        assertEquals(1, fixture.notifier.initializeCount);
        assertEquals(1, fixture.notifier.postCount);
        assertEquals(DeliveryRouteTelemetry.QuickReturnEvent.POSTED, fixture.telemetry.event);
        assertNull(fixture.telemetry.errorCode);
    }

    @Test
    public void disabledOrFailedPostingNeverThrowsAndRecordsOnlyGenericCodes() {
        Fixture disabled = new Fixture();
        disabled.notifier.postResult = ActiveRouteReturnNotifier.PostResult.DISABLED;
        disabled.controller.beforeNavigation("session:opaque", "route:opaque");
        assertEquals(DeliveryRouteTelemetry.QuickReturnEvent.FAILURE, disabled.telemetry.event);
        assertEquals("NOTIFICATIONS_DISABLED", disabled.telemetry.errorCode);

        Fixture failed = new Fixture();
        failed.notifier.failPost = true;
        failed.controller.beforeNavigation("session:opaque", "route:opaque");
        assertEquals(DeliveryRouteTelemetry.QuickReturnEvent.FAILURE, failed.telemetry.event);
        assertEquals("POST_FAILED", failed.telemetry.errorCode);
    }

    @Test
    public void keepsGenericShortcutAcrossRevisionChanges() {
        Fixture fixture = new Fixture();
        fixture.notifier.active = true;

        fixture.controller.reconcile(route(
                DeliveryRouteStatus.READY,
                "route:opaque",
                8L,
                "session:opaque"
        ));
        assertEquals(0, fixture.notifier.cancelCount);
    }

    @Test
    public void cancelsEveryAuthoritativeTerminalRouteState() {
        for (DeliveryRouteStatus status : new DeliveryRouteStatus[]{
                DeliveryRouteStatus.SIGNED_OUT,
                DeliveryRouteStatus.EMPTY,
                DeliveryRouteStatus.DISABLED,
                DeliveryRouteStatus.UNSUPPORTED
        }) {
            Fixture fixture = new Fixture();
            fixture.notifier.active = true;
            fixture.controller.reconcile(route(
                    status,
                    null,
                    null,
                    status == DeliveryRouteStatus.SIGNED_OUT
                            ? null
                            : "session:opaque"
            ));
            assertEquals(1, fixture.notifier.cancelCount);
            assertEquals(
                    DeliveryRouteTelemetry.QuickReturnEvent.CANCELED,
                    fixture.telemetry.event
            );
            assertFalse(fixture.notifier.active);
        }
    }

    @Test
    public void cancelsForAccountOrActiveRouteReplacement() {
        Fixture account = new Fixture();
        account.notifier.active = true;
        account.controller.reconcile(route(
                DeliveryRouteStatus.ERROR,
                null,
                null,
                "another-session"
        ));
        assertEquals(1, account.notifier.cancelCount);

        Fixture route = new Fixture();
        route.notifier.active = true;
        route.controller.reconcile(route(
                DeliveryRouteStatus.READY,
                "another-route",
                7L,
                "session:opaque"
        ));
        assertEquals(1, route.notifier.cancelCount);
    }

    @Test
    public void tapAndCancellationFailuresRemainPrivacySafe() {
        Fixture fixture = new Fixture();
        fixture.controller.onTapped();
        assertEquals(DeliveryRouteTelemetry.QuickReturnEvent.TAPPED, fixture.telemetry.event);

        fixture.notifier.active = true;
        fixture.controller.cancelForLogout();
        assertEquals(DeliveryRouteTelemetry.QuickReturnEvent.CANCELED, fixture.telemetry.event);
        assertFalse(fixture.notifier.active);

        fixture.notifier.active = true;
        fixture.notifier.failCancel = true;
        fixture.controller.cancelForLogout();
        assertEquals(DeliveryRouteTelemetry.QuickReturnEvent.FAILURE, fixture.telemetry.event);
        assertEquals("CANCEL_FAILED", fixture.telemetry.errorCode);
        assertTrue(fixture.notifier.active);
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
        private final FakeNotifier notifier = new FakeNotifier();
        private final FakeTelemetry telemetry = new FakeTelemetry();
        private final ActiveRouteReturnController controller =
                new ActiveRouteReturnController(notifier, telemetry);
    }

    private static final class FakeNotifier implements ActiveRouteReturnNotifier {
        private PostResult postResult = PostResult.POSTED;
        private boolean active;
        private boolean failPost;
        private boolean failCancel;
        private int initializeCount;
        private int postCount;
        private int cancelCount;

        @Override
        public void initializeChannel() {
            initializeCount += 1;
        }

        @Override
        public PostResult postOrUpdate(String sessionKey, String activeRunKey) {
            postCount += 1;
            if (failPost) throw new IllegalStateException("unavailable");
            active = postResult == PostResult.POSTED;
            return postResult;
        }

        @Override
        public boolean matchesActiveIdentity(
                String sessionKey,
                String activeRunKey
        ) {
            if (!active) return true;
            return "session:opaque".equals(sessionKey)
                    && (activeRunKey == null
                    || "route:opaque".equals(activeRunKey));
        }

        @Override
        public boolean cancel() {
            cancelCount += 1;
            if (failCancel) throw new IllegalStateException("unavailable");
            boolean wasActive = active;
            active = false;
            return wasActive;
        }
    }

    private static final class FakeTelemetry implements DeliveryRouteTelemetry {
        private QuickReturnEvent event;
        private String errorCode;

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
        ) { }

        @Override
        public void recordQuickReturnNotification(
                QuickReturnEvent event,
                String errorCode
        ) {
            this.event = event;
            this.errorCode = errorCode;
        }
    }
}
