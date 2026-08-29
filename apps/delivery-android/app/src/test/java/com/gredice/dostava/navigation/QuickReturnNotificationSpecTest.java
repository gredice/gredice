package com.gredice.dostava.navigation;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import java.util.Locale;

import org.junit.Test;

public final class QuickReturnNotificationSpecTest {
    @Test
    public void fixedNotificationIdentityAndCopyAreGeneric() {
        assertEquals("active-delivery-route", QuickReturnNotificationSpec.CHANNEL_ID);
        assertEquals("Aktivna dostava", QuickReturnNotificationSpec.CHANNEL_NAME);
        assertEquals("Gredice Dostava", QuickReturnNotificationSpec.TITLE);
        assertEquals("Otvori aktivnu rutu", QuickReturnNotificationSpec.TEXT);
        assertEquals(4_365, QuickReturnNotificationSpec.NOTIFICATION_ID);

        String visibleCopy = (
                QuickReturnNotificationSpec.TITLE
                        + " "
                        + QuickReturnNotificationSpec.TEXT
        ).toLowerCase(Locale.ROOT);
        for (String forbidden : new String[]{
                "adresa",
                "kupac",
                "farma",
                "stanica",
                "telefon",
                "eta",
                "koordinata",
                "ruta #"
        }) {
            assertFalse(visibleCopy.contains(forbidden));
        }
    }
}
