import { expect, test } from '@playwright/test';
import {
    establishFarmLoginSession,
    FARM_LOGIN_ERROR_CODES,
    getFarmLoginErrorCode,
    getFarmLoginErrorStatus,
    getIssuedRefreshToken,
    hasAuthorizedFarmLoginAccess,
    mapTrustedLoginError,
    parseFarmLoginCredentials,
    parseFarmLoginTokens,
} from './farmLoginContract';

test('keeps the public login error taxonomy bounded', () => {
    expect(FARM_LOGIN_ERROR_CODES).toEqual([
        'invalid_request',
        'invalid_credentials',
        'temporarily_locked',
        'email_verification_required',
        'no_farm_access',
        'service_unavailable',
    ]);

    for (const error of FARM_LOGIN_ERROR_CODES) {
        expect(getFarmLoginErrorCode(error)).toBe(error);
    }
    for (const privateError of [
        undefined,
        null,
        '',
        'user_not_found',
        'database_connection_failed',
        { error: 'login_failed' },
    ]) {
        expect(getFarmLoginErrorCode(privateError)).toBe('service_unavailable');
    }
    expect(getFarmLoginErrorCode({ error: 'invalid_credentials' })).toBe(
        'invalid_credentials',
    );
});

test('normalizes the email without changing the password', () => {
    expect(
        parseFarmLoginCredentials({
            email: '  farmer@example.com  ',
            password: '  keep these spaces  ',
        }),
    ).toEqual({
        email: 'farmer@example.com',
        password: '  keep these spaces  ',
    });
});

test('rejects malformed request bodies, emails, and passwords', () => {
    for (const value of [
        null,
        [],
        {},
        { email: 'farmer@example.com' },
        { email: 42, password: 'secret' },
        { email: 'farmer@example.com', password: 42 },
        { email: '', password: 'secret' },
        { email: 'farmer', password: 'secret' },
        { email: 'farmer @example.com', password: 'secret' },
        { email: 'farmer@example.com\u0000', password: 'secret' },
        { email: `${'a'.repeat(250)}@example.com`, password: 'secret' },
        { email: 'farmer@example.com', password: '' },
        { email: 'farmer@example.com', password: 'x'.repeat(4097) },
    ]) {
        expect(parseFarmLoginCredentials(value)).toBeNull();
    }
});

test('requires both nonempty, unmodified session tokens', () => {
    const tokens = {
        token: 'access.token.signature',
        refreshToken: 'refresh-token.secret',
    };
    expect(parseFarmLoginTokens(tokens)).toEqual(tokens);

    for (const value of [
        null,
        {},
        { token: tokens.token },
        { refreshToken: tokens.refreshToken },
        { token: '', refreshToken: tokens.refreshToken },
        { token: tokens.token, refreshToken: '' },
        { token: ` ${tokens.token}`, refreshToken: tokens.refreshToken },
        { token: tokens.token, refreshToken: `${tokens.refreshToken}\n` },
        { token: 'x'.repeat(16_385), refreshToken: tokens.refreshToken },
    ]) {
        expect(parseFarmLoginTokens(value)).toBeNull();
    }
});

test('finds an issued refresh token even when the access token is invalid', () => {
    expect(
        getIssuedRefreshToken({ refreshToken: 'refresh-token.secret' }),
    ).toBe('refresh-token.secret');
    expect(getIssuedRefreshToken({ refreshToken: ' invalid' })).toBeNull();
    expect(getIssuedRefreshToken({ refreshToken: '' })).toBeNull();
    expect(getIssuedRefreshToken(null)).toBeNull();
});

