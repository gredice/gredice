package com.gredice.dostava.car;

import com.gredice.dostava.data.DeliveryStop;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/** Croatian glanceable labels derived only from the validated route projection. */
final class DeliveryStopFormatter {
    private static final DateTimeFormatter ARRIVAL_TIME = DateTimeFormatter
            .ofPattern("HH:mm", Locale.forLanguageTag("hr-HR"))
            .withZone(ZoneId.of("Europe/Zagreb"));

    String textMetric(DeliveryStop stop) {
        if (stop.getTravelSeconds() != null) {
            long seconds = stop.getTravelSeconds();
            long minutes = Math.max(
                    1,
                    seconds / 60 + (seconds % 60 == 0 ? 0 : 1)
            );
            return minutes > 999 ? "999+ min" : minutes + " min";
        }
        if (stop.getEstimatedArrivalAtMillis() != null) {
            return "Dolazak " + ARRIVAL_TIME.format(Instant.ofEpochMilli(
                    stop.getEstimatedArrivalAtMillis()
            ));
        }
        return null;
    }

    boolean usesDistanceMetric(DeliveryStop stop) {
        return textMetric(stop) == null && stop.getDistanceMeters() != null;
    }
}
