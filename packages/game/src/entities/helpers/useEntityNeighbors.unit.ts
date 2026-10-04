import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';
import { isFenceBlockName } from '../fenceConnections';
import { resolveEntityNeighbors } from './useEntityNeighbors';

function block(id: string, name: string, rotation: number): Block {
    return { id, name, rotation };
}

describe('entity neighbors', () => {
    it('keeps same-name matching as the default behavior', () => {
        const centerBlock = block('center', 'Shade', 0);
        const center = {
            blocks: [centerBlock],
            position: { x: 0, y: 0, z: 0 },
        };
        const stacks: GardenStack[] = [
            center,
            {
                blocks: [block('north', 'RaisedBed', 1)],
                position: { x: 1, y: 0, z: 0 },
            },
        ];

        assert.equal(
            resolveEntityNeighbors(stacks, center, centerBlock).total,
            0,
        );
    });

    it('connects adjacent fences across all current materials', () => {
        const centerBlock = block('center', 'Fence', 0);
        const center = {
            blocks: [centerBlock],
            position: { x: 0, y: 0, z: 0 },
        };
        const stacks: GardenStack[] = [
            center,
            {
                blocks: [block('west', 'WhiteFence', 1)],
                position: { x: 0, y: 0, z: 1 },
            },
            {
                blocks: [block('north', 'StoneFence', 2)],
                position: { x: 1, y: 0, z: 0 },
            },
            {
                blocks: [block('east', 'PolishedStoneFence', 3)],
                position: { x: 0, y: 0, z: -1 },
            },
            {
                blocks: [block('south', 'RaisedBed', 1)],
                position: { x: -1, y: 0, z: 0 },
            },
        ];

        assert.deepEqual(
            resolveEntityNeighbors(
                stacks,
                center,
                centerBlock,
                isFenceBlockName,
            ),
            {
                e: true,
                er: 3,
                n: true,
                nr: 2,
                s: false,
                sr: 1,
                total: 3,
                w: true,
                wr: 1,
            },
        );
    });
});
