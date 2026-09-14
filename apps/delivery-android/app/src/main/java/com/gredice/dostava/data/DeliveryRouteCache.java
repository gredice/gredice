package com.gredice.dostava.data;

/** Encrypted single-snapshot cache boundary used only for short offline recovery. */
public interface DeliveryRouteCache {
    DeliveryRouteSnapshot read();

    void write(DeliveryRouteSnapshot snapshot);

    void clear();
}
