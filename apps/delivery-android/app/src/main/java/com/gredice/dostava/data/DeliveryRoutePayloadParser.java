package com.gredice.dostava.data;

import com.gredice.dostava.auth.ApiFailure;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Strict runtime validation for the source v1 route contract. */
public final class DeliveryRoutePayloadParser {
    private static final int SCHEMA_VERSION = 1;
    private static final int MAXIMUM_STOPS = 5;
    private static final Pattern GENERIC_LABEL = Pattern.compile(
            "^(Preuzimanje|Dostava) [1-9][0-9]*$"
    );
    private static final Pattern ENTITY_TAG = Pattern.compile(
            "^(W/)?\"[\\x21\\x23-\\x7E]{1,250}\"$"
    );
    private static final Set<String> ROOT_KEYS = immutableSet(
            "schemaVersion",
            "generatedAt",
            "route"
    );
    private static final Set<String> ROUTE_KEYS = immutableSet(
            "id",
            "revision",
            "state",
            "reroutePending",
            "currentNavigationId",
            "stops"
    );
    private static final Set<String> STOP_KEYS = immutableSet(
            "navigationId",
            "kind",
            "sequence",
            "actionState",
            "label",
            "address",
            "latitude",
            "longitude",
            "estimatedArrivalAt",
            "travelSeconds",
            "distanceMeters"
    );

    public DeliveryRouteResponse parse(
            JSONObject root,
            String etag,
            long verifiedAtMillis
    ) throws ApiFailure {
        try {
            requireOnlyKeys(root, ROOT_KEYS);
            if (readLong(root, "schemaVersion", 0, Integer.MAX_VALUE)
                    != SCHEMA_VERSION) {
                throw unsupported();
            }
            parseInstant(readString(root, "generatedAt", 1, 64));
            if (root.isNull("route")) return DeliveryRouteResponse.empty();
            if (etag == null || !ENTITY_TAG.matcher(etag).matches()) {
                throw invalid();
            }

            JSONObject route = root.getJSONObject("route");
            requireOnlyKeys(route, ROUTE_KEYS);
            String routeId = readString(route, "id", 1, 128);
            long revision = readLong(route, "revision", 0, Long.MAX_VALUE);
            if (!"active".equals(route.getString("state"))) throw invalid();
            route.getBoolean("reroutePending");
            String currentNavigationId = route.isNull("currentNavigationId")
                    ? null
                    : readString(route, "currentNavigationId", 1, 96);
            JSONArray sourceStops = route.getJSONArray("stops");
            if (sourceStops.length() > MAXIMUM_STOPS) throw invalid();

            List<DeliveryStop> stops = new ArrayList<>();
            for (int index = 0; index < sourceStops.length(); index++) {
                stops.add(parseStop(sourceStops.getJSONObject(index)));
            }
            validateOrder(stops, currentNavigationId);
            return DeliveryRouteResponse.active(new DeliveryRouteSnapshot(
                    routeId,
                    revision,
                    currentNavigationId,
                    stops,
                    etag,
                    verifiedAtMillis
            ));
        } catch (ApiFailure failure) {
            throw failure;
        } catch (JSONException | DateTimeParseException exception) {
            throw invalid();
        }
    }

    public JSONObject toJson(DeliveryRouteSnapshot snapshot) throws JSONException {
        JSONObject route = new JSONObject();
        JSONArray stops = new JSONArray();
        for (DeliveryStop stop : snapshot.getStops()) {
            JSONObject encoded = new JSONObject();
            encoded.put("navigationId", stop.getNavigationId());
            encoded.put("kind", stop.getKind());
            encoded.put("sequence", stop.getSequence());
            encoded.put("actionState", stop.getActionState());
            encoded.put("label", stop.getTitle());
            encoded.put("address", stop.getAddress());
            encoded.put("latitude", stop.getLatitude());
            encoded.put("longitude", stop.getLongitude());
            encoded.put(
                    "estimatedArrivalAt",
                    stop.getEstimatedArrivalAtMillis() == null
                            ? JSONObject.NULL
                            : Instant.ofEpochMilli(
                                    stop.getEstimatedArrivalAtMillis()
                            ).toString()
            );
            encoded.put(
                    "travelSeconds",
                    stop.getTravelSeconds() == null
                            ? JSONObject.NULL
                            : stop.getTravelSeconds()
            );
            encoded.put(
                    "distanceMeters",
                    stop.getDistanceMeters() == null
                            ? JSONObject.NULL
                            : stop.getDistanceMeters()
            );
            stops.put(encoded);
        }
        route.put("id", snapshot.getRouteId());
        route.put("revision", snapshot.getRevision());
        route.put("state", "active");
        route.put("reroutePending", false);
        route.put(
                "currentNavigationId",
                snapshot.getCurrentNavigationId() == null
                        ? JSONObject.NULL
                        : snapshot.getCurrentNavigationId()
        );
        route.put("stops", stops);

        JSONObject root = new JSONObject();
        root.put("schemaVersion", SCHEMA_VERSION);
        root.put(
                "generatedAt",
                Instant.ofEpochMilli(snapshot.getVerifiedAtMillis()).toString()
        );
        root.put("route", route);
        return root;
    }

