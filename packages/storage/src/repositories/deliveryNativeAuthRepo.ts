import 'server-only';

import {
    createHash,
    randomBytes,
    randomUUID,
    timingSafeEqual,
} from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { storage } from '..';
import {
    accounts,
    accountUsers,
    deliveryNativeAuthorizationGrants,
    deliveryNativeRefreshTokens,
    deliveryNativeSessionFamilies,
    users,
} from '../schema';

const authorizationGrantLifetimeMs = 2 * 60 * 1_000;
const nativeSessionLifetimeMs = 30 * 24 * 60 * 60 * 1_000;

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

export type DeliveryNativeAuthErrorCode =
    | 'AUTH_CODE_INVALID'
    | 'AUTH_CODE_EXPIRED'
    | 'AUTH_CODE_REPLAYED'
    | 'PKCE_MISMATCH'
    | 'DELIVERY_ROLE_REQUIRED'
    | 'ACCOUNT_NOT_ELIGIBLE'
    | 'REFRESH_INVALID'
    | 'REFRESH_REVOKED'
    | 'REFRESH_EXPIRED'
    | 'REFRESH_REPLAYED';

export class DeliveryNativeAuthError extends Error {
    override readonly name = 'DeliveryNativeAuthError';

    constructor(readonly code: DeliveryNativeAuthErrorCode) {
        super(code);
    }
}

type OpaqueCredential = {
    id: string;
    secret: string;
    value: string;
};

function createOpaqueCredential(): OpaqueCredential {
    const id = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    return { id, secret, value: `${id}.${secret}` };
}

function parseOpaqueCredential(value: string) {
    const parts = value.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return { id: parts[0], secret: parts[1] };
}

function hashSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
}

function secretMatches(secret: string, expectedHash: string) {
    const actual = Buffer.from(hashSecret(secret), 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
    );
}

export function isValidDeliveryNativePkceVerifier(verifier: string) {
    return /^[A-Za-z0-9._~-]{43,128}$/.test(verifier);
}

export function deliveryNativePkceChallenge(verifier: string) {
    if (!isValidDeliveryNativePkceVerifier(verifier)) {
        throw new DeliveryNativeAuthError('PKCE_MISMATCH');
    }
    return createHash('sha256').update(verifier).digest('base64url');
}

async function readEligibleUser(
    client: DatabaseClient,
    userId: string,
    accountId?: string,
) {
    const [user] = await client
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
    if (!user || (user.role !== 'driver' && user.role !== 'admin')) {
        return {
            eligible: false as const,
            code: 'DELIVERY_ROLE_REQUIRED' as const,
        };
    }

    if (!accountId) return { eligible: true as const, user };

    const [membership] = await client
        .select({ accountId: accountUsers.accountId })
        .from(accountUsers)
        .where(
            and(
                eq(accountUsers.userId, userId),
                eq(accountUsers.accountId, accountId),
            ),
        )
        .limit(1);
    if (!membership) {
        return {
            eligible: false as const,
            code: 'ACCOUNT_NOT_ELIGIBLE' as const,
        };
    }
    return { eligible: true as const, user };
}

export async function getEligibleDeliveryNativeAccounts(userId: string) {
    const eligibleUser = await readEligibleUser(storage(), userId);
    if (!eligibleUser.eligible) return [];

    return storage()
        .selectDistinct({
            id: accounts.id,
            city: accounts.addressCity,
            postalCode: accounts.addressZip,
        })
        .from(accountUsers)
        .innerJoin(accounts, eq(accounts.id, accountUsers.accountId))
        .where(eq(accountUsers.userId, userId));
}

export async function createDeliveryNativeAuthorizationGrant(input: {
    userId: string;
    accountId: string;
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    now?: Date;
}) {
    const code = createOpaqueCredential();
    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + authorizationGrantLifetimeMs);

    await storage().transaction(async (tx) => {
        const eligibleUser = await readEligibleUser(
            tx,
            input.userId,
            input.accountId,
        );
        if (!eligibleUser.eligible) {
            throw new DeliveryNativeAuthError(eligibleUser.code);
        }

        await tx.insert(deliveryNativeAuthorizationGrants).values({
            id: code.id,
            userId: input.userId,
            accountId: input.accountId,
            clientId: input.clientId,
            redirectUri: input.redirectUri,
            codeChallenge: input.codeChallenge,
            codeChallengeMethod: 'S256',
            codeHash: hashSecret(code.secret),
            createdAt: now,
            expiresAt,
        });
    });

    return { code: code.value, expiresAt };
}

