import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { AnimalMovementSurface } from '../animals/animalMovementTerrain';
import {
    chooseSquirrelFleeState,
    createScheduledDepartureState,
    squirrelActorScale,
} from './Squirrels';
import type { SquirrelHabitat, SquirrelTarget } from './squirrelHabitat';

function target(id: string, x: number, z: number): SquirrelTarget {
    return { id, position: new Vector3(x, 0.42, z) };
}

function habitat({
    blockedCells = [],
    escapeTargets,
    roamTargets,
}: {
    blockedCells?: { x: number; z: number }[];
    escapeTargets: SquirrelTarget[];
    roamTargets: SquirrelTarget[];
}): SquirrelHabitat {
    const groundSurfaces: AnimalMovementSurface[] = [];
    for (let x = -3; x <= 3; x += 1) {
        for (let z = -2; z <= 2; z += 1) {
            groundSurfaces.push({ kind: 'ground', x, y: 0.42, z });
        }
    }
    return {
        blockedCells,
        escapeTargets,
        groundSurfaces,
        id: 'squirrel-tree',
        revisionKey: '1',
        roamTargets,
        seed: 1,
        spawnTarget: target('spawn', 0, 0),
        treeBlockName: 'Tree',
        treePosition: new Vector3(2, 0.42, 0),
    };
}

describe('squirrel avatar flee response', () => {
    it('renders at a substantially smaller ambient-animal scale', () => {
        assert.equal(squirrelActorScale, 0.2);
        assert.ok(squirrelActorScale < 0.39 * 0.6);
    });

    it('prefers a route-safe tree exit farther from the avatar', () => {
        const safeTree = target('safe-tree', 2, 0);
        const flee = chooseSquirrelFleeState({
            avatarPosition: new Vector3(-1, 0.42, 0),
            from: new Vector3(0, 0.42, 0),
            habitat: habitat({
                escapeTargets: [target('near-tree', -0.5, 0), safeTree],
                roamTargets: [target('fallback', 0, 2)],
            }),
            now: 12,
        });

        assert.ok(flee);
        assert.equal(flee.target.id, safeTree.id);
        assert.equal(flee.despawnOnArrival, true);
        assert.notEqual(flee.pathfinding.status, 'unreachable');
    });

    it('uses a safe ground retreat when every tree route is blocked', () => {
        const flee = chooseSquirrelFleeState({
            avatarPosition: new Vector3(-1, 0.42, 0),
            from: new Vector3(0, 0.42, 0),
            habitat: habitat({
                blockedCells: [
                    { x: 1, z: -2 },
                    { x: 1, z: -1 },
                    { x: 1, z: 0 },
                    { x: 1, z: 1 },
                    { x: 1, z: 2 },
                ],
                escapeTargets: [target('blocked-tree', 2, 0)],
                roamTargets: [target('fallback', 0, 2)],
            }),
            now: 12,
        });

        assert.ok(flee);
        assert.equal(flee.target.id, 'fallback');
        assert.equal(flee.despawnOnArrival, false);
        assert.notEqual(flee.pathfinding.status, 'unreachable');
    });

    it('still completes a scheduled exit when the spawn tree is unreachable', () => {
        const from = new Vector3(2, 0.42, 0);
        const departure = createScheduledDepartureState({
            from,
            habitat: habitat({
                blockedCells: [
                    { x: 1, z: -2 },
                    { x: 1, z: -1 },
                    { x: 1, z: 0 },
                    { x: 1, z: 1 },
                    { x: 1, z: 2 },
                ],
                escapeTargets: [],
                roamTargets: [],
            }),
            now: 12,
        });

        assert.equal(departure.phase, 'exiting');
        if (departure.phase === 'exiting') {
            assert.deepEqual(departure.destination, from);
        }
    });
});
