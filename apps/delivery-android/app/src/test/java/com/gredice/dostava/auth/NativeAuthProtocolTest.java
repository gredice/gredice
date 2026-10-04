package com.gredice.dostava.auth;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import org.junit.Test;

public final class NativeAuthProtocolTest {
    private static final long NOW = 10_000L;
    private static final String CODE =
            "123e4567-e89b-12d3-a456-426614174000.abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";

    @Test
    public void createsOnlyTheFixedPublicClientS256AuthorizationRequest() {
        PairingRequest request = NativeAuthProtocol.createPairingRequest(NOW);
        URI uri = URI.create(NativeAuthProtocol.authorizationUrl(request));
        Map<String, String> query = query(uri.getRawQuery());

        assertEquals("https", uri.getScheme());
        assertEquals("dostava.gredice.com", uri.getHost());
        assertEquals("/prijava/android", uri.getPath());
        assertEquals("gredice-delivery-android", query.get("client_id"));
        assertEquals(NativeAuthProtocol.REDIRECT_URI, query.get("redirect_uri"));
        assertEquals("S256", query.get("code_challenge_method"));
        assertEquals(request.getChallenge(), query.get("code_challenge"));
        assertEquals(request.getState(), query.get("state"));
        assertEquals(5, query.size());
        assertEquals(43, request.getState().length());
        assertTrue(request.getVerifier().length() >= 43);
    }

    @Test
    public void acceptsOnlyAnExactVerifiedCallbackWithMatchingState() {
        PairingRequest request = NativeAuthProtocol.createPairingRequest(NOW);
        String callback = NativeAuthProtocol.REDIRECT_URI
                + "?code=" + CODE
                + "&state=" + request.getState();
        NativeAuthProtocol.CallbackResult result = NativeAuthProtocol.validateCallback(
                callback,
                request,
                NOW + 1_000L
        );

        assertTrue(result.isSuccess());
        assertEquals(CODE, result.getCode());
        assertEquals(null, result.getErrorCode());
    }

    @Test
    public void rejectsWrongStateUnexpectedRoutesAndExtraCredentialParameters() {
        PairingRequest request = NativeAuthProtocol.createPairingRequest(NOW);
        String base = "?code=" + CODE + "&state=";

        for (String callback : new String[]{
                NativeAuthProtocol.REDIRECT_URI + base
                        + "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
                "http://dostava.gredice.com/android/auth/callback" + base
                        + request.getState(),
                "https://dostava.gredice.com/other" + base + request.getState(),
                NativeAuthProtocol.REDIRECT_URI + base + request.getState()
                        + "&access_token=forbidden",
                NativeAuthProtocol.REDIRECT_URI + "?code=" + CODE,
                NativeAuthProtocol.REDIRECT_URI + base + request.getState()
                        + "&state=" + request.getState()
        }) {
            assertFalse(NativeAuthProtocol.validateCallback(
                    callback,
                    request,
                    NOW + 1_000L
            ).isSuccess());
        }
    }

    @Test
    public void rejectsExpiredPairingState() {
        PairingRequest request = NativeAuthProtocol.createPairingRequest(NOW);
        String callback = NativeAuthProtocol.REDIRECT_URI
                + "?code=" + CODE
                + "&state=" + request.getState();

        assertEquals(
                "PAIRING_REQUEST_EXPIRED",
                NativeAuthProtocol.validateCallback(
                        callback,
                        request,
                        NOW + 10 * 60 * 1_000L + 1
                ).getErrorCode()
        );
    }

    private Map<String, String> query(String rawQuery) {
        Map<String, String> values = new HashMap<>();
        for (String pair : rawQuery.split("&")) {
            String[] parts = pair.split("=", 2);
            values.put(
                    URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                    URLDecoder.decode(parts[1], StandardCharsets.UTF_8)
            );
        }
        return values;
    }
}
