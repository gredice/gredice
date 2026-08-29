package com.gredice.dostava.car;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.Session;

import com.gredice.dostava.DeliveryNativeServices;

/** Creates the first screen for every Android Auto connection. */
final class DeliverySession extends Session {
    @Override
    @NonNull
    public Screen onCreateScreen(@NonNull Intent intent) {
        DeliveryNativeServices services = DeliveryNativeServices.get(getCarContext());
        return new DeliveryStopsScreen(
                getCarContext(),
                services.getStopRepository(),
                services.getRouteTelemetry()
        );
    }
}
