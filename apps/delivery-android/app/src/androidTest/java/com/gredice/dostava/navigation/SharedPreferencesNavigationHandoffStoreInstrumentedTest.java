package com.gredice.dostava.navigation;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import android.content.Context;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class SharedPreferencesNavigationHandoffStoreInstrumentedTest {
    @Test
    public void minimalMarkerSurvivesStoreRecreationAndCanBeCleared() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SharedPreferencesNavigationHandoffStore first =
                new SharedPreferencesNavigationHandoffStore(context);
        first.clear();
        first.write(new PendingNavigationHandoff(
                "session:opaque",
                "route:opaque",
                7,
                "delivery:opaque-1",
                "delivery",
                20_000L
        ));

        SharedPreferencesNavigationHandoffStore recreated =
                new SharedPreferencesNavigationHandoffStore(context);
        PendingNavigationHandoff restored = recreated.read();

        assertNotNull(restored);
        assertEquals("session:opaque", restored.getSessionBinding());
        assertEquals("route:opaque", restored.getRouteId());
        assertEquals(7L, restored.getRouteRevision());
        assertEquals("delivery:opaque-1", restored.getNavigationId());
        assertEquals("delivery", restored.getKind());
        assertEquals(20_000L, restored.getLaunchedAtMillis());

        recreated.clear();
        assertNull(recreated.read());
    }
}
