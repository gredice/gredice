import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createEntity,
    FavoriteEntityNotFoundError,
    listUserFavorites,
    setUserFavorite,
    storage,
    upsertEntityType,
    users,
} from '@gredice/storage';
import { createTestDb } from './testDb';

async function createTestUser() {
    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `${userId}@example.com`,
            role: 'user',
        });
    return userId;
}

async function createFavoriteTarget(entityTypeName: string) {
    await upsertEntityType({
        name: entityTypeName,
        label: entityTypeName,
    });

    return await createEntity(entityTypeName);
}

test('user favorites can be listed, set, filtered, and removed per user', async () => {
    createTestDb();

    const userId = await createTestUser();
    const otherUserId = await createTestUser();
    const plantId = await createFavoriteTarget('plant');
    const plantSortId = await createFavoriteTarget('plantSort');

    const plantFavorite = await setUserFavorite({
        userId,
        entityType: 'plant',
        entityId: plantId,
        favorited: true,
    });
    assert.equal(plantFavorite.favorited, true);
    assert.equal(plantFavorite.favorite?.entityId, plantId);

    await setUserFavorite({
        userId,
        entityType: 'plant',
        entityId: plantId,
        favorited: true,
    });

    await setUserFavorite({
        userId,
        entityType: 'plantSort',
        entityId: plantSortId,
        favorited: true,
    });

    const allFavorites = await listUserFavorites({ userId });
    assert.equal(allFavorites.length, 2);
    assert.deepEqual(
        allFavorites.map((favorite) => favorite.userId),
        [userId, userId],
    );

    const plantFavorites = await listUserFavorites({
        userId,
        entityType: 'plant',
    });
    assert.deepEqual(
        plantFavorites.map((favorite) => favorite.entityId),
        [plantId],
    );

    assert.deepEqual(await listUserFavorites({ userId: otherUserId }), []);

    const removed = await setUserFavorite({
        userId,
        entityType: 'plant',
        entityId: plantId,
        favorited: false,
    });
    assert.equal(removed.favorited, false);
    assert.equal(removed.favorite, null);

    assert.deepEqual(
        (await listUserFavorites({ userId })).map(
            (favorite) => favorite.entityType,
        ),
        ['plantSort'],
    );
});

test('favoriting validates the requested entity type against the entity row', async () => {
    createTestDb();

    const userId = await createTestUser();
    const plantId = await createFavoriteTarget('plant');

    await assert.rejects(
        () =>
            setUserFavorite({
                userId,
                entityType: 'operation',
                entityId: plantId,
                favorited: true,
            }),
        FavoriteEntityNotFoundError,
    );
});
