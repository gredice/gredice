package com.gredice.dostava.navigation;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import org.junit.Test;

public final class NavigationUriTest {
    @Test
    public void formatsCoordinatesWithoutAProviderSpecificPackageOrScheme() {
        assertEquals(
                "geo:45.777400,15.982100",
                NavigationUri.forCoordinates(45.7774, 15.9821)
        );
    }

    @Test
    public void rejectsOutOfRangeCoordinates() {
        assertThrows(
                IllegalArgumentException.class,
                () -> NavigationUri.forCoordinates(91, 15.9821)
        );
        assertThrows(
                IllegalArgumentException.class,
                () -> NavigationUri.forCoordinates(45.7774, -181)
        );
    }

    @Test
    public void rejectsNonFiniteCoordinates() {
        assertThrows(
                IllegalArgumentException.class,
                () -> NavigationUri.forCoordinates(Double.NaN, 15.9821)
        );
        assertThrows(
                IllegalArgumentException.class,
                () -> NavigationUri.forCoordinates(45.7774, Double.POSITIVE_INFINITY)
        );
    }
}
