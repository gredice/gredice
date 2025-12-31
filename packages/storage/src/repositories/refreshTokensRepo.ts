import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { storage } from '..';
import { refreshTokens } from '../schema';

const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;

function hashRefreshSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
}

function generateRefreshToken() {
    const tokenId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    const token = `${tokenId}.${secret}`;
    return {
        tokenId,
        secret,
        token,
    };
}

function parseRefreshToken(token: string) {
    const [tokenId, secret] = token.split('.');
    if (!tokenId || !secret) {
        return null;
    }
    return { tokenId, secret };
}

function nextRefreshExpiry(now: Date) {
    return new Date(now.getTime() + refreshTokenLifetimeMs);
}

export async function createRefreshToken(userId: string) {
    const { tokenId, secret, token } = generateRefreshToken();
    const now = new Date();
    await storage().insert(refreshTokens).values({
        id: tokenId,
        userId,
        tokenHash: hashRefreshSecret(secret),
        createdAt: now,
        lastUsedAt: now,
        expiresAt: nextRefreshExpiry(now),
    });
    return token;
}

export async function useRefreshToken(token: string) {
    const parsed = parseRefreshToken(token);
    if (!parsed) {
        return null;
    }

    const record = await storage().query.refreshTokens.findFirst({
        where: eq(refreshTokens.id, parsed.tokenId),
    });
    if (!record) {
        return null;
    }

    if (record.expiresAt.getTime() <= Date.now()) {
        await storage()
            .delete(refreshTokens)
            .where(eq(refreshTokens.id, record.id));
        return null;
    }

    if (record.tokenHash !== hashRefreshSecret(parsed.secret)) {
        return null;
    }

    const now = new Date();
    await storage()
        .update(refreshTokens)
        .set({
            lastUsedAt: now,
            expiresAt: nextRefreshExpiry(now),
        })
        .where(eq(refreshTokens.id, record.id));

    return {
        userId: record.userId,
    };
}

export async function revokeRefreshToken(token: string) {
    const parsed = parseRefreshToken(token);
    if (!parsed) {
        return;
    }
    await storage()
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, parsed.tokenId));
}

export function revokeRefreshTokensForUser(userId: string) {
    return storage()
        .delete(refreshTokens)
        .where(eq(refreshTokens.userId, userId));
}
