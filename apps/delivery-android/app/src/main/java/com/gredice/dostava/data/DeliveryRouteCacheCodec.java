package com.gredice.dostava.data;

import com.gredice.dostava.auth.ApiFailure;

import org.json.JSONException;
import org.json.JSONObject;

/** Strict serialization for the one encrypted bounded route snapshot. */
final class DeliveryRouteCacheCodec {
    private final DeliveryRoutePayloadParser parser = new DeliveryRoutePayloadParser();

    String encode(DeliveryRouteSnapshot snapshot) {
        try {
            JSONObject cache = new JSONObject();
            cache.put("etag", snapshot.getEtag());
            cache.put("verifiedAtMillis", snapshot.getVerifiedAtMillis());
            cache.put("payload", parser.toJson(snapshot));
            return cache.toString();
        } catch (JSONException exception) {
            throw new IllegalStateException("Unable to encode route cache", exception);
        }
    }

    DeliveryRouteSnapshot decode(String value) {
        try {
            JSONObject cache = new JSONObject(value);
            if (cache.length() != 3) throw new IllegalArgumentException("Invalid cache");
            String etag = cache.getString("etag");
            long verifiedAtMillis = cache.getLong("verifiedAtMillis");
            if (verifiedAtMillis < 0) throw new IllegalArgumentException("Invalid cache");
            DeliveryRouteResponse response = parser.parse(
                    cache.getJSONObject("payload"),
                    etag,
                    verifiedAtMillis
            );
            if (response.getKind() != DeliveryRouteResponse.Kind.ACTIVE) {
                throw new IllegalArgumentException("Invalid cache route");
            }
            return response.getSnapshot();
        } catch (JSONException | ApiFailure exception) {
            throw new IllegalArgumentException("Invalid route cache", exception);
        }
    }
}
