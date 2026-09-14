package com.gredice.dostava.auth;

/** Ephemeral PKCE material retained only while browser authorization is in progress. */
public final class PairingRequest {
    private final String state;
    private final String verifier;
    private final String challenge;
    private final long createdAtMillis;

    public PairingRequest(
            String state,
            String verifier,
            String challenge,
            long createdAtMillis
    ) {
        this.state = state;
        this.verifier = verifier;
        this.challenge = challenge;
        this.createdAtMillis = createdAtMillis;
    }

    public String getState() {
        return state;
    }

    public String getVerifier() {
        return verifier;
    }

    public String getChallenge() {
        return challenge;
    }

    public long getCreatedAtMillis() {
        return createdAtMillis;
    }
}
