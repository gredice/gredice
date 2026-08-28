package com.gredice.dostava.data;

import java.util.List;

/** Boundary that will later be backed by the authenticated route projection. */
public interface DeliveryStopRepository {
    List<DeliveryStop> getStops();

    DeliveryRouteStatus getStatus();

    void refresh(Runnable onComplete);

    void clear();
}
