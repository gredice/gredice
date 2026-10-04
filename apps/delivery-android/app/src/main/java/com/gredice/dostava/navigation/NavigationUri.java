package com.gredice.dostava.navigation;

import java.util.Locale;

/** Builds the documented provider-neutral geo URI used by ACTION_NAVIGATE. */
public final class NavigationUri {
    private NavigationUri() {
    }

    public static String forCoordinates(double latitude, double longitude) {
        if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90) {
            throw new IllegalArgumentException("Latitude must be finite and between -90 and 90.");
        }
        if (!Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new IllegalArgumentException("Longitude must be finite and between -180 and 180.");
        }

        return String.format(Locale.ROOT, "geo:%.6f,%.6f", latitude, longitude);
    }
}
