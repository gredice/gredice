import assert from 'node:assert/strict';
import test, { beforeEach, describe } from 'node:test';
import {
    clearStoredTokens,
    getJwtExpiryMs,
    getStoredAccessToken,
    getStoredRefreshToken,
    isAccessTokenExpiringSoon,
    setStoredTokens,
} from '../src/auth/tokenStore';

// Mock localStorage for Node.js environment
const mockStorage = new Map<string, string>();

const mockLocalStorage = {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
    length: 0,
    key: () => null,
};

// Setup global localStorage mock
(
    globalThis as unknown as { localStorage: typeof mockLocalStorage }
).localStorage = mockLocalStorage;

describe('tokenStore', () => {
    beforeEach(() => {
        mockStorage.clear();
    });

    describe('setStoredTokens and getStoredAccessToken', () => {
        test('should store and retrieve access token', () => {
            setStoredTokens({ accessToken: 'test-access-token' });
            const token = getStoredAccessToken();
            assert.equal(token, 'test-access-token');
        });

        test('should store and retrieve refresh token', () => {
            setStoredTokens({ refreshToken: 'test-refresh-token' });
            const token = getStoredRefreshToken();
            assert.equal(token, 'test-refresh-token');
        });

        test('should store both tokens at once', () => {
            setStoredTokens({
                accessToken: 'access-123',
                refreshToken: 'refresh-456',
            });
            assert.equal(getStoredAccessToken(), 'access-123');
            assert.equal(getStoredRefreshToken(), 'refresh-456');
        });

        test('should not overwrite existing token if new value is null', () => {
            setStoredTokens({ accessToken: 'existing-token' });
            setStoredTokens({ accessToken: null });
            assert.equal(getStoredAccessToken(), 'existing-token');
        });
    });

    describe('clearStoredTokens', () => {
        test('should clear both tokens', () => {
            setStoredTokens({
                accessToken: 'access-123',
                refreshToken: 'refresh-456',
            });
            clearStoredTokens();
            assert.equal(getStoredAccessToken(), null);
            assert.equal(getStoredRefreshToken(), null);
        });
    });

    describe('getJwtExpiryMs', () => {
        test('should extract expiry from valid JWT', () => {
            // Create a JWT with exp = 1700000000 (seconds)
            const payload = { sub: 'user-123', exp: 1700000000 };
            const encodedPayload = Buffer.from(
                JSON.stringify(payload),
            ).toString('base64url');
            const fakeJwt = `header.${encodedPayload}.signature`;

            const expiryMs = getJwtExpiryMs(fakeJwt);
            assert.equal(expiryMs, 1700000000 * 1000);
        });

        test('should return null for JWT without exp claim', () => {
            const payload = { sub: 'user-123' };
            const encodedPayload = Buffer.from(
                JSON.stringify(payload),
            ).toString('base64url');
            const fakeJwt = `header.${encodedPayload}.signature`;

            const expiryMs = getJwtExpiryMs(fakeJwt);
            assert.equal(expiryMs, null);
        });

        test('should return null for malformed JWT', () => {
            assert.equal(getJwtExpiryMs('not-a-jwt'), null);
            assert.equal(getJwtExpiryMs(''), null);
            assert.equal(getJwtExpiryMs('only.two'), null);
        });

        test('should return null for invalid base64 payload', () => {
            // Use a valid base64 that decodes to garbage that can't be parsed as JSON
            const fakeJwt = 'header.YWJj.signature'; // 'abc' in base64
            const expiryMs = getJwtExpiryMs(fakeJwt);
            assert.equal(expiryMs, null);
        });

        test('should return null for non-JSON payload', () => {
            const encodedPayload =
                Buffer.from('not-json').toString('base64url');
            const fakeJwt = `header.${encodedPayload}.signature`;
            const expiryMs = getJwtExpiryMs(fakeJwt);
            assert.equal(expiryMs, null);
        });
    });

    describe('isAccessTokenExpiringSoon', () => {
        test('should return true when token expires within buffer time', () => {
            // Token expires in 30 seconds, buffer is 60 seconds
            const expSeconds = Math.floor(Date.now() / 1000) + 30;
            const payload = { sub: 'user-123', exp: expSeconds };
            const encodedPayload = Buffer.from(
                JSON.stringify(payload),
            ).toString('base64url');
            const fakeJwt = `header.${encodedPayload}.signature`;

            assert.equal(isAccessTokenExpiringSoon(fakeJwt, 60 * 1000), true);
        });

        test('should return false when token has plenty of time left', () => {
            // Token expires in 10 minutes, buffer is 60 seconds
            const expSeconds = Math.floor(Date.now() / 1000) + 600;
            const payload = { sub: 'user-123', exp: expSeconds };
            const encodedPayload = Buffer.from(
                JSON.stringify(payload),
            ).toString('base64url');
            const fakeJwt = `header.${encodedPayload}.signature`;

            assert.equal(isAccessTokenExpiringSoon(fakeJwt, 60 * 1000), false);
        });

        test('should return true when token is already expired', () => {
            // Token expired 10 seconds ago
            const expSeconds = Math.floor(Date.now() / 1000) - 10;
            const payload = { sub: 'user-123', exp: expSeconds };
            const encodedPayload = Buffer.from(
                JSON.stringify(payload),
            ).toString('base64url');
            const fakeJwt = `header.${encodedPayload}.signature`;

            assert.equal(isAccessTokenExpiringSoon(fakeJwt, 60 * 1000), true);
        });

        test('should return false for token without expiry', () => {
            const payload = { sub: 'user-123' };
            const encodedPayload = Buffer.from(
                JSON.stringify(payload),
            ).toString('base64url');
            const fakeJwt = `header.${encodedPayload}.signature`;

            assert.equal(isAccessTokenExpiringSoon(fakeJwt), false);
        });

        test('should use default buffer of 60 seconds', () => {
            // Token expires in 30 seconds (within default 60s buffer)
            const expSeconds = Math.floor(Date.now() / 1000) + 30;
            const payload = { sub: 'user-123', exp: expSeconds };
            const encodedPayload = Buffer.from(
                JSON.stringify(payload),
            ).toString('base64url');
            const fakeJwt = `header.${encodedPayload}.signature`;

            assert.equal(isAccessTokenExpiringSoon(fakeJwt), true);
        });
    });
});