    private DeliveryStop parseStop(JSONObject stop) throws ApiFailure, JSONException {
        requireOnlyKeys(stop, STOP_KEYS);
        String navigationId = readString(stop, "navigationId", 1, 96);
        String kind = readString(stop, "kind", 1, 16);
        if (!("pickup".equals(kind) || "delivery".equals(kind))) throw invalid();
        long sequence = readLong(stop, "sequence", 1, 999);
        String actionState = readString(stop, "actionState", 1, 16);
        if (!("current".equals(actionState) || "upcoming".equals(actionState))) {
            throw invalid();
        }
        String label = readString(stop, "label", 1, 80);
        if (!GENERIC_LABEL.matcher(label).matches()) throw invalid();
        String address = readString(stop, "address", 1, 300);
        double latitude = readFiniteDouble(stop, "latitude", -90, 90);
        double longitude = readFiniteDouble(stop, "longitude", -180, 180);
        Long estimatedArrivalAtMillis = stop.isNull("estimatedArrivalAt")
                ? null
                : parseInstant(readString(stop, "estimatedArrivalAt", 1, 64));
        Long travelSeconds = readNullableLong(stop, "travelSeconds");
        Long distanceMeters = readNullableLong(stop, "distanceMeters");
        return new DeliveryStop(
                navigationId,
                kind,
                (int) sequence,
                actionState,
                label,
                address,
                latitude,
                longitude,
                estimatedArrivalAtMillis,
                travelSeconds,
                distanceMeters
        );
    }

    private void validateOrder(
            List<DeliveryStop> stops,
            String currentNavigationId
    ) throws ApiFailure {
        boolean currentSeen = false;
        int previousSequence = 0;
        for (int index = 0; index < stops.size(); index++) {
            DeliveryStop stop = stops.get(index);
            if (stop.getSequence() <= previousSequence) throw invalid();
            previousSequence = stop.getSequence();
            if (stop.isCurrent()) {
                if (currentSeen || index != 0) throw invalid();
                currentSeen = true;
                if (!stop.getNavigationId().equals(currentNavigationId)) {
                    throw invalid();
                }
            }
        }
        if ((currentNavigationId == null) != !currentSeen) throw invalid();
    }

    private static Set<String> immutableSet(String... values) {
        return Collections.unmodifiableSet(new HashSet<>(Arrays.asList(values)));
    }

    private void requireOnlyKeys(JSONObject value, Set<String> expected)
            throws ApiFailure {
        Iterator<String> keys = value.keys();
        int count = 0;
        while (keys.hasNext()) {
            count += 1;
            if (!expected.contains(keys.next())) throw invalid();
        }
        if (count != expected.size()) throw invalid();
    }

    private String readString(
            JSONObject value,
            String key,
            int minimumLength,
            int maximumLength
    ) throws JSONException, ApiFailure {
        String result = value.getString(key);
        if (result.length() < minimumLength || result.length() > maximumLength) {
            throw invalid();
        }
        return result;
    }

    private long readLong(
            JSONObject value,
            String key,
            long minimum,
            long maximum
    ) throws JSONException, ApiFailure {
        Object raw = value.get(key);
        if (!(raw instanceof Number)) throw invalid();
        double doubleValue = ((Number) raw).doubleValue();
        if (!Double.isFinite(doubleValue)
                || doubleValue != Math.rint(doubleValue)
                || doubleValue < minimum
                || doubleValue > maximum) {
            throw invalid();
        }
        return ((Number) raw).longValue();
    }

    private Long readNullableLong(JSONObject value, String key)
            throws JSONException, ApiFailure {
        return value.isNull(key)
                ? null
                : readLong(value, key, 0, Long.MAX_VALUE);
    }

    private double readFiniteDouble(
            JSONObject value,
            String key,
            double minimum,
            double maximum
    ) throws JSONException, ApiFailure {
        double result = value.getDouble(key);
        if (!Double.isFinite(result) || result < minimum || result > maximum) {
            throw invalid();
        }
        return result;
    }

    private long parseInstant(String value) {
        return Instant.parse(value).toEpochMilli();
    }

    private ApiFailure invalid() {
        return new ApiFailure(502, "ROUTE_RESPONSE_INVALID");
    }

    private ApiFailure unsupported() {
        return new ApiFailure(502, "ROUTE_RESPONSE_UNSUPPORTED");
    }
}
