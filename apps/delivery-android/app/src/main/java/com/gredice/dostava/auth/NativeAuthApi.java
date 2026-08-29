package com.gredice.dostava.auth;

public interface NativeAuthApi {
    NativeTokenResponse exchange(String code, String verifier) throws ApiFailure;

    NativeTokenResponse refresh(String refreshToken) throws ApiFailure;

    void revoke(String refreshToken) throws ApiFailure;
}
