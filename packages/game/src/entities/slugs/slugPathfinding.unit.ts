import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findSlugPath, type SlugPathCell } from './slugPathfinding';

function cell(x: number, z: number, moisture = 0.8): SlugPathCell {
    return { id: `${x}:${z}`, moisture, x, y: 0, z };
}

describe('slug pathfinding', () => {
    it('stays entirely within eligible habitat', () => {
        const habitat = [
            cell(0, 0),
            cell(0, 1),
            cell(0, 2),
            cell(1, 2),
            cell(2, 2),
        ];
        const path = findSlugPath({
            habitat,
            start: cell(0, 0),
            target: cell(2, 2),
        });

        assert.equal(path.status, 'path');
        assert.deepEqual(
            path.points.map(({ x, z }) => [x, z]),
            [
                [0, 0],
                [0, 1],
                [0, 2],
                [1, 2],
                [2, 2],
            ],
        );
    });

    it('does not cut diagonally across missing or invalid cells', () => {
        const path = findSlugPath({
            habitat: [cell(0, 0), cell(1, 1)],
            start: cell(0, 0),
            target: cell(1, 1),
        });

        assert.equal(path.status, 'unreachable');
        assert.deepEqual(path.points, []);
    });

    it('rejects targets outside the eligible habitat set', () => {
        const path = findSlugPath({
            habitat: [cell(0, 0), cell(0, 1)],
            start: cell(0, 0),
            target: cell(1, 0),
        });

        assert.equal(path.status, 'unreachable');
    });
});
