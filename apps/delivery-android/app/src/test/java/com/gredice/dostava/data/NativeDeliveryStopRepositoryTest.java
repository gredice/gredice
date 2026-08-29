package com.gredice.dostava.data;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import com.gredice.dostava.auth.NativeAuthApi;
import com.gredice.dostava.auth.NativeCredentialStore;
import com.gredice.dostava.auth.NativeSessionManager;
import com.gredice.dostava.auth.NativeTokenResponse;
import com.gredice.dostava.auth.PairingRequest;

import java.util.Collections;
import java.util.concurrent.Executor;

import org.junit.Test;

public final class NativeDeliveryStopRepositoryTest {
    @Test
    public void ignoresAResponseThatCompletesAfterLogoutClearsTheRoute() {
        FakeStore store = new FakeStore();
        store.refreshToken = "refresh-0";
        NativeSessionManager sessionManager = new NativeSessionManager(
                store,
                new FakeAuthApi()
        );
        CapturingExecutor executor = new CapturingExecutor();
        NativeDeliveryStopRepository repository = new NativeDeliveryStopRepository(
                sessionManager,
                accessToken -> Collections.singletonList(new DeliveryStop(
                        "Dostava 1",
                        "Testna adresa",
                        "1",
                        45.8,
                        16.0,
                        null
                )),
                executor
        );

        repository.refresh(() -> { });
        repository.clear();
        executor.runPending();

        assertEquals(DeliveryRouteStatus.SIGNED_OUT, repository.getStatus());
        assertTrue(repository.getStops().isEmpty());
    }

    private static final class CapturingExecutor implements Executor {
        private Runnable pending;

        @Override
        public void execute(Runnable command) {
            pending = command;
        }

        void runPending() {
            pending.run();
        }
    }

    private static final class FakeStore implements NativeCredentialStore {
        private String refreshToken;

        @Override
        public String getRefreshToken() {
            return refreshToken;
        }

        @Override
        public void setRefreshToken(String value) {
            refreshToken = value;
        }

        @Override
        public PairingRequest getPairingRequest() {
            return null;
        }

        @Override
        public void setPairingRequest(PairingRequest value) { }

        @Override
        public void clearPairingRequest() { }

        @Override
        public void clearSession() {
            refreshToken = null;
        }
    }

    private static final class FakeAuthApi implements NativeAuthApi {
        @Override
        public NativeTokenResponse exchange(String code, String verifier) {
            return tokenResponse();
        }

        @Override
        public NativeTokenResponse refresh(String refreshToken) {
            return tokenResponse();
        }

        @Override
        public void revoke(String refreshToken) { }

        private NativeTokenResponse tokenResponse() {
            return new NativeTokenResponse("access-1", 900, "refresh-1");
        }
    }
}
