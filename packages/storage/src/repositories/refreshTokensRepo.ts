import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
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
    await storage()
        .insert(refreshTokens)
        .values({
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
        console.warn('Invalid refresh token format received');
        return null;
    }

    const record = await storage().query.refreshTokens.findFirst({
        where: eq(refreshTokens.id, parsed.tokenId),
    });
    if (!record) {
        return null;
    }

    // Use a 1-second buffer to prevent edge cases where token expires during processing
    const expiryBuffer = 1000;
    if (record.expiresAt.getTime() <= Date.now() + expiryBuffer) {
        await storage()
            .delete(refreshTokens)
            .where(eq(refreshTokens.id, record.id));
        return null;
    }

    if (record.tokenHash !== hashRefreshSecret(parsed.secret)) {
        console.warn(
            'Invalid refresh token hash attempt for token ID:',
            parsed.tokenId,
        );
        return null;
    }

    // Update last used timestamp but do NOT extend expiry
    // Token rotation (creating a new token) should be used instead
    const now = new Date();
    await storage()
        .update(refreshTokens)
        .set({
            lastUsedAt: now,
        })
        .where(eq(refreshTokens.id, record.id));

    return {
        userId: record.userId,
    };
}

export async function revokeRefreshToken(token: string) {
    const parsed = parseRefreshToken(token);
    if (!parsed) {
        console.warn('Invalid refresh token format in revoke attempt');
        return;
    }
    await storage()
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, parsed.tokenId));
}

/**
 * Cleanup expired refresh tokens from the database.
 * This should be called periodically (e.g., via a cron job) to prevent
 * accumulation of expired tokens that could degrade query performance.
 *
 * @returns A promise that resolves to the database operation result,
 *          which includes metadata about the number of records deleted.
 */
export async function cleanupExpiredRefreshTokens() {
    const now = new Date();
    const result = await storage()
        .delete(refreshTokens)
        .where(lt(refreshTokens.expiresAt, now));
    return result;
}
