package com.gredice.dostava.data;

import com.gredice.dostava.auth.ApiFailure;

import java.util.List;

public interface DeliveryRouteApi {
    List<DeliveryStop> getActiveRoute(String accessToken) throws ApiFailure;
}
