package com.gredice.dostava.auth;

/** Credentials returned only in an HTTPS response body. */
public final class NativeTokenResponse {
    private final String accessToken;
    private final long accessExpiresInSeconds;
    private final String refreshToken;

    public NativeTokenResponse(
            String accessToken,
            long accessExpiresInSeconds,
            String refreshToken
    ) {
        this.accessToken = accessToken;
        this.accessExpiresInSeconds = accessExpiresInSeconds;
        this.refreshToken = refreshToken;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public long getAccessExpiresInSeconds() {
        return accessExpiresInSeconds;
    }

    public String getRefreshToken() {
        return refreshToken;
    }
}
