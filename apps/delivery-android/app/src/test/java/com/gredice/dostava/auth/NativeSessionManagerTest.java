package com.gredice.dostava.auth;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.Test;

public final class NativeSessionManagerTest {
    @Test
    public void serializesConcurrentProcessRecoveryRefreshes() throws Exception {
        FakeStore store = new FakeStore();
        store.refreshToken = "refresh-0";
        FakeApi api = new FakeApi();
        NativeSessionManager manager = new NativeSessionManager(store, api, () -> 10_000L);
        ExecutorService executor = Executors.newFixedThreadPool(8);
        List<Callable<String>> calls = new ArrayList<>();
        for (int index = 0; index < 16; index++) {
            calls.add(() -> manager.executeAuthorized(token -> token));
        }

        List<Future<String>> results = executor.invokeAll(calls);
        executor.shutdownNow();
        for (Future<String> result : results) {
            assertEquals("access-1", result.get());
        }
        assertEquals(1, api.refreshCount.get());
        assertEquals("refresh-1", store.refreshToken);
    }

    @Test
    public void retriesOneUnauthorizedRequestAfterSuccessfulRotation() throws Exception {
        FakeStore store = new FakeStore();
        store.refreshToken = "refresh-0";
        FakeApi api = new FakeApi();
        NativeSessionManager manager = new NativeSessionManager(store, api, () -> 10_000L);
        AtomicInteger requests = new AtomicInteger();

        String result = manager.executeAuthorized(token -> {
            requests.incrementAndGet();
            if ("access-1".equals(token)) throw new ApiFailure(401, "SESSION_REQUIRED");
            return token;
        });

        assertEquals("access-2", result);
        assertEquals(2, requests.get());
        assertEquals(2, api.refreshCount.get());
        assertTrue(manager.hasSession());
    }

    @Test
    public void clearsSessionAfterTheSingleRetryAlsoReturnsUnauthorized() {
        FakeStore store = new FakeStore();
        store.refreshToken = "refresh-0";
        FakeApi api = new FakeApi();
        NativeSessionManager manager = new NativeSessionManager(store, api, () -> 10_000L);
        AtomicInteger requests = new AtomicInteger();

        assertThrows(ApiFailure.class, () -> manager.executeAuthorized(token -> {
            requests.incrementAndGet();
            throw new ApiFailure(401, "SESSION_REQUIRED");
        }));

        assertEquals(2, requests.get());
        assertEquals(2, api.refreshCount.get());
        assertFalse(manager.hasSession());
    }

    @Test
    public void logoutRevokesThenClearsCredentialAndPairingState() {
        FakeStore store = new FakeStore();
        store.refreshToken = "refresh-0";
        store.pairingRequest = NativeAuthProtocol.createPairingRequest(10_000L);
        FakeApi api = new FakeApi();
        NativeSessionManager manager = new NativeSessionManager(store, api, () -> 10_000L);

        manager.logout();

        assertEquals("refresh-0", api.revokedToken);
        assertFalse(manager.hasSession());
        assertEquals(null, store.pairingRequest);
    }

    @Test
    public void logoutWaitsForRefreshAndRevokesTheRotatedCredential() throws Exception {
        FakeStore store = new FakeStore();
        store.refreshToken = "refresh-0";
        FakeApi api = new FakeApi();
        api.pauseRefresh = true;
        NativeSessionManager manager = new NativeSessionManager(store, api, () -> 10_000L);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        Future<String> request = executor.submit(
                () -> manager.executeAuthorized(token -> token)
        );
        assertTrue(api.refreshStarted.await(1, TimeUnit.SECONDS));
        CountDownLatch logoutStarted = new CountDownLatch(1);
        Future<?> logout = executor.submit(() -> {
            logoutStarted.countDown();
            manager.logout();
        });
        assertTrue(logoutStarted.await(1, TimeUnit.SECONDS));

        api.releaseRefresh.countDown();
        assertEquals("access-1", request.get());
        logout.get();
        executor.shutdownNow();

        assertEquals("refresh-1", api.revokedToken);
        assertFalse(manager.hasSession());
    }

    @Test
    public void recreatedCallbackDoesNotExchangeAnAlreadyPairedCodeAgain() throws Exception {
        FakeStore store = new FakeStore();
        FakeApi api = new FakeApi();
        NativeSessionManager manager = new NativeSessionManager(store, api, () -> 10_000L);

        manager.completePairing("code", "verifier");
        manager.completePairing("code", "verifier");

        assertEquals(1, api.exchangeCount.get());
        assertTrue(manager.hasSession());
    }

    @Test
    public void keepsOneLocalSessionBindingAcrossCredentialRotationAndClearsItOnLogout()
            throws Exception {
        FakeStore store = new FakeStore();
        FakeApi api = new FakeApi();
        NativeSessionManager manager = new NativeSessionManager(store, api, () -> 10_000L);

        manager.completePairing("code", "verifier");
        String binding = manager.getSessionBinding();
        AtomicInteger requests = new AtomicInteger();
        manager.executeAuthorized(token -> {
            if (requests.incrementAndGet() == 1) {
                throw new ApiFailure(401, "SESSION_REQUIRED");
            }
            return token;
        });

        assertEquals(binding, manager.getSessionBinding());
        manager.logout();
        assertEquals(null, manager.getSessionBinding());
    }

    private static final class FakeStore implements NativeCredentialStore {
        private String refreshToken;
        private String sessionBinding;
        private PairingRequest pairingRequest;

        @Override
        public synchronized String getRefreshToken() {
            return refreshToken;
        }

        @Override
        public synchronized void setRefreshToken(String value) {
            refreshToken = value;
            if (sessionBinding == null) sessionBinding = "session-1";
        }

        @Override
        public synchronized String getSessionBinding() {
            return sessionBinding;
        }

        @Override
        public synchronized PairingRequest getPairingRequest() {
            return pairingRequest;
        }

        @Override
        public synchronized void setPairingRequest(PairingRequest value) {
            pairingRequest = value;
        }

        @Override
        public synchronized void clearPairingRequest() {
            pairingRequest = null;
        }

        @Override
        public synchronized void clearSession() {
            refreshToken = null;
            sessionBinding = null;
            pairingRequest = null;
        }
    }

    private static final class FakeApi implements NativeAuthApi {
        private final AtomicInteger refreshCount = new AtomicInteger();
        private final AtomicInteger exchangeCount = new AtomicInteger();
        private final CountDownLatch refreshStarted = new CountDownLatch(1);
        private final CountDownLatch releaseRefresh = new CountDownLatch(1);
        private boolean pauseRefresh;
        private String revokedToken;

        @Override
        public NativeTokenResponse exchange(String code, String verifier) {
            exchangeCount.incrementAndGet();
            return response(1);
        }

        @Override
        public NativeTokenResponse refresh(String refreshToken) throws ApiFailure {
            refreshStarted.countDown();
            if (pauseRefresh) {
                try {
                    if (!releaseRefresh.await(1, TimeUnit.SECONDS)) {
                        throw new ApiFailure(503, "TEST_TIMEOUT");
                    }
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new ApiFailure(503, "TEST_INTERRUPTED");
                }
            }
            int generation = refreshCount.incrementAndGet();
            return response(generation);
        }

        @Override
        public void revoke(String refreshToken) {
            revokedToken = refreshToken;
        }

        private NativeTokenResponse response(int generation) {
            return new NativeTokenResponse(
                    "access-" + generation,
                    900,
                    "refresh-" + generation
            );
        }
    }
}
