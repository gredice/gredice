package com.gredice.dostava.navigation;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.app.Notification;
import android.content.Context;
import android.content.Intent;

import androidx.car.app.notification.CarAppExtender;
import androidx.car.app.notification.CarNotificationManager;
import androidx.core.app.NotificationChannelCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class CarActiveRouteReturnNotifierInstrumentedTest {
    @Test
    public void notificationUsesStablePrivacySafeCarContract() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        CarActiveRouteReturnNotifier notifier = new CarActiveRouteReturnNotifier(context);
        notifier.initializeChannel();

        Notification notification = notifier.createNotification();
        CarAppExtender car = new CarAppExtender(notification);
        NotificationChannelCompat channel = CarNotificationManager.from(context)
                .getNotificationChannel(QuickReturnNotificationSpec.CHANNEL_ID);

        assertNotNull(channel);
        assertEquals(NotificationManagerCompat.IMPORTANCE_LOW, channel.getImportance());
        assertEquals(QuickReturnNotificationSpec.CHANNEL_NAME, channel.getName());
        assertFalse(channel.shouldVibrate());
        assertFalse(channel.shouldShowLights());
        assertFalse(channel.canShowBadge());
        assertNull(channel.getSound());
        assertEquals(QuickReturnNotificationSpec.CHANNEL_ID, notification.getChannelId());
        assertEquals(
                QuickReturnNotificationSpec.TITLE,
                notification.extras.getCharSequence(Notification.EXTRA_TITLE)
        );
        assertEquals(
                QuickReturnNotificationSpec.TEXT,
                notification.extras.getCharSequence(Notification.EXTRA_TEXT)
        );
        assertTrue(CarAppExtender.isExtended(notification));
        assertEquals(QuickReturnNotificationSpec.CHANNEL_ID, car.getChannelId());
        assertEquals(NotificationManagerCompat.IMPORTANCE_LOW, car.getImportance());
        assertEquals(QuickReturnNotificationSpec.TITLE, car.getContentTitle());
        assertEquals(QuickReturnNotificationSpec.TEXT, car.getContentText());
        assertNotNull(car.getContentIntent());
        assertTrue((notification.flags & Notification.FLAG_ONLY_ALERT_ONCE) != 0);
    }

    @Test
    public void carEntryIntentSurvivesRecreationWithoutRouteData() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Intent first = QuickReturnIntent.create(context);
        Intent recreated = new Intent(first);

        assertTrue(QuickReturnIntent.matches(recreated));
        assertEquals(QuickReturnNotificationSpec.CAR_ENTRY_URI, recreated.getDataString());
        assertNotNull(recreated.getComponent());
        assertTrue(recreated.getExtras() == null || recreated.getExtras().isEmpty());
    }

    @Test
    public void activeFlagSurvivesStoreRecreationAndClearsSynchronously() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        SharedPreferencesActiveRouteReturnStateStore first =
                new SharedPreferencesActiveRouteReturnStateStore(context);
        first.clear();
        assertFalse(first.isActive());

        first.markActive();
        SharedPreferencesActiveRouteReturnStateStore recreated =
                new SharedPreferencesActiveRouteReturnStateStore(context);
        assertTrue(recreated.isActive());

        recreated.clear();
        assertFalse(first.isActive());
    }
}
