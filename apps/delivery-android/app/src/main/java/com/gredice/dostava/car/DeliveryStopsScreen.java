package com.gredice.dostava.car;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.text.SpannableStringBuilder;
import android.text.Spanned;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.HostException;
import androidx.car.app.Screen;
import androidx.car.app.constraints.ConstraintManager;
import androidx.car.app.model.Action;
import androidx.car.app.model.CarLocation;
import androidx.car.app.model.Distance;
import androidx.car.app.model.DistanceSpan;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.MessageTemplate;
import androidx.car.app.model.Metadata;
import androidx.car.app.model.Place;
import androidx.car.app.model.PlaceListMapTemplate;
import androidx.car.app.model.PlaceMarker;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import com.gredice.dostava.R;
import com.gredice.dostava.data.DeliveryRouteViewState;
import com.gredice.dostava.data.DeliveryRouteTelemetry;
import com.gredice.dostava.data.DeliveryStop;
import com.gredice.dostava.data.DeliveryStopRepository;
import com.gredice.dostava.data.DeliveryRouteStatus;
import com.gredice.dostava.data.NoOpDeliveryRouteTelemetry;
import com.gredice.dostava.navigation.ActiveRouteReturnController;
import com.gredice.dostava.navigation.ActiveRouteReturnNotifier;
import com.gredice.dostava.navigation.NavigationHandoffController;
import com.gredice.dostava.navigation.NavigationHandoffStore;
import com.gredice.dostava.navigation.NavigationTarget;

import java.util.List;

/** Shows the privacy-safe server route projection using the host-rendered POI map template. */
@SuppressWarnings("deprecation")
final class DeliveryStopsScreen extends Screen {
    private final DeliveryStopRepository stopRepository;
    private final DeliveryRouteTelemetry telemetry;
    private final DeliveryRouteRefreshController refreshController;
    private final DeliveryStopFormatter formatter = new DeliveryStopFormatter();
    private final DeliveryStopListLimiter listLimiter = new DeliveryStopListLimiter();
    private final NavigationHandoffController navigationHandoffController;

    DeliveryStopsScreen(
            @NonNull CarContext carContext,
            @NonNull DeliveryStopRepository stopRepository
    ) {
        this(carContext, stopRepository, new NoOpDeliveryRouteTelemetry());
    }

    DeliveryStopsScreen(
            @NonNull CarContext carContext,
            @NonNull DeliveryStopRepository stopRepository,
            @NonNull DeliveryRouteTelemetry telemetry
    ) {
        this(
                carContext,
                stopRepository,
                telemetry,
                NavigationHandoffStore.NO_OP,
                new ActiveRouteReturnController(
                        ActiveRouteReturnNotifier.NO_OP,
                        telemetry
                )
        );
    }

    DeliveryStopsScreen(
            @NonNull CarContext carContext,
            @NonNull DeliveryStopRepository stopRepository,
            @NonNull DeliveryRouteTelemetry telemetry,
            @NonNull NavigationHandoffStore navigationHandoffStore
    ) {
        this(
                carContext,
                stopRepository,
                telemetry,
                navigationHandoffStore,
                new ActiveRouteReturnController(
                        ActiveRouteReturnNotifier.NO_OP,
                        telemetry
                )
        );
    }

