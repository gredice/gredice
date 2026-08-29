package com.gredice.dostava.navigation;

import android.Manifest;
import android.app.Notification;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.car.app.notification.CarAppExtender;
import androidx.car.app.notification.CarNotificationManager;
import androidx.car.app.notification.CarPendingIntent;
import androidx.core.app.NotificationChannelCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.gredice.dostava.DeliverySessionActivity;
import com.gredice.dostava.R;

/** Posts the one host-controlled, low-distraction active-route return shortcut. */
public final class CarActiveRouteReturnNotifier
        implements ActiveRouteReturnNotifier {
    private final Context context;
    private final CarNotificationManager notificationManager;
    private final ActiveRouteReturnStateStore stateStore;

    public CarActiveRouteReturnNotifier(Context context) {
        this(
                context.getApplicationContext(),
                CarNotificationManager.from(context),
                new SharedPreferencesActiveRouteReturnStateStore(context)
        );
    }

    CarActiveRouteReturnNotifier(
            Context context,
            CarNotificationManager notificationManager,
            ActiveRouteReturnStateStore stateStore
    ) {
        this.context = context;
        this.notificationManager = notificationManager;
        this.stateStore = stateStore;
    }

    @Override
    public void initializeChannel() {
        NotificationChannelCompat channel = new NotificationChannelCompat.Builder(
                QuickReturnNotificationSpec.CHANNEL_ID,
                NotificationManagerCompat.IMPORTANCE_LOW
        )
                .setName(QuickReturnNotificationSpec.CHANNEL_NAME)
                .setSound(null, null)
                .setVibrationEnabled(false)
                .setLightsEnabled(false)
                .setShowBadge(false)
                .build();
        notificationManager.createNotificationChannel(channel);
    }

    @Override
    public PostResult postOrUpdate(String sessionKey, String activeRunKey) {
        if (!notificationsEnabled()) return PostResult.DISABLED;

        stateStore.markActive(sessionKey, activeRunKey);
        try {
            notificationManager.notify(
                    QuickReturnNotificationSpec.NOTIFICATION_ID,
                    createBuilder()
            );
            return PostResult.POSTED;
        } catch (RuntimeException failure) {
            clearStateAfterFailedPost();
            throw failure;
        }
    }

    @Override
    public boolean matchesActiveIdentity(
            String sessionKey,
            String activeRunKey
    ) {
        return stateStore.matchesIdentity(sessionKey, activeRunKey);
    }

    @Override
    public boolean cancel() {
        boolean wasActive = stateStore.isActive();
        notificationManager.cancel(QuickReturnNotificationSpec.NOTIFICATION_ID);
        if (wasActive) stateStore.clear();
        return wasActive;
    }

    Notification createNotification() {
        return createBuilder().build();
    }

    private NotificationCompat.Builder createBuilder() {
        PendingIntent carIntent = CarPendingIntent.getCarApp(
                context,
                QuickReturnNotificationSpec.CAR_REQUEST_CODE,
                QuickReturnIntent.create(context),
                PendingIntent.FLAG_UPDATE_CURRENT
        );
        PendingIntent phoneIntent = PendingIntent.getActivity(
                context,
                QuickReturnNotificationSpec.PHONE_REQUEST_CODE,
                new Intent(context, DeliverySessionActivity.class)
                        .setAction(Intent.ACTION_VIEW),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        CarAppExtender carExtension = new CarAppExtender.Builder()
                .setChannelId(QuickReturnNotificationSpec.CHANNEL_ID)
                .setContentTitle(QuickReturnNotificationSpec.TITLE)
                .setContentText(QuickReturnNotificationSpec.TEXT)
                .setSmallIcon(R.drawable.ic_launcher_monochrome)
                .setContentIntent(carIntent)
                .setImportance(NotificationManagerCompat.IMPORTANCE_LOW)
                .build();

        return new NotificationCompat.Builder(
                context,
                QuickReturnNotificationSpec.CHANNEL_ID
        )
                .setSmallIcon(R.drawable.ic_launcher_monochrome)
                .setContentTitle(QuickReturnNotificationSpec.TITLE)
                .setContentText(QuickReturnNotificationSpec.TEXT)
                .setContentIntent(phoneIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setBadgeIconType(NotificationCompat.BADGE_ICON_NONE)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setAutoCancel(false)
                .extend(carExtension);
    }

    private boolean notificationsEnabled() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(
                        context,
                        Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        if (!notificationManager.areNotificationsEnabled()) return false;
        NotificationChannelCompat channel = notificationManager.getNotificationChannel(
                QuickReturnNotificationSpec.CHANNEL_ID
        );
        return channel == null
                || channel.getImportance() != NotificationManagerCompat.IMPORTANCE_NONE;
    }

    private void clearStateAfterFailedPost() {
        try {
            stateStore.clear();
        } catch (RuntimeException ignored) {
            // The next authoritative terminal state still cancels the stable ID.
        }
    }
}
