import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accounts,
    accountUsers,
    createDeliveryNativeAuthorizationGrant,
    DeliveryNativeAuthError,
    deliveryNativeAuthorizationGrants,
    deliveryNativePkceChallenge,
    deliveryNativeSessionFamilies,
    exchangeDeliveryNativeAuthorizationCode,
    revokeDeliveryNativeRefreshToken,
    rotateDeliveryNativeRefreshToken,
    storage,
    users,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testDb';

const clientId = 'gredice-delivery-android';
const redirectUri = 'https://dostava.gredice.com/android/auth/callback';
const verifier = 'native-verifier-abcdefghijklmnopqrstuvwxyz-0123456789-._~';

async function fixture(role = 'driver') {
    createTestDb();
    const userId = randomUUID();
    const accountId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `${userId}@example.com`,
            role,
        });
    await storage().insert(accounts).values({ id: accountId });
    await storage().insert(accountUsers).values({ userId, accountId });
    return { userId, accountId };
}

async function grant(input: { userId: string; accountId: string; now?: Date }) {
    return createDeliveryNativeAuthorizationGrant({
        ...input,
        clientId,
        redirectUri,
        codeChallenge: deliveryNativePkceChallenge(verifier),
    });
}

async function expectCode(
    promise: Promise<unknown>,
    code: DeliveryNativeAuthError['code'],
) {
    await assert.rejects(promise, (error) => {
        assert.ok(error instanceof DeliveryNativeAuthError);
        assert.equal(error.code, code);
        return true;
    });
}

test('native authorization grants store only hashed code material and are single-use', async () => {
    const subject = await fixture();
    const authorization = await grant(subject);
    const [codeId, secret] = authorization.code.split('.');
    assert.ok(codeId);
    assert.ok(secret);

    const stored =
        await storage().query.deliveryNativeAuthorizationGrants.findFirst({
            where: eq(deliveryNativeAuthorizationGrants.id, codeId),
        });
    assert.ok(stored);
    assert.notEqual(stored.codeHash, secret);
    assert.doesNotMatch(JSON.stringify(stored), new RegExp(secret));
    assert.equal(stored.codeChallengeMethod, 'S256');
    assert.equal(stored.accountId, subject.accountId);

    const session = await exchangeDeliveryNativeAuthorizationCode({
        code: authorization.code,
        codeVerifier: verifier,
        clientId,
        redirectUri,
    });
    assert.equal(session.userId, subject.userId);
    assert.equal(session.accountId, subject.accountId);
    assert.match(session.refreshToken, /^[^.]+\.[A-Za-z0-9_-]+$/);

    await expectCode(
        exchangeDeliveryNativeAuthorizationCode({
            code: authorization.code,
            codeVerifier: verifier,
            clientId,
            redirectUri,
        }),
        'AUTH_CODE_REPLAYED',
    );
});

test('native authorization rejects wrong PKCE, expiry, role, and account membership', async () => {
    const subject = await fixture();
    const validGrant = await grant(subject);
    await expectCode(
        exchangeDeliveryNativeAuthorizationCode({
            code: validGrant.code,
            codeVerifier:
                'wrong-verifier-abcdefghijklmnopqrstuvwxyz-0123456789-._~',
            clientId,
            redirectUri,
        }),
        'PKCE_MISMATCH',
    );

    const expiredGrant = await grant({
        ...subject,
        now: new Date('2026-08-28T10:00:00.000Z'),
    });
    await expectCode(
        exchangeDeliveryNativeAuthorizationCode({
            code: expiredGrant.code,
            codeVerifier: verifier,
            clientId,
            redirectUri,
            now: new Date('2026-08-28T10:02:00.000Z'),
        }),
        'AUTH_CODE_EXPIRED',
    );

    const roleGrant = await grant(subject);
    await storage()
        .update(users)
        .set({ role: 'user' })
        .where(eq(users.id, subject.userId));
    await expectCode(
        exchangeDeliveryNativeAuthorizationCode({
            code: roleGrant.code,
            codeVerifier: verifier,
            clientId,
            redirectUri,
        }),
        'DELIVERY_ROLE_REQUIRED',
    );

    await storage()
        .update(users)
        .set({ role: 'driver' })
        .where(eq(users.id, subject.userId));
    const membershipGrant = await grant(subject);
    await storage()
        .delete(accountUsers)
        .where(eq(accountUsers.userId, subject.userId));
    await expectCode(
        exchangeDeliveryNativeAuthorizationCode({
            code: membershipGrant.code,
            codeVerifier: verifier,
            clientId,
            redirectUri,
        }),
        'ACCOUNT_NOT_ELIGIBLE',
    );
});

test('native refresh rotation is atomic and replay revokes the session family', async () => {
    const subject = await fixture('admin');
    const authorization = await grant(subject);
    const session = await exchangeDeliveryNativeAuthorizationCode({
        code: authorization.code,
        codeVerifier: verifier,
        clientId,
        redirectUri,
    });

    const attempts = await Promise.allSettled([
        rotateDeliveryNativeRefreshToken({
            refreshToken: session.refreshToken,
            clientId,
        }),
        rotateDeliveryNativeRefreshToken({
            refreshToken: session.refreshToken,
            clientId,
        }),
    ]);
    assert.equal(
        attempts.filter((attempt) => attempt.status === 'fulfilled').length,
        1,
    );
    const replay = attempts.find((attempt) => attempt.status === 'rejected');
    assert.ok(replay && replay.status === 'rejected');
    assert.ok(replay.reason instanceof DeliveryNativeAuthError);
    assert.equal(replay.reason.code, 'REFRESH_REPLAYED');

    const family =
        await storage().query.deliveryNativeSessionFamilies.findFirst({
            where: eq(deliveryNativeSessionFamilies.id, session.familyId),
        });
    assert.ok(family?.revokedAt);
    assert.equal(family.revocationReason, 'refresh-replay');

    const rotated = attempts.find((attempt) => attempt.status === 'fulfilled');
    assert.ok(rotated && rotated.status === 'fulfilled');
    await expectCode(
        rotateDeliveryNativeRefreshToken({
            refreshToken: rotated.value.refreshToken,
            clientId,
        }),
        'REFRESH_REVOKED',
    );
});

test('native logout revokes the family and prevents later refresh', async () => {
    const subject = await fixture();
    const authorization = await grant(subject);
    const session = await exchangeDeliveryNativeAuthorizationCode({
        code: authorization.code,
        codeVerifier: verifier,
        clientId,
        redirectUri,
    });

    assert.equal(
        await revokeDeliveryNativeRefreshToken({
            refreshToken: session.refreshToken,
            clientId,
        }),
        true,
    );
    assert.equal(
        await revokeDeliveryNativeRefreshToken({
            refreshToken: session.refreshToken,
            clientId,
        }),
        true,
    );
    await expectCode(
        rotateDeliveryNativeRefreshToken({
            refreshToken: session.refreshToken,
            clientId,
        }),
        'REFRESH_REVOKED',
    );
});
