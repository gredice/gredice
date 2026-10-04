import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AnimalMovementSurface } from '../animals/animalMovementTerrain';
import {
    chooseHorseRetreatTarget,
    createHorseNavigationBlockedCells,
    createHorseRandom,
    getHorseMovementAnimation,
    getHorseSettledAnimation,
    horseMaximumRetreatDistance,
    isHorsePathSafe,
    pickHorseSettledBehavior,
    resolveHorseMovement,
} from './horseBehavior';

function ground(x: number, z: number): AnimalMovementSurface {
    return { kind: 'ground', x, y: 0.4, z };
}

describe('Horse behavior', () => {
    it('uses a stable seeded behavior sequence without render-time randomness', () => {
        const first = createHorseRandom('horse-1');
        const second = createHorseRandom('horse-1');
        assert.deepEqual(
            Array.from({ length: 8 }, () => first()),
            Array.from({ length: 8 }, () => second()),
        );
    });

    it('covers all settled animation states and becomes attentive near avatars', () => {
        assert.equal(getHorseSettledAnimation('idle'), 'Horse_Idle');
        assert.equal(getHorseSettledAnimation('graze'), 'Horse_Graze');
        assert.equal(getHorseSettledAnimation('attentive'), 'Horse_Attentive');
        assert.equal(getHorseSettledAnimation('tail-swish'), 'Horse_TailSwish');
        assert.equal(getHorseMovementAnimation('walk'), 'Horse_Walk');
        assert.equal(getHorseMovementAnimation('trot'), 'Horse_Trot');
        assert.equal(
            pickHorseSettledBehavior({
                avatarDistance: 1.8,
                random: () => 0,
            }),
            'attentive',
        );
    });

    it('closes missing terrain so routes cannot escape around blockers', () => {
        const surfaces = [ground(0, 1), ground(2, 1)];
        const blockedCells = createHorseNavigationBlockedCells({
            blockedCells: [],
            center: { x: 1, z: 1 },
            radius: 3,
            surfaces,
        });

        assert.equal(
            blockedCells.some(({ x, z }) => x === 1 && z === 1),
            true,
        );
        assert.equal(
            resolveHorseMovement({
                blockedCells,
                from: { x: 0, y: 0.4, z: 1 },
                reason: 'roam',
                surfaces,
                to: { x: 2, y: 0.4, z: 1 },
            }),
            null,
        );
    });

    it('rejects paths that cross water, missing terrain, or occupied cells', () => {
        const surfaces: AnimalMovementSurface[] = [
            ground(0, 0),
            { kind: 'water', x: 1, y: 0.2, z: 0 },
            ground(2, 0),
        ];
        const path = [
            { x: 0, y: 0.4, z: 0 },
            { x: 2, y: 0.4, z: 0 },
        ];

        assert.equal(
            isHorsePathSafe({ blockedCells: [], path, surfaces }),
            false,
        );
        assert.equal(
            isHorsePathSafe({
                blockedCells: [{ x: 1, z: 0 }],
                path,
                surfaces: [ground(0, 0), ground(1, 0), ground(2, 0)],
            }),
            false,
        );
    });

    it('chooses a short safe retreat and trots only for that response', () => {
        const retreat = chooseHorseRetreatTarget({
            avatar: { x: 0.3, z: 0 },
            current: { x: 0, z: 0 },
            candidates: [
                { x: 1, y: 0.4, z: 0 },
                { x: -2, y: 0.4, z: 0 },
                { x: -3, y: 0.4, z: 0 },
            ],
        });
        assert.deepEqual(retreat, { x: -2, y: 0.4, z: 0 });

        const surfaces = [ground(0, 0), ground(-1, 0), ground(-2, 0)];
        const movement = resolveHorseMovement({
            blockedCells: [],
            from: { x: 0, y: 0.4, z: 0 },
            reason: 'avatar-step-away',
            surfaces,
            to: { x: -2, y: 0.4, z: 0 },
        });
        assert.equal(movement?.gait, 'trot');
        assert.ok((movement?.pathDistance ?? 0) <= horseMaximumRetreatDistance);

        const roam = resolveHorseMovement({
            blockedCells: [],
            from: { x: 0, y: 0.4, z: 0 },
            reason: 'roam',
            surfaces,
            to: { x: -2, y: 0.4, z: 0 },
        });
        assert.equal(roam?.gait, 'walk');
    });
});