    DeliveryStopsScreen(
            @NonNull CarContext carContext,
            @NonNull DeliveryStopRepository stopRepository,
            @NonNull DeliveryRouteTelemetry telemetry,
            @NonNull NavigationHandoffStore navigationHandoffStore,
            @NonNull ActiveRouteReturnController quickReturnController
    ) {
        super(carContext);
        this.stopRepository = stopRepository;
        this.telemetry = telemetry;
        navigationHandoffController = new NavigationHandoffController(
                navigationHandoffStore,
                telemetry,
                quickReturnController
        );
        refreshController = new DeliveryRouteRefreshController(
                stopRepository,
                new HandlerRefreshScheduler(),
                getCarContext().getMainExecutor(),
                this::invalidate
        );
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onStart(@NonNull LifecycleOwner owner) {
                refreshController.onStart();
            }

            @Override
            public void onResume(@NonNull LifecycleOwner owner) {
                refreshController.onResume();
            }

            @Override
            public void onPause(@NonNull LifecycleOwner owner) {
                refreshController.onPause();
            }

            @Override
            public void onStop(@NonNull LifecycleOwner owner) {
                refreshController.onStop();
            }

            @Override
            public void onDestroy(@NonNull LifecycleOwner owner) {
                refreshController.onDestroy();
            }
        });
    }

    void refreshFromQuickReturn() {
        refreshController.refreshNow();
    }

    @Override
    @NonNull
    public Template onGetTemplate() {
        DeliveryRouteViewState viewState = stopRepository.getViewState();
        navigationHandoffController.reconcile(viewState);
        DeliveryRouteStatus status = viewState.getStatus();
        if (status != DeliveryRouteStatus.READY
                && status != DeliveryRouteStatus.FRESH_OFFLINE) {
            telemetry.recordDisplayedRows(status, viewState.getRouteRevision(), 0);
        }
        if (status == DeliveryRouteStatus.LOADING) {
            return new PlaceListMapTemplate.Builder()
                    .setTitle(getCarContext().getString(R.string.car_screen_title))
                    .setLoading(true)
                    .build();
        }
        if (status == DeliveryRouteStatus.SIGNED_OUT) {
            return message(R.string.car_sign_in_required, false);
        }
        if (status == DeliveryRouteStatus.EMPTY) {
            return message(R.string.car_no_active_route, false);
        }
        if (status == DeliveryRouteStatus.STALE_OFFLINE) {
            return message(R.string.car_route_stale, true);
        }
        if (status == DeliveryRouteStatus.DISABLED) {
            return message(R.string.car_android_auto_disabled, false);
        }
        if (status == DeliveryRouteStatus.UNSUPPORTED) {
            return message(R.string.car_route_unsupported, false);
        }
        if (status == DeliveryRouteStatus.ERROR) {
            return message(R.string.car_route_unavailable, true);
        }

        List<DeliveryStop> stops = listLimiter.limit(
                viewState.getStops(),
                placeListLimit()
        );
        telemetry.recordDisplayedRows(
                status,
                viewState.getRouteRevision(),
                stops.size()
        );
        ItemList.Builder rows = new ItemList.Builder();

        for (DeliveryStop stop : stops) {
            Row.Builder row = new Row.Builder()
                    .setTitle(stop.getTitle())
                    .addText(stop.isCurrent()
                            ? getCarContext().getString(R.string.current_stop)
                                    + " · " + stop.getAddress()
                            : stop.getAddress())
                    .setMetadata(new Metadata.Builder()
                            .setPlace(new Place.Builder(CarLocation.create(
                                    stop.getLatitude(),
                                    stop.getLongitude()
                            )).setMarker(new PlaceMarker.Builder()
                                    .setLabel(stop.getMarkerLabel())
                                    .build()).build())
                            .build());

            SpannableStringBuilder metric = metric(stop);
            NavigationTarget navigationTarget = NavigationTarget.from(
                    viewState,
                    stop
            );
            if (navigationTarget != null
                    && viewState.getSessionBinding() != null) {
                if (metric.length() > 0) metric.append(" · ");
                metric.append(getCarContext().getString(R.string.navigation_action));
                row.setBrowsable(true);
                String sessionBinding = viewState.getSessionBinding();
                row.setOnClickListener(() -> startNavigation(
                        navigationTarget,
                        sessionBinding
                ));
            }
            if (metric.length() > 0) row.addText(metric);
            rows.addItem(row.build());
        }

        PlaceListMapTemplate.Builder template = new PlaceListMapTemplate.Builder()
                .setTitle(status == DeliveryRouteStatus.FRESH_OFFLINE
                        ? getCarContext().getString(R.string.car_screen_title)
                                + " · "
                                + getCarContext().getString(R.string.car_offline)
                        : getCarContext().getString(R.string.car_screen_title))
                .setItemList(rows.build());
        if (getCarContext().getCarAppApiLevel() >= 5) {
            template.setOnContentRefreshListener(refreshController::refreshNow);
        }
        return template.build();
    }

    private int placeListLimit() {
        if (getCarContext().getCarAppApiLevel() < 2) return 5;
        try {
            return getCarContext()
                    .getCarService(ConstraintManager.class)
                    .getContentLimit(
                            ConstraintManager.CONTENT_LIMIT_TYPE_PLACE_LIST
                    );
        } catch (HostException exception) {
            return 5;
        }
    }

    private Template message(int message, boolean retryable) {
        MessageTemplate.Builder template = new MessageTemplate.Builder(
                getCarContext().getString(message)
        ).setTitle(getCarContext().getString(R.string.car_screen_title));
        if (retryable) {
            template.addAction(new Action.Builder()
                    .setTitle(getCarContext().getString(R.string.retry_action))
                    .setOnClickListener(refreshController::refreshNow)
                    .build());
        }
        return template.build();
    }

    private SpannableStringBuilder metric(DeliveryStop stop) {
        SpannableStringBuilder detail = new SpannableStringBuilder();
        String textMetric = formatter.textMetric(stop);
        if (textMetric != null) {
            detail.append(textMetric);
        } else if (formatter.usesDistanceMetric(stop)) {
            long distanceMeters = stop.getDistanceMeters();
            double value = distanceMeters < 1_000
                    ? distanceMeters
                    : distanceMeters / 1_000.0;
            int unit = distanceMeters < 1_000
                    ? Distance.UNIT_METERS
                    : Distance.UNIT_KILOMETERS;
            detail.append(
                    " ",
                    DistanceSpan.create(Distance.create(value, unit)),
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            );
        }
        return detail;
    }

    private void startNavigation(
            NavigationTarget target,
            String sessionBinding
    ) {
        NavigationHandoffController.Result result = navigationHandoffController.launch(
                target,
                sessionBinding,
                SystemClock.elapsedRealtime(),
                System.currentTimeMillis(),
                this::launchNavigator
        );
        if (result.shouldNotifyUser()) {
            showNavigationUnavailable();
        }
    }

    private void launchNavigator(String uri) {
        Intent intent = new Intent(CarContext.ACTION_NAVIGATE, Uri.parse(uri));
        try {
            // Implicit: the driver controls the default navigation app.
            getCarContext().startCarApp(intent);
        } catch (ActivityNotFoundException exception) {
            throw launchFailure(
                    NavigationHandoffController.Result.NO_HANDLER,
                    exception
            );
        } catch (HostException exception) {
            throw launchFailure(
                    NavigationHandoffController.Result.HOST_FAILURE,
                    exception
            );
        } catch (SecurityException exception) {
            throw launchFailure(
                    NavigationHandoffController.Result.SECURITY_FAILURE,
                    exception
            );
        } catch (RuntimeException exception) {
            throw launchFailure(
                    NavigationHandoffController.Result.UNEXPECTED_FAILURE,
                    exception
            );
        }
    }

    private NavigationHandoffController.LaunchFailure launchFailure(
            NavigationHandoffController.Result result,
            RuntimeException cause
    ) {
        return new NavigationHandoffController.LaunchFailure(result, cause);
    }

    private void showNavigationUnavailable() {
        CarToast.makeText(
                getCarContext(),
                getCarContext().getString(R.string.navigation_unavailable),
                CarToast.LENGTH_LONG
        ).show();
    }
}
