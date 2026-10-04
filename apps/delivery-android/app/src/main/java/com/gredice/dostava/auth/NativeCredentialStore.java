package com.gredice.dostava.auth;

/** Keystore-backed persistence boundary for process recovery. */
public interface NativeCredentialStore {
    String getRefreshToken();

    void setRefreshToken(String refreshToken);

    String getSessionBinding();

    PairingRequest getPairingRequest();

    void setPairingRequest(PairingRequest request);

    void clearPairingRequest();

    void clearSession();
}
