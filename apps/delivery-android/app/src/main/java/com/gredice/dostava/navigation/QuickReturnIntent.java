package com.gredice.dostava.navigation;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import com.gredice.dostava.car.DeliveryCarAppService;

/** Creates and recognizes the data-free intent used by the car notification. */
public final class QuickReturnIntent {
    private QuickReturnIntent() { }

    public static Intent create(Context context) {
        return new Intent(Intent.ACTION_VIEW)
                .setComponent(new ComponentName(context, DeliveryCarAppService.class))
                .setData(Uri.parse(QuickReturnNotificationSpec.CAR_ENTRY_URI));
    }

    public static boolean matches(Intent intent) {
        return intent != null
                && Intent.ACTION_VIEW.equals(intent.getAction())
                && QuickReturnNotificationSpec.CAR_ENTRY_URI.equals(
                        intent.getDataString()
                );
    }
}
