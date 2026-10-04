package com.gredice.dostava.auth;

import com.gredice.dostava.data.DeliveryRouteApi;
import com.gredice.dostava.data.DeliveryRoutePayloadParser;
import com.gredice.dostava.data.DeliveryRouteResponse;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/** Minimal HTTPS client for the versioned read-only Delivery Mobile API. */
public final class DeliveryNativeApiClient implements NativeAuthApi, DeliveryRouteApi {
    private static final String API_ROOT =
            "https://api.gredice.com/api/delivery/mobile/v1";
    private static final int TIMEOUT_MILLIS = 15_000;
    private static final int MAX_BODY_BYTES = 64 * 1024;
    private static final Pattern SAFE_ERROR_CODE = Pattern.compile("^[A-Z_]{1,64}$");
    private final DeliveryRoutePayloadParser routeParser =
            new DeliveryRoutePayloadParser();

    @Override
    public NativeTokenResponse exchange(String code, String verifier) throws ApiFailure {
        JSONObject body = new JSONObject();
        try {
            body.put("grant_type", "authorization_code");
            body.put("client_id", NativeAuthProtocol.CLIENT_ID);
            body.put("redirect_uri", NativeAuthProtocol.REDIRECT_URI);
            body.put("code", code);
            body.put("code_verifier", verifier);
        } catch (JSONException exception) {
            throw new ApiFailure(500, "REQUEST_ENCODING_FAILED");
        }
        return parseTokenResponse(post("/auth/token", body));
    }

    @Override
    public NativeTokenResponse refresh(String refreshToken) throws ApiFailure {
        JSONObject body = new JSONObject();
        try {
            body.put("grant_type", "refresh_token");
            body.put("client_id", NativeAuthProtocol.CLIENT_ID);
            body.put("refresh_token", refreshToken);
        } catch (JSONException exception) {
            throw new ApiFailure(500, "REQUEST_ENCODING_FAILED");
        }
        return parseTokenResponse(post("/auth/refresh", body));
    }

    @Override
    public void revoke(String refreshToken) throws ApiFailure {
        JSONObject body = new JSONObject();
        try {
            body.put("client_id", NativeAuthProtocol.CLIENT_ID);
            body.put("refresh_token", refreshToken);
        } catch (JSONException exception) {
            throw new ApiFailure(500, "REQUEST_ENCODING_FAILED");
        }
        post("/auth/revoke", body);
    }

    @Override
    public DeliveryRouteResponse getActiveRoute(
            String accessToken,
            String etag
    ) throws ApiFailure {
        JsonHttpResponse response = request(
                "GET",
                "/active-route",
                null,
                accessToken,
                etag
        );
        if (response.statusCode == HttpURLConnection.HTTP_NOT_MODIFIED) {
            return DeliveryRouteResponse.notModified();
        }
        return routeParser.parse(
                response.body,
                response.etag,
                System.currentTimeMillis()
        );
    }

    private JSONObject post(String path, JSONObject body) throws ApiFailure {
        return request("POST", path, body, null, null).body;
    }

    private JsonHttpResponse request(
            String method,
            String path,
            JSONObject body,
            String accessToken,
            String etag
    ) throws ApiFailure {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(API_ROOT + path).openConnection();
            connection.setRequestMethod(method);
            connection.setConnectTimeout(TIMEOUT_MILLIS);
            connection.setReadTimeout(TIMEOUT_MILLIS);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "application/json");
            if (accessToken != null) {
                connection.setRequestProperty("Authorization", "Bearer " + accessToken);
            }
            if (etag != null) {
                connection.setRequestProperty("If-None-Match", etag);
            }
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(payload);
                }
            }

            int status = connection.getResponseCode();
            String responseEtag = connection.getHeaderField("ETag");
            if (status == HttpURLConnection.HTTP_NOT_MODIFIED) {
                return new JsonHttpResponse(status, new JSONObject(), responseEtag);
            }
            InputStream stream = status >= 400
                    ? connection.getErrorStream()
                    : connection.getInputStream();
            String responseBody = readBounded(stream);
            if (status < 200 || status >= 300) {
                throw new ApiFailure(status, safeErrorCode(responseBody, status));
            }
            JSONObject response = status == HttpURLConnection.HTTP_NO_CONTENT
                    || responseBody.isEmpty()
                    ? new JSONObject()
                    : new JSONObject(responseBody);
            return new JsonHttpResponse(status, response, responseEtag);
        } catch (ApiFailure failure) {
            throw failure;
        } catch (IOException exception) {
            throw new ApiFailure(503, "NETWORK_UNAVAILABLE");
        } catch (JSONException exception) {
            throw new ApiFailure(502, "RESPONSE_INVALID");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private NativeTokenResponse parseTokenResponse(JSONObject response) throws ApiFailure {
        try {
            String accessToken = response.getString("access_token");
            String refreshToken = response.getString("refresh_token");
            long expiresIn = response.getLong("expires_in");
            if (!"Bearer".equals(response.getString("token_type"))
                    || !"delivery:route:read".equals(response.getString("scope"))
                    || accessToken.isEmpty()
                    || accessToken.length() > 8_192
                    || refreshToken.isEmpty()
                    || refreshToken.length() > 256
                    || expiresIn <= 0
                    || expiresIn > 900) {
                throw new ApiFailure(502, "TOKEN_RESPONSE_INVALID");
            }
            return new NativeTokenResponse(accessToken, expiresIn, refreshToken);
        } catch (JSONException exception) {
            throw new ApiFailure(502, "TOKEN_RESPONSE_INVALID");
        }
    }

    private String safeErrorCode(String responseBody, int status) {
        try {
            String code = new JSONObject(responseBody).optString("code");
            return SAFE_ERROR_CODE.matcher(code).matches()
                    ? code
                    : "HTTP_" + status;
        } catch (JSONException exception) {
            return "HTTP_" + status;
        }
    }

    private String readBounded(InputStream input) throws IOException, ApiFailure {
        if (input == null) return "";
        try (InputStream stream = input;
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4_096];
            int total = 0;
            int read;
            while ((read = stream.read(buffer)) != -1) {
                total += read;
                if (total > MAX_BODY_BYTES) {
                    throw new ApiFailure(502, "RESPONSE_TOO_LARGE");
                }
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static final class JsonHttpResponse {
        private final int statusCode;
        private final JSONObject body;
        private final String etag;

        private JsonHttpResponse(int statusCode, JSONObject body, String etag) {
            this.statusCode = statusCode;
            this.body = body;
            this.etag = etag;
        }
    }
}