test('maps only trusted upstream failures into public errors', () => {
    const mappings = [
        ['user_not_found', 'invalid_credentials'],
        ['login_failed', 'invalid_credentials'],
        ['invalid_credentials', 'invalid_credentials'],
        ['user_blocked', 'temporarily_locked'],
        ['temporarily_locked', 'temporarily_locked'],
        ['verify_email', 'email_verification_required'],
        ['email_verification_required', 'email_verification_required'],
        ['invalid_request', 'invalid_request'],
    ] as const;

    for (const [upstreamCode, publicCode] of mappings) {
        expect(mapTrustedLoginError({ errorCode: upstreamCode }, 500)).toBe(
            publicCode,
        );
    }

    expect(mapTrustedLoginError(null, 400)).toBe('invalid_request');
    expect(mapTrustedLoginError(null, 422)).toBe('invalid_request');
    expect(mapTrustedLoginError(null, 401)).toBe('invalid_credentials');
    expect(mapTrustedLoginError(null, 404)).toBe('invalid_credentials');
    expect(mapTrustedLoginError(null, 429)).toBe('temporarily_locked');
    expect(mapTrustedLoginError({ errorCode: 'database_error' }, 500)).toBe(
        'service_unavailable',
    );
    expect(mapTrustedLoginError({ error: 'private detail' }, 403)).toBe(
        'service_unavailable',
    );
});

test('assigns stable HTTP statuses to every public error', () => {
    expect(getFarmLoginErrorStatus('invalid_request')).toBe(400);
    expect(getFarmLoginErrorStatus('invalid_credentials')).toBe(401);
    expect(getFarmLoginErrorStatus('temporarily_locked')).toBe(429);
    expect(getFarmLoginErrorStatus('email_verification_required')).toBe(403);
    expect(getFarmLoginErrorStatus('no_farm_access')).toBe(403);
    expect(getFarmLoginErrorStatus('service_unavailable')).toBe(503);
});

test('allows only farmers and admins with an assigned account', () => {
    expect(
        hasAuthorizedFarmLoginAccess({ role: 'farmer', accounts: [{}] }),
    ).toBe(true);
    expect(
        hasAuthorizedFarmLoginAccess({ role: 'admin', accounts: [{}] }),
    ).toBe(true);

    for (const value of [
        null,
        {},
        { role: 'farmer' },
        { role: 'farmer', accounts: [] },
        { role: 'admin', accounts: [] },
        { role: 'user', accounts: [{}] },
        { role: 'owner', accounts: [{}] },
        { role: 'farmer', accounts: null },
    ]) {
        expect(hasAuthorizedFarmLoginAccess(value)).toBe(false);
    }
});

test('persists a verified authoritative Farm session without revoking it', async () => {
    const events: string[] = [];
    const result = await establishFarmLoginSession(
        {
            token: 'access.token.signature',
            refreshToken: 'refresh-token.secret',
        },
        {
            clearSession: async () => {
                events.push('clear');
            },
            loadRefreshTokenSubject: async (refreshToken) => {
                events.push(`refresh:${refreshToken}`);
                return 'farmer-id';
            },
            loadUser: async (subject) => {
                events.push(`load:${subject}`);
                return { role: 'farmer', accounts: [{}] };
            },
            persistSession: async ({ token, refreshToken }) => {
                events.push(`persist:${token}:${refreshToken}`);
            },
            revokeRefreshToken: async (refreshToken) => {
                events.push(`revoke:${refreshToken}`);
            },
            verifyAccessTokenSubject: async (token) => {
                events.push(`verify:${token}`);
                return 'farmer-id';
            },
        },
    );

    expect(result).toEqual({ ok: true });
    expect(events).toEqual([
        'verify:access.token.signature',
        'refresh:refresh-token.secret',
        'load:farmer-id',
        'persist:access.token.signature:refresh-token.secret',
    ]);
});

