package com.gredice.dostava.data;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import com.gredice.dostava.auth.ApiFailure;

import org.json.JSONObject;
import org.junit.Test;

public final class DeliveryRoutePayloadParserTest {
    private static final String ETAG = "\"route-v7\"";
    private final DeliveryRoutePayloadParser parser = new DeliveryRoutePayloadParser();

    @Test
    public void parsesTheStrictPrivacyMinimizedV1Contract() throws Exception {
        DeliveryRouteResponse response = parser.parse(validPayload(), ETAG, 9_000L);

        assertEquals(DeliveryRouteResponse.Kind.ACTIVE, response.getKind());
        assertEquals(7, response.getSnapshot().getRevision());
        assertEquals(2, response.getSnapshot().getStops().size());
        assertEquals("delivery:opaque-3", response.getSnapshot().getCurrentNavigationId());
        assertEquals(ETAG, response.getSnapshot().getEtag());
    }

    @Test
    public void rejectsUnknownSchemaVersionsAsUnsupported() throws Exception {
        JSONObject payload = validPayload().put("schemaVersion", 2);

        ApiFailure failure = assertThrows(
                ApiFailure.class,
                () -> parser.parse(payload, ETAG, 9_000L)
        );

        assertEquals("ROUTE_RESPONSE_UNSUPPORTED", failure.getErrorCode());
    }

    @Test
    public void rejectsUnexpectedCustomerData() throws Exception {
        JSONObject payload = validPayload();
        payload.getJSONObject("route")
                .getJSONArray("stops")
                .getJSONObject(0)
                .put("customerName", "Must not reach the car");

        assertInvalid(payload);
    }

    @Test
    public void rejectsAnUnsafeResponseEntityTag() throws Exception {
        ApiFailure failure = assertThrows(
                ApiFailure.class,
                () -> parser.parse(validPayload(), "\"safe\"\r\nInjected: yes", 9_000L)
        );

        assertEquals("ROUTE_RESPONSE_INVALID", failure.getErrorCode());
    }

    @Test
    public void rejectsInvalidCoordinatesAndNonCanonicalCurrentOrdering() throws Exception {
        JSONObject badCoordinates = validPayload();
        badCoordinates.getJSONObject("route")
                .getJSONArray("stops")
                .getJSONObject(0)
                .put("latitude", 91);
        assertInvalid(badCoordinates);

        JSONObject badOrder = validPayload();
        badOrder.getJSONObject("route")
                .getJSONArray("stops")
                .getJSONObject(0)
                .put("actionState", "upcoming");
        assertInvalid(badOrder);
    }

    @Test
    public void rejectsSequencesThatCannotFitAPlaceMarkerLabel() throws Exception {
        JSONObject payload = validPayload();
        payload.getJSONObject("route")
                .getJSONArray("stops")
                .getJSONObject(0)
                .put("sequence", 1_000)
                .put("label", "Dostava 1000");

        assertInvalid(payload);
    }

    @Test
    public void encryptedCacheCodecPreservesTheValidatedSnapshot() {
        DeliveryRouteSnapshot snapshot = TestDeliveryRoutes.snapshot(12, 50_000L);
        DeliveryRouteCacheCodec codec = new DeliveryRouteCacheCodec();

        DeliveryRouteSnapshot decoded = codec.decode(codec.encode(snapshot));

        assertEquals(snapshot, decoded);
    }

    private void assertInvalid(JSONObject payload) {
        ApiFailure failure = assertThrows(
                ApiFailure.class,
                () -> parser.parse(payload, ETAG, 9_000L)
        );
        assertEquals("ROUTE_RESPONSE_INVALID", failure.getErrorCode());
    }

    private JSONObject validPayload() throws Exception {
        return new JSONObject("""
                {
                  "schemaVersion": 1,
                  "generatedAt": "2026-08-29T10:00:00Z",
                  "route": {
                    "id": "route-opaque",
                    "revision": 7,
                    "state": "active",
                    "reroutePending": false,
                    "currentNavigationId": "delivery:opaque-3",
                    "stops": [
                      {
                        "navigationId": "delivery:opaque-3",
                        "kind": "delivery",
                        "sequence": 3,
                        "actionState": "current",
                        "label": "Dostava 3",
                        "address": "Testna adresa 3",
                        "latitude": 45.81,
                        "longitude": 16.01,
                        "estimatedArrivalAt": "2026-08-29T10:15:00Z",
                        "travelSeconds": 900,
                        "distanceMeters": 4200
                      },
                      {
                        "navigationId": "pickup:opaque-4",
                        "kind": "pickup",
                        "sequence": 4,
                        "actionState": "upcoming",
                        "label": "Preuzimanje 4",
                        "address": "Testna adresa 4",
                        "latitude": 45.82,
                        "longitude": 16.02,
                        "estimatedArrivalAt": null,
                        "travelSeconds": null,
                        "distanceMeters": 6300
                      }
                    ]
                  }
                }
                """);
    }
}
