package com.gredice.dostava.auth;

/** Bounded API failure without response bodies or credential material. */
public final class ApiFailure extends Exception {
    private final int statusCode;
    private final String errorCode;

    public ApiFailure(int statusCode, String errorCode) {
        super(errorCode);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
