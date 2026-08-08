package com.gredice.dostava.data;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** Two synthetic public-place stops used only for the Play/Android Auto feasibility gate. */
public final class FixtureDeliveryStopRepository implements DeliveryStopRepository {
    private static final List<DeliveryStop> STOPS = Collections.unmodifiableList(Arrays.asList(
            new DeliveryStop(
                    "Ogledna stanica 1",
                    "Zagrebački velesajam",
                    "1",
                    45.7774,
                    15.9821,
                    2.4
            ),
            new DeliveryStop(
                    "Ogledna stanica 2",
                    "Park Maksimir",
                    "2",
                    45.8216,
                    16.0174,
                    6.1
            )
    ));

    @Override
    public List<DeliveryStop> getStops() {
        return STOPS;
    }
}
