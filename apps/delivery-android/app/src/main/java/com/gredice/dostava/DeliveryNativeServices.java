package com.gredice.dostava;

import android.content.Context;

import com.gredice.dostava.auth.DeliveryNativeApiClient;
import com.gredice.dostava.auth.EncryptedNativeCredentialStore;
import com.gredice.dostava.auth.NativeCredentialStore;
import com.gredice.dostava.auth.NativeSessionManager;
import com.gredice.dostava.data.EncryptedDeliveryRouteCache;
import com.gredice.dostava.data.DeliveryRouteTelemetry;
import com.gredice.dostava.data.LogcatDeliveryRouteTelemetry;
import com.gredice.dostava.data.NativeDeliveryStopRepository;
import com.gredice.dostava.navigation.NavigationHandoffStore;
import com.gredice.dostava.navigation.SharedPreferencesNavigationHandoffStore;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One process-wide refresh coordinator shared by phone and car surfaces. */
public final class DeliveryNativeServices {
    private static volatile DeliveryNativeServices instance;

    private final NativeCredentialStore credentialStore;
    private final NativeSessionManager sessionManager;
    private final NativeDeliveryStopRepository stopRepository;
    private final DeliveryRouteTelemetry routeTelemetry;
    private final NavigationHandoffStore navigationHandoffStore;
    private final ExecutorService executor;

    private DeliveryNativeServices(Context context) {
        credentialStore = new EncryptedNativeCredentialStore(context);
        DeliveryNativeApiClient apiClient = new DeliveryNativeApiClient();
        sessionManager = new NativeSessionManager(credentialStore, apiClient);
        executor = Executors.newCachedThreadPool();
        routeTelemetry = new LogcatDeliveryRouteTelemetry();
        navigationHandoffStore = new SharedPreferencesNavigationHandoffStore(context);
        stopRepository = new NativeDeliveryStopRepository(
                sessionManager,
                apiClient,
                new EncryptedDeliveryRouteCache(context),
                executor,
                System::currentTimeMillis,
                routeTelemetry
        );
    }

    public static DeliveryNativeServices get(Context context) {
        DeliveryNativeServices current = instance;
        if (current != null) return current;
        synchronized (DeliveryNativeServices.class) {
            if (instance == null) {
                instance = new DeliveryNativeServices(context.getApplicationContext());
            }
            return instance;
        }
    }

    public NativeCredentialStore getCredentialStore() {
        return credentialStore;
    }

    public NativeSessionManager getSessionManager() {
        return sessionManager;
    }

    public NativeDeliveryStopRepository getStopRepository() {
        return stopRepository;
    }

    public DeliveryRouteTelemetry getRouteTelemetry() {
        return routeTelemetry;
    }

    public NavigationHandoffStore getNavigationHandoffStore() {
        return navigationHandoffStore;
    }

    public ExecutorService getExecutor() {
        return executor;
    }

    public void logout() {
        sessionManager.logout();
        stopRepository.clear();
        navigationHandoffStore.clear();
    }
}
