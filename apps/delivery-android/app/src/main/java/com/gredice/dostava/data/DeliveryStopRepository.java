package com.gredice.dostava.data;

/** Authenticated, cached, lifecycle-cancellable route state boundary. */
public interface DeliveryStopRepository {
    DeliveryRouteViewState getViewState();

    void refresh(RefreshCallback onComplete);

    void cancelRefresh();

    void clear();

    interface RefreshCallback {
        void onComplete(boolean stateChanged);
    }
}
