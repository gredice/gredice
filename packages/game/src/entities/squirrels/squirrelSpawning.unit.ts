import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createSquirrelRandom,
    createSquirrelSpawnPlan,
    getSquirrelCooldownRemainingMs,
    reconcileSquirrelCooldowns,
    type SquirrelSpawnCooldown,
    squirrelRespawnCooldownMs,
} from './squirrelSpawning';

const habitats = [
    { id: 'oak', seed: 11 },
    { id: 'pine', seed: 22 },
    { id: 'dead-tree', seed: 33 },
] as const;

describe('seeded squirrel spawning', () => {
    it('produces repeatable random and capped habitat selections', () => {
        const firstRandom = createSquirrelRandom(1234);
        const secondRandom = createSquirrelRandom(1234);
        assert.deepEqual(
            [firstRandom(), firstRandom(), firstRandom()],
            [secondRandom(), secondRandom(), secondRandom()],
        );

        const firstPlan = createSquirrelSpawnPlan({
            cooldowns: new Map(),
            gardenSeed: 'garden-17',
            habitats,
            now: 1_000,
        });
        const secondPlan = createSquirrelSpawnPlan({
            cooldowns: new Map(),
            gardenSeed: 'garden-17',
            habitats: [...habitats].reverse(),
            now: 99_000,
        });

        assert.equal(firstPlan.length, 2);
        assert.deepEqual(secondPlan, firstPlan);
        assert.equal(
            new Set(firstPlan.map((spawn) => spawn.habitatId)).size,
            2,
        );
    });

    it('holds the selected habitat slot empty for the full cooldown', () => {
        const initial = createSquirrelSpawnPlan({
            cooldowns: new Map(),
            gardenSeed: 'garden-17',
            habitats,
            now: 1_000,
        });
        const despawned = initial[0];
        assert.ok(despawned);
        const cooldowns = new Map<string, SquirrelSpawnCooldown>([
            [despawned.habitatId, { lastDespawnedAt: 1_000, spawnSequence: 1 }],
        ]);

        const coolingPlan = createSquirrelSpawnPlan({
            cooldowns,
            gardenSeed: 'garden-17',
            habitats,
            now: 1_000 + squirrelRespawnCooldownMs - 1,
        });
        assert.equal(coolingPlan.length, 1);
        assert.equal(
            coolingPlan.some(
                (spawn) => spawn.habitatId === despawned.habitatId,
            ),
            false,
        );
        assert.equal(
            getSquirrelCooldownRemainingMs({
                cooldown: cooldowns.get(despawned.habitatId),
                now: 1_000 + squirrelRespawnCooldownMs - 1,
            }),
            1,
        );

        const recoveredPlan = createSquirrelSpawnPlan({
            cooldowns,
            gardenSeed: 'garden-17',
            habitats,
            now: 1_000 + squirrelRespawnCooldownMs,
        });
        assert.equal(recoveredPlan.length, 2);
        assert.deepEqual(
            recoveredPlan.map((spawn) => spawn.habitatId),
            initial.map((spawn) => spawn.habitatId),
        );
        assert.equal(
            recoveredPlan.find(
                (spawn) => spawn.habitatId === despawned.habitatId,
            )?.spawnSequence,
            1,
        );
    });

    it('drops lifecycle state when its woody habitat disappears', () => {
        const cooldowns = new Map<string, SquirrelSpawnCooldown>([
            ['oak', { lastDespawnedAt: 100, spawnSequence: 1 }],
            ['removed-tree', { lastDespawnedAt: 200, spawnSequence: 2 }],
        ]);
        const reconciled = reconcileSquirrelCooldowns({
            cooldowns,
            habitats,
        });

        assert.deepEqual(Array.from(reconciled.keys()), ['oak']);
    });
});
