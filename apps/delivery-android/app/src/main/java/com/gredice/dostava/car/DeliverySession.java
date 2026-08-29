package com.gredice.dostava.car;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.ScreenManager;
import androidx.car.app.Session;

import com.gredice.dostava.DeliveryNativeServices;
import com.gredice.dostava.navigation.ActiveRouteReturnController;
import com.gredice.dostava.navigation.QuickReturnIntent;

/** Creates the first screen for every Android Auto connection. */
final class DeliverySession extends Session {
    private ActiveRouteReturnController quickReturnController;
    private DeliveryStopsScreen rootScreen;

    @Override
    @NonNull
    public Screen onCreateScreen(@NonNull Intent intent) {
        DeliveryNativeServices services = DeliveryNativeServices.get(getCarContext());
        quickReturnController = services.getQuickReturnController();
        boolean openedFromQuickReturn = QuickReturnIntent.matches(intent);
        if (openedFromQuickReturn) quickReturnController.onTapped();
        rootScreen = new DeliveryStopsScreen(
                getCarContext(),
                services.getStopRepository(),
                services.getRouteTelemetry(),
                services.getNavigationHandoffStore(),
                quickReturnController
        );
        if (openedFromQuickReturn) rootScreen.refreshFromQuickReturn();
        return rootScreen;
    }

    @Override
    public void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        if (!QuickReturnIntent.matches(intent)
                || quickReturnController == null
                || rootScreen == null) {
            return;
        }
        quickReturnController.onTapped();
        getCarContext().getCarService(ScreenManager.class).popToRoot();
        rootScreen.refreshFromQuickReturn();
    }
}
