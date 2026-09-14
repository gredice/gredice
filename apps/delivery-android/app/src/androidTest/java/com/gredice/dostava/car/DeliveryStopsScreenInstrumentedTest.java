package com.gredice.dostava.car;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.car.app.model.Item;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.PlaceListMapTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.car.app.testing.ScreenController;
import androidx.car.app.testing.TestCarContext;
import androidx.lifecycle.Lifecycle;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.gredice.dostava.data.DeliveryRouteStatus;
import com.gredice.dostava.data.DeliveryRouteTelemetry;
import com.gredice.dostava.data.DeliveryRouteViewState;
import com.gredice.dostava.data.DeliveryStop;
import com.gredice.dostava.data.DeliveryStopRepository;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class DeliveryStopsScreenInstrumentedTest {
    @Test
    public void readyTemplateContainsOnlyCarSafeRowsAndActions() {
        FakeRepository repository = new FakeRepository(readyState(DeliveryRouteStatus.READY));
        PlaceListMapTemplate template = (PlaceListMapTemplate) screen(repository)
                .getScreen()
                .onGetTemplate();

        assertEquals("Gredice Dostava", template.getTitle().toString());
        assertFalse(template.isLoading());
        assertEquals(2, template.getItemList().getItems().size());

        Row current = row(template, 0);
        Row next = row(template, 1);
        assertEquals("Dostava 1", current.getTitle().toString());
        assertTrue(current.getTexts().get(0).toString().startsWith("Trenutačna stanica · "));
        assertEquals("Preuzimanje 2", next.getTitle().toString());
        assertNotNull(current.getOnClickDelegate());
        assertNotNull(next.getOnClickDelegate());
        assertTrue(current.isBrowsable());
        assertTrue(next.isBrowsable());
        assertNotNull(current.getMetadata().getPlace());

        String visibleText = current.getTitle() + " " + current.getTexts()
                + " " + next.getTitle() + " " + next.getTexts();
        assertFalse(visibleText.contains("Kupac"));
        assertFalse(visibleText.contains("Telefon"));
        assertFalse(visibleText.contains("QR"));
    }

    @Test
    public void staleAndSignedOutStatesHaveDeterministicMessagesWithoutActions() {
        FakeRepository staleRepository = new FakeRepository(
                readyState(DeliveryRouteStatus.STALE_OFFLINE)
        );
        MessageTemplate stale = (MessageTemplate) screen(staleRepository)
                .getScreen()
                .onGetTemplate();
        assertEquals(
                "Podaci o ruti nisu ažurni. Otvorite aplikaciju na telefonu.",
                stale.getMessage().toString()
        );
        assertEquals(1, stale.getActions().size());

        FakeRepository signedOutRepository = new FakeRepository(new DeliveryRouteViewState(
                DeliveryRouteStatus.SIGNED_OUT,
                Collections.emptyList(),
                null,
                null
        ));
        MessageTemplate signedOut = (MessageTemplate) screen(signedOutRepository)
                .getScreen()
                .onGetTemplate();
        assertEquals(
                "Prijavite se u aplikaciji na telefonu.",
                signedOut.getMessage().toString()
        );
        assertTrue(signedOut.getActions().isEmpty());
    }

    @Test
    public void loadingUsesTheHostLoadingTemplate() {
        FakeRepository repository = new FakeRepository(new DeliveryRouteViewState(
                DeliveryRouteStatus.LOADING,
                Collections.emptyList(),
                null,
                null
        ));

        PlaceListMapTemplate template = (PlaceListMapTemplate) screen(repository)
                .getScreen()
                .onGetTemplate();

        assertTrue(template.isLoading());
        assertEquals("Gredice Dostava", template.getTitle().toString());
    }

    @Test
    public void remainingOfflineErrorAndContractStatesAreDeterministic() {
        PlaceListMapTemplate freshOffline = (PlaceListMapTemplate) screen(
                new FakeRepository(readyState(DeliveryRouteStatus.FRESH_OFFLINE))
        ).getScreen().onGetTemplate();
        assertEquals(
                "Gredice Dostava · Izvan mreže",
                freshOffline.getTitle().toString()
        );
        assertTrue(row(freshOffline, 0).isBrowsable());

        MessageTemplate empty = message(DeliveryRouteStatus.EMPTY, null);
        assertEquals(
                "Nema aktivne dostavne rute. Otvorite aplikaciju na telefonu.",
                empty.getMessage().toString()
        );
        assertTrue(empty.getActions().isEmpty());

        MessageTemplate error = message(
                DeliveryRouteStatus.ERROR,
                "ROUTE_TEMPORARILY_UNAVAILABLE"
        );
        assertEquals(
                "Rutu trenutačno nije moguće učitati. Pokušajte ponovno.",
                error.getMessage().toString()
        );
        assertEquals(1, error.getActions().size());

        MessageTemplate unsupported = message(
                DeliveryRouteStatus.UNSUPPORTED,
                "ROUTE_RESPONSE_UNSUPPORTED"
        );
        assertEquals(
                "Ažurirajte aplikaciju i otvorite dostavu na telefonu.",
                unsupported.getMessage().toString()
        );
        assertTrue(unsupported.getActions().isEmpty());

        MessageTemplate disabled = message(
                DeliveryRouteStatus.DISABLED,
                "ANDROID_AUTO_DISABLED"
        );
        assertEquals(
                "Android Auto trenutačno nije dostupan. Otvorite dostavu na telefonu.",
                disabled.getMessage().toString()
        );
        assertTrue(disabled.getActions().isEmpty());
    }

    @Test
    public void testControllerDrivesStartResumeAndDestroyLifecycleRefreshes() {
        FakeRepository repository = new FakeRepository(readyState(DeliveryRouteStatus.READY));
        ScreenController controller = screen(repository);

        controller.moveToState(Lifecycle.State.RESUMED);
        assertEquals(2, repository.refreshCount);

        controller.moveToState(Lifecycle.State.DESTROYED);
        assertTrue(repository.cancelCount >= 1);
    }

    @Test
    public void returningFromForegroundNavigationRefreshesServerSelectedCurrentStop() {
        FakeRepository repository = new FakeRepository(
                readyState(DeliveryRouteStatus.READY)
        );
        ScreenController controller = screen(repository);
        controller.moveToState(Lifecycle.State.RESUMED);

        repository.state = new DeliveryRouteViewState(
                DeliveryRouteStatus.READY,
                Collections.singletonList(stop(
                        2,
                        true,
                        "pickup",
                        "Preuzimanje 2"
                )),
                "route:opaque",
                8L,
                "session:opaque",
                null
        );
        controller.moveToState(Lifecycle.State.CREATED);
        controller.moveToState(Lifecycle.State.RESUMED);

        PlaceListMapTemplate returned = (PlaceListMapTemplate) controller
                .getScreen()
                .onGetTemplate();
        assertEquals("Preuzimanje 2", row(returned, 0).getTitle().toString());
        assertTrue(
                row(returned, 0).getTexts().get(0).toString()
                        .startsWith("Trenutačna stanica · ")
        );
        assertTrue(repository.refreshCount >= 4);
    }

    @Test
    public void quickReturnRequestsAnImmediateRootRefresh() {
        FakeRepository repository = new FakeRepository(
                readyState(DeliveryRouteStatus.READY)
        );
        ScreenController controller = screen(repository);

        ((DeliveryStopsScreen) controller.getScreen()).refreshFromQuickReturn();

        assertEquals(1, repository.refreshCount);
    }

    private ScreenController screen(FakeRepository repository) {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        TestCarContext carContext = TestCarContext.createCarContext(context);
        return new ScreenController(new DeliveryStopsScreen(
                carContext,
                repository,
                new FakeTelemetry()
        ));
    }

    private Row row(PlaceListMapTemplate template, int index) {
        Item item = template.getItemList().getItems().get(index);
        return (Row) item;
    }

    private MessageTemplate message(DeliveryRouteStatus status, String errorCode) {
        FakeRepository repository = new FakeRepository(new DeliveryRouteViewState(
                status,
                Collections.emptyList(),
                null,
                errorCode
        ));
        Template template = screen(repository).getScreen().onGetTemplate();
        return (MessageTemplate) template;
    }

    private DeliveryRouteViewState readyState(DeliveryRouteStatus status) {
        DeliveryStop current = stop(1, true, "delivery", "Dostava 1");
        DeliveryStop next = stop(2, false, "pickup", "Preuzimanje 2");
        return new DeliveryRouteViewState(
                status,
                Arrays.asList(current, next),
                "route:opaque",
                7L,
                "session:opaque",
                status == DeliveryRouteStatus.READY ? null : "NETWORK_UNAVAILABLE"
        );
    }

    private DeliveryStop stop(
            int sequence,
            boolean current,
            String kind,
            String title
    ) {
        return new DeliveryStop(
                kind + ":opaque-" + sequence,
                kind,
                sequence,
                current ? "current" : "upcoming",
                title,
                "Testna adresa " + sequence,
                45.8 + sequence / 1_000.0,
                16.0 + sequence / 1_000.0,
                null,
                sequence * 60L,
                sequence * 1_000L
        );
    }

    private static final class FakeRepository implements DeliveryStopRepository {
        private DeliveryRouteViewState state;
        private int refreshCount;
        private int cancelCount;

        private FakeRepository(DeliveryRouteViewState state) {
            this.state = state;
        }

        @Override
        public DeliveryRouteViewState getViewState() {
            return state;
        }

        @Override
        public void refresh(RefreshCallback onComplete) {
            refreshCount += 1;
        }

        @Override
        public void cancelRefresh() {
            cancelCount += 1;
        }

        @Override
        public void clear() { }
    }

    private static final class FakeTelemetry implements DeliveryRouteTelemetry {
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
        ) { }
    }
}