function nativeSessionExpiry(now: Date) {
    return new Date(now.getTime() + nativeSessionLifetimeMs);
}

function createNativeRefreshCredential(input: {
    familyId: string;
    generation: number;
    now: Date;
    expiresAt: Date;
}) {
    const credential = createOpaqueCredential();
    return {
        credential,
        values: {
            id: credential.id,
            sessionFamilyId: input.familyId,
            tokenHash: hashSecret(credential.secret),
            generation: input.generation,
            createdAt: input.now,
            expiresAt: input.expiresAt,
        },
    };
}

export async function exchangeDeliveryNativeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
    clientId: string;
    redirectUri: string;
    now?: Date;
}) {
    const parsedCode = parseOpaqueCredential(input.code);
    if (!parsedCode) throw new DeliveryNativeAuthError('AUTH_CODE_INVALID');

    const challenge = deliveryNativePkceChallenge(input.codeVerifier);
    const now = input.now ?? new Date();

    const result = await storage().transaction(async (tx) => {
        const [grant] = await tx
            .select()
            .from(deliveryNativeAuthorizationGrants)
            .where(eq(deliveryNativeAuthorizationGrants.id, parsedCode.id))
            .for('update')
            .limit(1);
        if (
            !grant ||
            !secretMatches(parsedCode.secret, grant.codeHash) ||
            grant.clientId !== input.clientId ||
            grant.redirectUri !== input.redirectUri ||
            grant.codeChallengeMethod !== 'S256'
        ) {
            return { ok: false as const, error: 'AUTH_CODE_INVALID' as const };
        }
        if (grant.usedAt || grant.revokedAt) {
            return { ok: false as const, error: 'AUTH_CODE_REPLAYED' as const };
        }
        if (grant.expiresAt.getTime() <= now.getTime()) {
            return { ok: false as const, error: 'AUTH_CODE_EXPIRED' as const };
        }
        if (grant.codeChallenge !== challenge) {
            return { ok: false as const, error: 'PKCE_MISMATCH' as const };
        }

        const eligibleUser = await readEligibleUser(
            tx,
            grant.userId,
            grant.accountId,
        );
        if (!eligibleUser.eligible) {
            return { ok: false as const, error: eligibleUser.code };
        }

        const familyId = randomUUID();
        const expiresAt = nativeSessionExpiry(now);
        const refresh = createNativeRefreshCredential({
            familyId,
            generation: 0,
            now,
            expiresAt,
        });
        await tx.insert(deliveryNativeSessionFamilies).values({
            id: familyId,
            userId: grant.userId,
            accountId: grant.accountId,
            clientId: grant.clientId,
            createdAt: now,
            lastUsedAt: now,
            expiresAt,
        });
        await tx.insert(deliveryNativeRefreshTokens).values(refresh.values);
        await tx
            .update(deliveryNativeAuthorizationGrants)
            .set({ usedAt: now })
            .where(eq(deliveryNativeAuthorizationGrants.id, grant.id));

        return {
            ok: true as const,
            session: {
                userId: grant.userId,
                accountId: grant.accountId,
                familyId,
                expiresAt,
                refreshToken: refresh.credential.value,
            },
        };
    });

    if (!result.ok) throw new DeliveryNativeAuthError(result.error);
    return result.session;
}

async function revokeFamily(
    tx: TransactionClient,
    familyId: string,
    reason: string,
    now: Date,
) {
    await tx
        .update(deliveryNativeSessionFamilies)
        .set({ revokedAt: now, revocationReason: reason })
        .where(
            and(
                eq(deliveryNativeSessionFamilies.id, familyId),
                isNull(deliveryNativeSessionFamilies.revokedAt),
            ),
        );
}

