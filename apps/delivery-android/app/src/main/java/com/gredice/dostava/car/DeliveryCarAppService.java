package com.gredice.dostava.car;

import android.content.pm.ApplicationInfo;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.SessionInfo;
import androidx.car.app.validation.HostValidator;

/** Android Auto entry point for the projected, car-safe Delivery surface. */
public final class DeliveryCarAppService extends CarAppService {
    @Override
    @NonNull
    @SuppressWarnings("deprecation")
    public Session onCreateSession() {
        return new DeliverySession();
    }

    @Override
    @NonNull
    public Session onCreateSession(@NonNull SessionInfo sessionInfo) {
        return new DeliverySession();
    }

    @Override
    @NonNull
    public HostValidator createHostValidator() {
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        }

        return new HostValidator.Builder(getApplicationContext())
                .addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample)
                .build();
    }
}
