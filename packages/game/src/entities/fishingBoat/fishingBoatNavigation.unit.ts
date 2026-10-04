import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import {
    createFishingBoatNavigationGrid,
    getFishingBoatPlacementCenter,
    isFishingBoatNavigablePose,
    resolveFishingBoatNavigation,
} from './fishingBoatNavigation';

function stack(x: number, z: number, name: string): Stack {
    return {
        position: new Vector3(x, 0, z),
        blocks: [
            {
                id: `${name}-${x.toString()}-${z.toString()}`,
                name,
                rotation: 0,
            },
        ],
    };
}

describe('fishing boat navigation', () => {
    it('uses the center of the two-cell placement footprint', () => {
        assert.deepEqual(
            getFishingBoatPlacementCenter({ rotation: 0, x: 2, z: 3 }),
            { x: 2, z: 3.5 },
        );
        assert.deepEqual(
            getFishingBoatPlacementCenter({ rotation: 1, x: 2, z: 3 }),
            { x: 2.5, z: 3 },
        );
    });

    it('treats water and swamp cells as navigable', () => {
        const grid = createFishingBoatNavigationGrid([
            stack(0, 0, 'Block_Water'),
            stack(0, 1, 'Block_Swamp'),
            stack(0, 2, 'Block_Grass'),
        ]);

        assert.equal(grid.has('0|0'), true);
        assert.equal(grid.has('0|1'), true);
        assert.equal(grid.has('0|2'), false);
        assert.equal(
            isFishingBoatNavigablePose({ grid, x: 0, yaw: 0, z: 0.5 }),
            true,
        );
    });

    it('stops before any part of the hull leaves navigable water', () => {
        const grid = createFishingBoatNavigationGrid([
            stack(0, 0, 'Block_Water'),
            stack(0, 1, 'Block_Water'),
        ]);
        const blocked = resolveFishingBoatNavigation({
            deltaX: 0.6,
            deltaZ: 0,
            grid,
            x: 0,
            yaw: 0,
            z: 0.5,
        });
        const allowed = resolveFishingBoatNavigation({
            deltaX: 0,
            deltaZ: 0.08,
            grid,
            x: 0,
            yaw: 0,
            z: 0.5,
        });

        assert.equal(blocked.moved, false);
        assert.equal(allowed.moved, true);
    });
});
