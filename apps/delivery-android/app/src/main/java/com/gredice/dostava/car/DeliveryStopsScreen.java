package com.gredice.dostava.car;

import android.content.Intent;
import android.net.Uri;
import android.text.SpannableStringBuilder;
import android.text.Spanned;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.HostException;
import androidx.car.app.Screen;
import androidx.car.app.model.CarLocation;
import androidx.car.app.model.Distance;
import androidx.car.app.model.DistanceSpan;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.Metadata;
import androidx.car.app.model.Place;
import androidx.car.app.model.PlaceListMapTemplate;
import androidx.car.app.model.PlaceMarker;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import com.gredice.dostava.R;
import com.gredice.dostava.data.DeliveryStop;
import com.gredice.dostava.data.DeliveryStopRepository;
import com.gredice.dostava.navigation.NavigationUri;

import java.util.List;

/** Shows privacy-safe delivery fixtures using the host-rendered POI map template. */
final class DeliveryStopsScreen extends Screen {
    private final DeliveryStopRepository stopRepository;

    DeliveryStopsScreen(
            @NonNull CarContext carContext,
            @NonNull DeliveryStopRepository stopRepository
    ) {
        super(carContext);
        this.stopRepository = stopRepository;
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onResume(@NonNull LifecycleOwner owner) {
                // Refresh the route projection after returning from the navigation app.
                invalidate();
            }
        });
    }

    @Override
    @NonNull
    public Template onGetTemplate() {
        List<DeliveryStop> stops = stopRepository.getStops();
        ItemList.Builder rows = new ItemList.Builder();

        for (int index = 0; index < stops.size(); index++) {
            DeliveryStop stop = stops.get(index);
            String position = index == 0
                    ? getCarContext().getString(R.string.next_stop)
                    : getCarContext().getString(R.string.later_stop);

            SpannableStringBuilder detail = new SpannableStringBuilder();
            detail.append(
                    " ",
                    DistanceSpan.create(Distance.create(
                            stop.getPlannedDistanceKilometers(),
                            Distance.UNIT_KILOMETERS
                    )),
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            );
            detail.append(" · ");
            detail.append(stop.getSubtitle());

            rows.addItem(new Row.Builder()
                    .setTitle(position + " · " + stop.getTitle())
                    .addText(detail)
                    .setOnClickListener(() -> startNavigation(stop))
                    .setMetadata(new Metadata.Builder()
                            .setPlace(new Place.Builder(CarLocation.create(
                                    stop.getLatitude(),
                                    stop.getLongitude()
                            )).setMarker(new PlaceMarker.Builder()
                                    .setLabel(stop.getMarkerLabel())
                                    .build()).build())
                            .build())
                    .build());
        }

        return new PlaceListMapTemplate.Builder()
                .setTitle(getCarContext().getString(R.string.car_screen_title))
                .setItemList(rows.build())
                .build();
    }

    private void startNavigation(DeliveryStop stop) {
        Intent intent = new Intent(
                CarContext.ACTION_NAVIGATE,
                Uri.parse(NavigationUri.forCoordinates(
                        stop.getLatitude(),
                        stop.getLongitude()
                ))
        );

        try {
            // Intentionally implicit: the driver controls the default navigation app.
            getCarContext().startCarApp(intent);
        } catch (HostException | SecurityException exception) {
            CarToast.makeText(
                    getCarContext(),
                    getCarContext().getString(R.string.navigation_unavailable),
                    CarToast.LENGTH_LONG
            ).show();
        }
    }
}