export async function rotateDeliveryNativeRefreshToken(input: {
    refreshToken: string;
    clientId: string;
    now?: Date;
}) {
    const parsedToken = parseOpaqueCredential(input.refreshToken);
    if (!parsedToken) throw new DeliveryNativeAuthError('REFRESH_INVALID');
    const now = input.now ?? new Date();

    const result = await storage().transaction(async (tx) => {
        const [token] = await tx
            .select()
            .from(deliveryNativeRefreshTokens)
            .where(eq(deliveryNativeRefreshTokens.id, parsedToken.id))
            .for('update')
            .limit(1);
        if (!token || !secretMatches(parsedToken.secret, token.tokenHash)) {
            return { ok: false as const, error: 'REFRESH_INVALID' as const };
        }

        const [family] = await tx
            .select()
            .from(deliveryNativeSessionFamilies)
            .where(eq(deliveryNativeSessionFamilies.id, token.sessionFamilyId))
            .for('update')
            .limit(1);
        if (!family || family.clientId !== input.clientId) {
            return { ok: false as const, error: 'REFRESH_INVALID' as const };
        }
        if (family.revokedAt) {
            return { ok: false as const, error: 'REFRESH_REVOKED' as const };
        }
        if (token.consumedAt) {
            await revokeFamily(tx, family.id, 'refresh-replay', now);
            return { ok: false as const, error: 'REFRESH_REPLAYED' as const };
        }
        if (
            token.expiresAt.getTime() <= now.getTime() ||
            family.expiresAt.getTime() <= now.getTime()
        ) {
            return { ok: false as const, error: 'REFRESH_EXPIRED' as const };
        }

        const eligibleUser = await readEligibleUser(
            tx,
            family.userId,
            family.accountId,
        );
        if (!eligibleUser.eligible) {
            await revokeFamily(tx, family.id, 'account-ineligible', now);
            return { ok: false as const, error: eligibleUser.code };
        }

        const replacement = createNativeRefreshCredential({
            familyId: family.id,
            generation: token.generation + 1,
            now,
            expiresAt: family.expiresAt,
        });
        await tx.insert(deliveryNativeRefreshTokens).values(replacement.values);
        await tx
            .update(deliveryNativeRefreshTokens)
            .set({
                consumedAt: now,
                replacedByTokenId: replacement.credential.id,
            })
            .where(eq(deliveryNativeRefreshTokens.id, token.id));
        await tx
            .update(deliveryNativeSessionFamilies)
            .set({ lastUsedAt: now })
            .where(eq(deliveryNativeSessionFamilies.id, family.id));

        return {
            ok: true as const,
            session: {
                userId: family.userId,
                accountId: family.accountId,
                familyId: family.id,
                expiresAt: family.expiresAt,
                refreshToken: replacement.credential.value,
            },
        };
    });

    if (!result.ok) throw new DeliveryNativeAuthError(result.error);
    return result.session;
}

export async function revokeDeliveryNativeRefreshToken(input: {
    refreshToken: string;
    clientId: string;
    now?: Date;
}) {
    const parsedToken = parseOpaqueCredential(input.refreshToken);
    if (!parsedToken) return false;
    const now = input.now ?? new Date();

    return storage().transaction(async (tx) => {
        const [token] = await tx
            .select()
            .from(deliveryNativeRefreshTokens)
            .where(eq(deliveryNativeRefreshTokens.id, parsedToken.id))
            .for('update')
            .limit(1);
        if (!token || !secretMatches(parsedToken.secret, token.tokenHash)) {
            return false;
        }
        const [family] = await tx
            .select()
            .from(deliveryNativeSessionFamilies)
            .where(eq(deliveryNativeSessionFamilies.id, token.sessionFamilyId))
            .for('update')
            .limit(1);
        if (!family || family.clientId !== input.clientId) return false;
        if (!family.revokedAt) {
            await revokeFamily(tx, family.id, 'user-revoked', now);
        }
        return true;
    });
}

export async function cleanupDeliveryNativeAuth(now = new Date()) {
    await storage()
        .delete(deliveryNativeAuthorizationGrants)
        .where(lt(deliveryNativeAuthorizationGrants.expiresAt, now));
    await storage()
        .delete(deliveryNativeRefreshTokens)
        .where(lt(deliveryNativeRefreshTokens.expiresAt, now));
    await storage()
        .delete(deliveryNativeSessionFamilies)
        .where(lt(deliveryNativeSessionFamilies.expiresAt, now));
}