test('revokes issued refresh tokens for every pre-cookie session rejection', async () => {
    const tokens = {
        token: 'access.token.signature',
        refreshToken: 'refresh-token.secret',
    };
    const cases = [
        {
            expected: 'service_unavailable',
            loadRefreshTokenSubject: async () => 'farmer-id',
            loadUser: async () => ({ role: 'farmer', accounts: [{}] }),
            verifyAccessTokenSubject: async () => null,
        },
        {
            expected: 'service_unavailable',
            loadRefreshTokenSubject: async () => 'farmer-id',
            loadUser: async () => ({ role: 'farmer', accounts: [{}] }),
            verifyAccessTokenSubject: async (): Promise<string> => {
                throw new Error('verification failed');
            },
        },
        {
            expected: 'service_unavailable',
            loadRefreshTokenSubject: async () => 'different-user-id',
            loadUser: async () => ({ role: 'farmer', accounts: [{}] }),
            verifyAccessTokenSubject: async () => 'farmer-id',
        },
        {
            expected: 'service_unavailable',
            loadRefreshTokenSubject: async () => null,
            loadUser: async () => ({ role: 'farmer', accounts: [{}] }),
            verifyAccessTokenSubject: async () => 'farmer-id',
        },
        {
            expected: 'service_unavailable',
            loadRefreshTokenSubject: async (): Promise<string> => {
                throw new Error('refresh token lookup failed');
            },
            loadUser: async () => ({ role: 'farmer', accounts: [{}] }),
            verifyAccessTokenSubject: async () => 'farmer-id',
        },
        {
            expected: 'service_unavailable',
            loadRefreshTokenSubject: async () => 'farmer-id',
            loadUser: async (): Promise<unknown> => {
                throw new Error('storage failed');
            },
            verifyAccessTokenSubject: async () => 'farmer-id',
        },
        {
            expected: 'no_farm_access',
            loadRefreshTokenSubject: async () => 'farmer-id',
            loadUser: async () => null,
            verifyAccessTokenSubject: async () => 'farmer-id',
        },
        {
            expected: 'no_farm_access',
            loadRefreshTokenSubject: async () => 'farmer-id',
            loadUser: async () => ({ role: 'user', accounts: [{}] }),
            verifyAccessTokenSubject: async () => 'farmer-id',
        },
        {
            expected: 'no_farm_access',
            loadRefreshTokenSubject: async () => 'farmer-id',
            loadUser: async () => ({ role: 'farmer', accounts: [] }),
            verifyAccessTokenSubject: async () => 'farmer-id',
        },
    ] as const;

    for (const testCase of cases) {
        const events: string[] = [];
        const result = await establishFarmLoginSession(tokens, {
            clearSession: async () => {
                events.push('clear');
            },
            loadRefreshTokenSubject: testCase.loadRefreshTokenSubject,
            loadUser: testCase.loadUser,
            persistSession: async () => {
                events.push('persist');
            },
            revokeRefreshToken: async (refreshToken) => {
                events.push(`revoke:${refreshToken}`);
            },
            verifyAccessTokenSubject: testCase.verifyAccessTokenSubject,
        });

        expect(result).toEqual({ error: testCase.expected });
        expect(events).not.toContain('persist');
        expect(events).not.toContain('clear');
        expect(events.at(-1)).toBe('revoke:refresh-token.secret');
    }
});

test('clears partial cookies and revokes the refresh token when persistence fails', async () => {
    const events: string[] = [];
    const result = await establishFarmLoginSession(
        {
            token: 'access.token.signature',
            refreshToken: 'refresh-token.secret',
        },
        {
            clearSession: async () => {
                events.push('clear');
            },
            loadRefreshTokenSubject: async () => 'admin-id',
            loadUser: async () => ({ role: 'admin', accounts: [{}] }),
            persistSession: async () => {
                events.push('persist');
                throw new Error('cookie failed');
            },
            revokeRefreshToken: async (refreshToken) => {
                events.push(`revoke:${refreshToken}`);
            },
            verifyAccessTokenSubject: async () => 'admin-id',
        },
    );

    expect(result).toEqual({ error: 'service_unavailable' });
    expect(events).toEqual(['persist', 'clear', 'revoke:refresh-token.secret']);
});
