import assert from 'node:assert/strict';
import test from 'node:test';
import {
    claimSunflowerDrop,
    createAccount,
    getOrCreateSunflowerDropSpawn,
    getSunflowerDropClaimCountForSpawn,
    getSunflowers,
} from '@gredice/storage';
import { createTestDb } from './testDb';

const firstSunnyVisit = new Date('2026-06-02T10:00:00.000+02:00');
const secondSunnyVisit = new Date('2026-06-02T11:00:00.000+02:00');
const thirdSunnyVisit = new Date('2026-06-02T12:00:00.000+02:00');

test('claimSunflowerDrop awards once and rejects replayed claims', async () => {
    createTestDb();
    const accountId = await createAccount();
    const initialSunflowers = await getSunflowers(accountId);
    const spawnResult = await getOrCreateSunflowerDropSpawn({
        accountId,
        allowCreate: true,
        gardenId: 101,
        now: firstSunnyVisit,
        sourceBlockId: 'sunflower-block-1',
    });

    assert.ok(spawnResult.spawn);

    const claims = await Promise.all([
        claimSunflowerDrop({
            accountId,
            now: firstSunnyVisit,
            spawnId: spawnResult.spawn.spawnId,
        }),
        claimSunflowerDrop({
            accountId,
            now: firstSunnyVisit,
            spawnId: spawnResult.spawn.spawnId,
        }),
        claimSunflowerDrop({
            accountId,
            now: firstSunnyVisit,
            spawnId: spawnResult.spawn.spawnId,
        }),
    ]);

    assert.strictEqual(
        claims.filter((claim) => claim.status === 'claimed').length,
        1,
    );
    assert.strictEqual(
        claims.filter(
            (claim) =>
                claim.status === 'rejected' &&
                claim.reason === 'already_claimed',
        ).length,
        2,
    );
    assert.strictEqual(await getSunflowers(accountId), initialSunflowers + 1);
    assert.strictEqual(
        await getSunflowerDropClaimCountForSpawn(
            accountId,
            spawnResult.spawn.spawnId,
        ),
        1,
    );
});

test('sunflower drops stop after the daily reward limit', async () => {
    createTestDb();
    const accountId = await createAccount();

    const firstSpawn = await getOrCreateSunflowerDropSpawn({
        accountId,
        allowCreate: true,
        gardenId: 101,
        now: firstSunnyVisit,
        sourceBlockId: 'sunflower-block-1',
    });
    assert.ok(firstSpawn.spawn);
    assert.deepStrictEqual(
        await claimSunflowerDrop({
            accountId,
            now: firstSunnyVisit,
            spawnId: firstSpawn.spawn.spawnId,
        }),
        { amount: 1, status: 'claimed' },
    );

    const secondSpawn = await getOrCreateSunflowerDropSpawn({
        accountId,
        allowCreate: true,
        gardenId: 101,
        now: secondSunnyVisit,
        sourceBlockId: 'sunflower-block-1',
    });
    assert.ok(secondSpawn.spawn);
    assert.deepStrictEqual(
        await claimSunflowerDrop({
            accountId,
            now: secondSunnyVisit,
            spawnId: secondSpawn.spawn.spawnId,
        }),
        { amount: 1, status: 'claimed' },
    );

    const thirdSpawn = await getOrCreateSunflowerDropSpawn({
        accountId,
        allowCreate: true,
        gardenId: 101,
        now: thirdSunnyVisit,
        sourceBlockId: 'sunflower-block-1',
    });

    assert.deepStrictEqual(thirdSpawn, {
        created: false,
        reason: 'daily_limit',
        spawn: null,
    });
});
