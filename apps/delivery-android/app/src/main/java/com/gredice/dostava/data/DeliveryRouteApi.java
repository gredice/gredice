package com.gredice.dostava.data;

import com.gredice.dostava.auth.ApiFailure;

public interface DeliveryRouteApi {
    DeliveryRouteResponse getActiveRoute(
            String accessToken,
            String etag
    ) throws ApiFailure;
}
