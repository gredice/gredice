import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import {
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementSurfaceAt,
} from '../animals/animalMovementTerrain';
import { createHedgehogHabitats } from './hedgehogHabitat';
import {
    hedgehogVisitLimits,
    planHedgehogVisit,
    sampleHedgehogVisit,
} from './hedgehogVisit';

const blockData = getLocalSandboxBlockData();
function garden(rotation = 0) {
    return Array.from({ length: 49 }, (_, i) => ({
        position: new Vector3((i % 7) - 3, 0, Math.floor(i / 7) - 3),
        blocks: [
            { name: 'Block_Grass', id: `ground:${i}`, rotation: 0 },
            ...(i === 24
                ? [{ name: 'HedgehogShelter', id: 'home', rotation }]
                : []),
        ],
    }));
}
describe('Hedgehog safe bounded visits', () => {
    for (const rotation of [0, 1, 2, 3])
        it(`returns through the authored entrance at rotation ${rotation}`, () => {
            const stacks = garden(rotation);
            const habitats = createHedgehogHabitats({
                stacks,
                blockData,
                gardenSeed: 'test',
            });
            assert.equal(habitats.length, 1);
            const h = habitats[0];
            const blocked = new Set(
                createAnimalBlockedCells(stacks, {
                    blockData,
                    blockWater: true,
                }).map((p) => `${p.x}:${p.z}`),
            );
            const surfaces = createAnimalMovementSurfaces({
                stacks,
                blockData,
                groundLift: 0.008,
                swimDepth: 0,
            });
            for (const route of h.routes)
                for (const p of route) {
                    assert.equal(
                        blocked.has(`${Math.round(p.x)}:${Math.round(p.z)}`),
                        false,
                    );
                    assert.equal(
                        getAnimalMovementSurfaceAt(p, surfaces)?.kind,
                        'ground',
                    );
                }
            for (let seq = 0; seq < 6; seq++) {
                const plan = planHedgehogVisit(h, seq);
                const duration = plan.reduce((n, s) => n + s.duration, 0);
                assert.ok(
                    duration > 10 &&
                        duration <= hedgehogVisitLimits.maxVisitSeconds,
                );
                const clips = new Set(plan.map((s) => s.clip));
                assert.equal(clips.size, 3);
                assert.deepEqual(
                    sampleHedgehogVisit(plan, 0).position,
                    h.portal,
                );
                assert.deepEqual(
                    sampleHedgehogVisit(plan, duration + 1).position,
                    h.portal,
                );
                assert.equal(
                    sampleHedgehogVisit(plan, duration + 1).complete,
                    true,
                );
                for (let t = 0; t < duration; t += 0.1) {
                    const p = sampleHedgehogVisit(plan, t).position;
                    const inPortal =
                        (Math.abs(p.x - h.portal.x) < 0.001 &&
                            Math.abs(p.z - h.portal.z) <= 0.65 + 0.001) ||
                        (Math.abs(p.z - h.portal.z) < 0.001 &&
                            Math.abs(p.x - h.portal.x) <= 0.65 + 0.001);
                    if (!inPortal)
                        assert.equal(
                            blocked.has(
                                `${Math.round(p.x)}:${Math.round(p.z)}`,
                            ),
                            false,
                        );
                }
            }
        });
    it('rejects water, occupied and raised entrances instead of spawning or retrying forever', () => {
        for (const obstacle of ['Water', 'GardenBrazier', 'Block_Stone']) {
            const stacks = garden();
            const entry = stacks.find(
                (s) => s.position.x === 0 && s.position.z === -1,
            );
            assert.ok(entry);
            entry.blocks.push({ name: obstacle, id: 'obstacle', rotation: 0 });
            assert.equal(
                createHedgehogHabitats({
                    stacks,
                    blockData,
                    gardenSeed: 'test',
                }).length,
                0,
                obstacle,
            );
        }
        const stacks = garden();
        const home = stacks[24];
        home.blocks.splice(1, 0, {
            name: 'OutletDisplayTable',
            id: 'table',
            rotation: 0,
        });
        assert.equal(
            createHedgehogHabitats({ stacks, blockData, gardenSeed: 'test' })
                .length,
            0,
        );
    });
    it('keeps many shelters deterministic and capped to one visitor', () => {
        const stacks = garden();
        for (const i of [8, 10, 12, 36, 38, 40])
            stacks[i].blocks.push({
                name: 'HedgehogShelter',
                id: `home:${i}`,
                rotation: 0,
            });
        const a = createHedgehogHabitats({
            stacks,
            blockData,
            gardenSeed: 'test',
        });
        const b = createHedgehogHabitats({
            stacks: [...stacks].reverse(),
            blockData,
            gardenSeed: 'test',
        });
        assert.equal(a.length, 1);
        assert.equal(a[0].id, b[0].id);
        assert.deepEqual(a[0].routes, b[0].routes);
        assert.equal(hedgehogVisitLimits.cooldownMs, 240000);
    });
});
