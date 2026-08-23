import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AnimalMovementSurface } from '../animals/animalMovementTerrain';
import {
    createFrogHabitats,
    createFrogSpawnCandidates,
    createInitialFrogSpawnState,
    frogMaxPopulation,
    frogMaxPopulationPerHabitat,
    frogMaxShallowWaterDepth,
    frogSpawnCooldownMaxSeconds,
    frogSpawnCooldownMinSeconds,
    reconcileFrogSpawns,
    reconcileFrogTarget,
} from './frogSpawning';

function surface({
    depth,
    habitat = 'wetland',
    kind,
    x,
    z,
}: {
    depth?: number;
    habitat?: AnimalMovementSurface['habitat'];
    kind: AnimalMovementSurface['kind'];
    x: number;
    z: number;
}): AnimalMovementSurface {
    return {
        habitat,
        kind,
        sourceBlockName:
            habitat === 'wetland'
                ? kind === 'water'
                    ? 'Block_Swamp_Water'
                    : 'Block_Swamp_Ground'
                : 'Block_Grass',
        waterDepth: depth,
        x,
        y: kind === 'water' ? 0.36 : 0.42,
        z,
    };
}

describe('frog wetland spawning', () => {
    it('requires an explicit connected wetland habitat', () => {
        const dry = createFrogHabitats({
            blockedCells: [],
            surfaces: [
                surface({ habitat: 'general', kind: 'ground', x: 0, z: 0 }),
                surface({ habitat: 'general', kind: 'ground', x: 1, z: 0 }),
            ],
        });
        const isolated = createFrogHabitats({
            blockedCells: [],
            surfaces: [surface({ kind: 'ground', x: 0, z: 0 })],
        });
        const wetland = createFrogHabitats({
            blockedCells: [],
            surfaces: [
                surface({ kind: 'ground', x: 0, z: 0 }),
                surface({ depth: 1.1, kind: 'water', x: 1, z: 0 }),
            ],
        });

        assert.equal(dry.length, 0);
        assert.equal(isolated.length, 0);
        assert.equal(wetland.length, 1);
    });

    it('rejects deep water and never joins it to a valid wetland group', () => {
        const habitats = createFrogHabitats({
            blockedCells: [],
            surfaces: [
                surface({ kind: 'ground', x: 0, z: 0 }),
                surface({ depth: 1.1, kind: 'water', x: 1, z: 0 }),
                surface({
                    depth: frogMaxShallowWaterDepth + 0.01,
                    kind: 'water',
                    x: 2,
                    z: 0,
                }),
                surface({ kind: 'ground', x: 3, z: 0 }),
            ],
        });

        assert.equal(habitats.length, 1);
        assert.deepEqual(
            habitats[0]?.targets.map((target) => target.id).sort(),
            ['ground-0:0', 'water-1:0'],
        );
    });

    it('excludes occupied wetland cells from spawn, settlement, and traversal', () => {
        const habitats = createFrogHabitats({
            blockedCells: [{ x: 1, z: 0 }],
            surfaces: [
                surface({ kind: 'ground', x: 0, z: 0 }),
                surface({ kind: 'ground', x: 1, z: 0 }),
                surface({ depth: 1.1, kind: 'water', x: 0, z: 1 }),
                surface({ kind: 'ground', x: 1, z: 1 }),
            ],
        });

        assert.equal(habitats.length, 1);
        assert.deepEqual(habitats[0]?.blockedCells, [{ x: 1, z: 0 }]);
        assert.equal(
            habitats[0]?.targets.some(
                (target) => target.position.x === 1 && target.position.z === 0,
            ),
            false,
        );
        assert.equal(
            habitats[0]?.traversableCells.some(
                (cell) => cell.x === 1 && cell.z === 0,
            ),
            false,
        );
    });

    it('prefers shallow water for deterministic seeded start placement', () => {
        const habitats = createFrogHabitats({
            blockedCells: [],
            surfaces: Array.from({ length: 6 }, (_, x) =>
                surface({
                    depth: x === 3 ? 1.05 : undefined,
                    kind: x === 3 ? 'water' : 'ground',
                    x,
                    z: 0,
                }),
            ),
        });
        const first = createFrogSpawnCandidates(habitats);
        const second = createFrogSpawnCandidates(habitats);

        assert.deepEqual(first, second);
        assert.equal(first[0]?.startTarget.kind, 'shallow-water');
    });

    it('enforces deterministic population and cooldown caps', () => {
        const habitats = createFrogHabitats({
            blockedCells: [],
            surfaces: Array.from({ length: 30 }, (_, index) =>
                surface({ kind: 'ground', x: index, z: 0 }),
            ),
        });
        const candidates = createFrogSpawnCandidates(habitats);
        assert.equal(candidates.length, frogMaxPopulationPerHabitat);

        const fourHabitats = createFrogHabitats({
            blockedCells: [],
            surfaces: [0, 10, 20, 30].flatMap((start) =>
                Array.from({ length: 6 }, (_, offset) =>
                    surface({ kind: 'ground', x: start + offset, z: 0 }),
                ),
            ),
        });
        assert.equal(
            createFrogSpawnCandidates(fourHabitats).length,
            frogMaxPopulation,
        );

        const initial = createInitialFrogSpawnState();
        const first = reconcileFrogSpawns({
            candidates,
            now: 100,
            previous: initial,
            seed: 42,
        });
        const repeated = reconcileFrogSpawns({
            candidates,
            now: 100,
            previous: initial,
            seed: 42,
        });
        const early = reconcileFrogSpawns({
            candidates,
            now: first.nextSpawnAt - 0.01,
            previous: first,
            seed: 42,
        });
        const second = reconcileFrogSpawns({
            candidates,
            now: first.nextSpawnAt,
            previous: first,
            seed: 42,
        });
        const capped = reconcileFrogSpawns({
            candidates,
            now: second.nextSpawnAt,
            previous: second,
            seed: 42,
        });

        assert.deepEqual(first, repeated);
        assert.equal(first.activeCandidateIds.length, 1);
        assert.equal(early.activeCandidateIds.length, 1);
        assert.equal(second.activeCandidateIds.length, 2);
        assert.equal(capped.activeCandidateIds.length, 2);
        assert.ok(
            first.nextSpawnAt - 100 >= frogSpawnCooldownMinSeconds &&
                first.nextSpawnAt - 100 <= frogSpawnCooldownMaxSeconds,
        );
    });

    it('reconciles removed habitat without retaining an invalid frog', () => {
        const habitats = createFrogHabitats({
            blockedCells: [],
            surfaces: Array.from({ length: 6 }, (_, x) =>
                surface({ kind: 'ground', x, z: 0 }),
            ),
        });
        const candidates = createFrogSpawnCandidates(habitats);
        const active = reconcileFrogSpawns({
            candidates,
            now: 0,
            previous: createInitialFrogSpawnState(),
            seed: 9,
        });
        const reconciled = reconcileFrogSpawns({
            candidates: [],
            now: 1,
            previous: active,
            seed: 9,
        });

        assert.deepEqual(reconciled.activeCandidateIds, []);
    });

    it('resets a retained frog when its settled target becomes occupied', () => {
        const originalHabitat = createFrogHabitats({
            blockedCells: [],
            surfaces: Array.from({ length: 6 }, (_, x) =>
                surface({ kind: 'ground', x, z: 0 }),
            ),
        })[0];
        const editedHabitat = createFrogHabitats({
            blockedCells: [{ x: 2, z: 0 }],
            surfaces: Array.from({ length: 6 }, (_, x) =>
                surface({ kind: 'ground', x, z: 0 }),
            ),
        })[0];
        assert.ok(originalHabitat);
        assert.ok(editedHabitat);
        const originalCandidate = createFrogSpawnCandidates([
            originalHabitat,
        ])[0];
        const editedCandidate = createFrogSpawnCandidates([editedHabitat])[0];
        assert.ok(originalCandidate);
        assert.ok(editedCandidate);
        assert.equal(editedCandidate.id, originalCandidate.id);
        const staleTarget = originalHabitat.targets.find(
            (target) => target.id === 'ground-2:0',
        );
        assert.ok(staleTarget);

        const reconciled = reconcileFrogTarget(editedCandidate, staleTarget);

        assert.equal(reconciled.requiresReset, true);
        assert.equal(reconciled.target.id, editedCandidate.startTarget.id);
        assert.notEqual(reconciled.target.id, staleTarget.id);
    });
});
