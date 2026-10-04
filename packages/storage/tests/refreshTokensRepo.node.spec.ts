import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createRefreshToken,
    doUseRefreshToken,
    getRefreshTokenUserId,
    refreshTokens,
    storage,
    users,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { createTestDb } from './testDb';

test('getRefreshTokenUserId validates refresh token without marking it used', async () => {
    createTestDb();

    const userId = randomUUID();
    await storage().insert(users).values({
        id: userId,
        userName: 'refresh-token@example.com',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    const token = await createRefreshToken(userId);
    const [tokenId] = token.split('.');
    assert.ok(tokenId);

    const previousLastUsedAt = new Date(Date.now() - 60_000);
    await storage()
        .update(refreshTokens)
        .set({ lastUsedAt: previousLastUsedAt })
        .where(eq(refreshTokens.id, tokenId));

    const readOnlyResult = await getRefreshTokenUserId(token);
    assert.deepEqual(readOnlyResult, { userId });

    const afterReadOnly = await storage().query.refreshTokens.findFirst({
        where: eq(refreshTokens.id, tokenId),
    });
    assert.equal(
        afterReadOnly?.lastUsedAt.getTime(),
        previousLastUsedAt.getTime(),
    );

    const useResult = await doUseRefreshToken(token);
    assert.deepEqual(useResult, { userId });

    const afterUse = await storage().query.refreshTokens.findFirst({
        where: eq(refreshTokens.id, tokenId),
    });
    assert.ok(afterUse);
    assert.ok(afterUse.lastUsedAt.getTime() > previousLastUsedAt.getTime());
});
