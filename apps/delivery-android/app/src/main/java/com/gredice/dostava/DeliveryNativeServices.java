package com.gredice.dostava;

import android.content.Context;

import com.gredice.dostava.auth.DeliveryNativeApiClient;
import com.gredice.dostava.auth.EncryptedNativeCredentialStore;
import com.gredice.dostava.auth.NativeCredentialStore;
import com.gredice.dostava.auth.NativeSessionManager;
import com.gredice.dostava.data.NativeDeliveryStopRepository;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One process-wide refresh coordinator shared by phone and car surfaces. */
public final class DeliveryNativeServices {
    private static volatile DeliveryNativeServices instance;

    private final NativeCredentialStore credentialStore;
    private final NativeSessionManager sessionManager;
    private final NativeDeliveryStopRepository stopRepository;
    private final ExecutorService executor;

    private DeliveryNativeServices(Context context) {
        credentialStore = new EncryptedNativeCredentialStore(context);
        DeliveryNativeApiClient apiClient = new DeliveryNativeApiClient();
        sessionManager = new NativeSessionManager(credentialStore, apiClient);
        executor = Executors.newCachedThreadPool();
        stopRepository = new NativeDeliveryStopRepository(
                sessionManager,
                apiClient,
                executor
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

    public ExecutorService getExecutor() {
        return executor;
    }

    public void logout() {
        sessionManager.logout();
        stopRepository.clear();
    }
}
