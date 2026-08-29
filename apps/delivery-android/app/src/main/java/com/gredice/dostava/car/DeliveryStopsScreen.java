package com.gredice.dostava.car;

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
import com.gredice.dostava.navigation.NavigationLaunchGate;
import com.gredice.dostava.navigation.NavigationUri;

import java.util.List;

/** Shows the privacy-safe server route projection using the host-rendered POI map template. */
@SuppressWarnings("deprecation")
final class DeliveryStopsScreen extends Screen {
    private final DeliveryStopRepository stopRepository;
    private final DeliveryRouteTelemetry telemetry;
    private final DeliveryRouteRefreshController refreshController;
    private final DeliveryStopFormatter formatter = new DeliveryStopFormatter();
    private final DeliveryStopListLimiter listLimiter = new DeliveryStopListLimiter();
    private final NavigationLaunchGate navigationLaunchGate =
            new NavigationLaunchGate();

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
        super(carContext);
        this.stopRepository = stopRepository;
        this.telemetry = telemetry;
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

    @Override
    @NonNull
    public Template onGetTemplate() {
        DeliveryRouteViewState viewState = stopRepository.getViewState();
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
            if (viewState.allowsNavigation()) {
                if (metric.length() > 0) metric.append(" · ");
                metric.append(getCarContext().getString(R.string.navigation_action));
                row.setBrowsable(true);
                row.setOnClickListener(() -> startNavigation(stop));
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

    private void startNavigation(DeliveryStop stop) {
        try {
            navigationLaunchGate.launchIfAllowed(
                    SystemClock.elapsedRealtime(),
                    () -> {
                        Intent intent = new Intent(
                                CarContext.ACTION_NAVIGATE,
                                Uri.parse(NavigationUri.forCoordinates(
                                        stop.getLatitude(),
                                        stop.getLongitude()
                                ))
                        );

                        // Implicit: the driver controls the default navigation app.
                        getCarContext().startCarApp(intent);
                    });
        } catch (HostException | SecurityException exception) {
            showNavigationUnavailable();
        } catch (RuntimeException exception) {
            showNavigationUnavailable();
        }
    }

    private void showNavigationUnavailable() {
        CarToast.makeText(
                getCarContext(),
                getCarContext().getString(R.string.navigation_unavailable),
                CarToast.LENGTH_LONG
        ).show();
    }
}
