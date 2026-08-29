package com.gredice.dostava.auth;

import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** Fixed public-client PKCE and verified callback contract. */
public final class NativeAuthProtocol {
    public static final String CLIENT_ID = "gredice-delivery-android";
    public static final String REDIRECT_URI =
            "https://dostava.gredice.com/android/auth/callback";
    public static final String AUTHORIZATION_URI =
            "https://dostava.gredice.com/prijava/android";
    private static final long REQUEST_LIFETIME_MILLIS = 10 * 60 * 1000L;
    private static final Pattern CALLBACK_CODE = Pattern.compile(
            "^[0-9a-fA-F-]{36}\\.[A-Za-z0-9_-]{43}$"
    );
    private static final Pattern STATE = Pattern.compile("^[A-Za-z0-9_-]{43}$");

    private NativeAuthProtocol() {
    }

    public static PairingRequest createPairingRequest(long nowMillis) {
        SecureRandom random = new SecureRandom();
        String state = randomValue(random, 32);
        String verifier = randomValue(random, 64);
        return new PairingRequest(
                state,
                verifier,
                sha256Base64Url(verifier),
                nowMillis
        );
    }

    public static String authorizationUrl(PairingRequest request) {
        return AUTHORIZATION_URI
                + "?client_id=" + encode(CLIENT_ID)
                + "&redirect_uri=" + encode(REDIRECT_URI)
                + "&code_challenge=" + encode(request.getChallenge())
                + "&code_challenge_method=S256"
                + "&state=" + encode(request.getState());
    }

    public static CallbackResult validateCallback(
            String callbackUrl,
            PairingRequest request,
            long nowMillis
    ) {
        if (callbackUrl == null
                || request == null
                || nowMillis - request.getCreatedAtMillis() < 0
                || nowMillis - request.getCreatedAtMillis() > REQUEST_LIFETIME_MILLIS) {
            return CallbackResult.failure("PAIRING_REQUEST_EXPIRED");
        }

        URI uri;
        try {
            uri = URI.create(callbackUrl);
        } catch (IllegalArgumentException exception) {
            return CallbackResult.failure("CALLBACK_INVALID");
        }
        if (!"https".equals(uri.getScheme())
                || !"dostava.gredice.com".equals(uri.getHost())
                || uri.getPort() != -1
                || uri.getUserInfo() != null
                || !"/android/auth/callback".equals(uri.getPath())
                || uri.getFragment() != null) {
            return CallbackResult.failure("CALLBACK_INVALID");
        }

        Map<String, String> query;
        try {
            query = parseExactQuery(uri.getRawQuery());
        } catch (IllegalArgumentException exception) {
            return CallbackResult.failure("CALLBACK_INVALID");
        }
        if (query == null || query.size() != 2) {
            return CallbackResult.failure("CALLBACK_INVALID");
        }
        String code = query.get("code");
        String state = query.get("state");
        if (code == null
                || !CALLBACK_CODE.matcher(code).matches()
                || state == null
                || !STATE.matcher(state).matches()) {
            return CallbackResult.failure("CALLBACK_INVALID");
        }
        if (!MessageDigest.isEqual(
                state.getBytes(StandardCharsets.UTF_8),
                request.getState().getBytes(StandardCharsets.UTF_8)
        )) {
            return CallbackResult.failure("STATE_MISMATCH");
        }
        return CallbackResult.success(code);
    }

    private static Map<String, String> parseExactQuery(String rawQuery) {
        if (rawQuery == null || rawQuery.isEmpty()) {
            return null;
        }
        Map<String, String> values = new HashMap<>();
        for (String pair : rawQuery.split("&")) {
            int separator = pair.indexOf('=');
            if (separator <= 0) return null;
            String key = decode(pair.substring(0, separator));
            String value = decode(pair.substring(separator + 1));
            if (!("code".equals(key) || "state".equals(key))
                    || values.put(key, value) != null) {
                return null;
            }
        }
        return values;
    }

    private static String randomValue(SecureRandom random, int byteCount) {
        byte[] bytes = new byte[byteCount];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256Base64Url(String value) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    MessageDigest.getInstance("SHA-256").digest(
                            value.getBytes(StandardCharsets.US_ASCII)
                    )
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }

    private static String encode(String value) {
        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
        } catch (UnsupportedEncodingException exception) {
            throw new IllegalStateException("UTF-8 is required", exception);
        }
    }

    private static String decode(String value) {
        try {
            return URLDecoder.decode(value, StandardCharsets.UTF_8.name());
        } catch (UnsupportedEncodingException exception) {
            throw new IllegalStateException("UTF-8 is required", exception);
        }
    }

    public static final class CallbackResult {
        private final String code;
        private final String errorCode;

        private CallbackResult(String code, String errorCode) {
            this.code = code;
            this.errorCode = errorCode;
        }

        static CallbackResult success(String code) {
            return new CallbackResult(code, null);
        }

        static CallbackResult failure(String errorCode) {
            return new CallbackResult(null, errorCode);
        }

        public boolean isSuccess() {
            return code != null;
        }

        public String getCode() {
            return code;
        }

        public String getErrorCode() {
            return errorCode;
        }
    }
}
