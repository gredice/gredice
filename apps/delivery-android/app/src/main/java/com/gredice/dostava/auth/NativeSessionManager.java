package com.gredice.dostava.auth;

/** Keeps access material in memory and serializes rotating refresh credentials. */
public final class NativeSessionManager {
    private static final long ACCESS_EXPIRY_SKEW_MILLIS = 30_000L;

    private final NativeCredentialStore credentialStore;
    private final NativeAuthApi authApi;
    private final Clock clock;
    private String accessToken;
    private long accessExpiresAtMillis;
    private boolean credentialOperationInProgress;

    public NativeSessionManager(
            NativeCredentialStore credentialStore,
            NativeAuthApi authApi,
            Clock clock
    ) {
        this.credentialStore = credentialStore;
        this.authApi = authApi;
        this.clock = clock;
    }

    public NativeSessionManager(
            NativeCredentialStore credentialStore,
            NativeAuthApi authApi
    ) {
        this(credentialStore, authApi, System::currentTimeMillis);
    }

    public boolean hasSession() {
        return credentialStore.getRefreshToken() != null;
    }

    public void completePairing(String code, String verifier) throws ApiFailure {
        beginCredentialOperation();
        try {
            acceptSafely(authApi.exchange(code, verifier));
            credentialStore.clearPairingRequest();
        } finally {
            endCredentialOperation();
        }
    }

    public <T> T executeAuthorized(AuthorizedRequest<T> request) throws ApiFailure {
        String attemptedToken = accessToken();
        try {
            return request.execute(attemptedToken);
        } catch (ApiFailure failure) {
            if (failure.getStatusCode() != 401) throw failure;
        }

        String refreshedToken = refreshAfterUnauthorized(attemptedToken);
        try {
            return request.execute(refreshedToken);
        } catch (ApiFailure failure) {
            if (failure.getStatusCode() == 401) {
                clearLocalSessionAfterUnauthorized();
            }
            throw failure;
        }
    }

    public void logout() {
        try {
            beginCredentialOperation();
        } catch (ApiFailure interrupted) {
            clearLocalSession();
            return;
        }
        try {
            String refreshToken = credentialStore.getRefreshToken();
            if (refreshToken != null) authApi.revoke(refreshToken);
        } catch (ApiFailure ignored) {
            // Local removal is authoritative for this device even when offline.
        } finally {
            clearLocalSession();
            endCredentialOperation();
        }
    }

    private void clearLocalSession() {
        synchronized (this) {
            accessToken = null;
            accessExpiresAtMillis = 0;
        }
        credentialStore.clearSession();
    }

    private void clearLocalSessionAfterUnauthorized() {
        try {
            beginCredentialOperation();
        } catch (ApiFailure interrupted) {
            clearLocalSession();
            return;
        }
        try {
            clearLocalSession();
        } finally {
            endCredentialOperation();
        }
    }

    private String accessToken() throws ApiFailure {
        synchronized (this) {
            if (isAccessTokenUsable()) return accessToken;
        }
        return refreshSerialized(null);
    }

    private String refreshAfterUnauthorized(String failedToken) throws ApiFailure {
        return refreshSerialized(failedToken);
    }

    private String refreshSerialized(String failedToken) throws ApiFailure {
        synchronized (this) {
            waitForCredentialOperation();
            if (failedToken == null && isAccessTokenUsable()) return accessToken;
            if (failedToken != null
                    && accessToken != null
                    && !failedToken.equals(accessToken)
                    && isAccessTokenUsable()) {
                return accessToken;
            }
            credentialOperationInProgress = true;
        }

        try {
            String refreshToken = credentialStore.getRefreshToken();
            if (refreshToken == null) {
                throw new ApiFailure(401, "SESSION_REQUIRED");
            }
            NativeTokenResponse response = authApi.refresh(refreshToken);
            acceptSafely(response);
            return response.getAccessToken();
        } catch (ApiFailure failure) {
            if (failure.getStatusCode() == 401 || failure.getStatusCode() == 403) {
                clearLocalSession();
            }
            throw failure;
        } finally {
            endCredentialOperation();
        }
    }

    private void beginCredentialOperation() throws ApiFailure {
        synchronized (this) {
            waitForCredentialOperation();
            credentialOperationInProgress = true;
        }
    }

    private void waitForCredentialOperation() throws ApiFailure {
        while (credentialOperationInProgress) {
            try {
                wait();
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new ApiFailure(503, "REFRESH_INTERRUPTED");
            }
        }
    }

    private void endCredentialOperation() {
        synchronized (this) {
            credentialOperationInProgress = false;
            notifyAll();
        }
    }

    private void accept(NativeTokenResponse response) {
        credentialStore.setRefreshToken(response.getRefreshToken());
        synchronized (this) {
            accessToken = response.getAccessToken();
            accessExpiresAtMillis = clock.nowMillis()
                    + response.getAccessExpiresInSeconds() * 1_000L;
        }
    }

    private void acceptSafely(NativeTokenResponse response) throws ApiFailure {
        try {
            accept(response);
        } catch (RuntimeException storageFailure) {
            try {
                authApi.revoke(response.getRefreshToken());
            } catch (ApiFailure ignored) {
                // The unavailable credential is still cleared locally below.
            }
            clearLocalSession();
            throw new ApiFailure(503, "CREDENTIAL_STORAGE_FAILED");
        }
    }

    private boolean isAccessTokenUsable() {
        return accessToken != null
                && accessExpiresAtMillis - ACCESS_EXPIRY_SKEW_MILLIS > clock.nowMillis();
    }

    public interface AuthorizedRequest<T> {
        T execute(String accessToken) throws ApiFailure;
    }

    public interface Clock {
        long nowMillis();
    }
}
