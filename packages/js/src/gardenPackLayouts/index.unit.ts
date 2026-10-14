import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveGardenBlockPlacement } from '../gardenBlocks';
import {
    type GardenPackLayoutPlacement,
    getGardenPackLayoutCells,
    resolveGardenPackLayoutPlacements,
} from './index';

const slot: GardenPackLayoutPlacement = {
    slotId: 'log',
    lineId: 'log',
    entityId: '1',
    modelName: 'FallenLog',
    variant: null,
    offset: { x: 2, y: 3 },
    rotation: 0,
    footprint: { width: 2, depth: 3 },
};
test('all quarter turns rotate occupied cells with runtime +Y orientation and preserve six cells', () => {
    const expected = [
        { x: 12, y: 23 },
        { x: 13, y: 17 },
        { x: 7, y: 15 },
        { x: 5, y: 22 },
    ];
    for (let rotation = 0; rotation < 4; rotation++) {
        const placements = resolveGardenPackLayoutPlacements(
            { placements: [slot] },
            { x: 10, y: 20 },
            rotation,
        );
        assert.deepEqual(placements[0]?.position, expected[rotation]);
        assert.equal(placements[0]?.rotation, rotation);
        assert.equal(getGardenPackLayoutCells(placements).length, 6);
    }
});
test('authored turns combine with group turns and footprints reject unsupported grid bounds', () => {
    const result = resolveGardenPackLayoutPlacements(
        { placements: [{ ...slot, rotation: 1 }] },
        { x: 0, y: 0 },
        1,
    );
    assert.deepEqual(result[0]?.position, { x: 3, y: -4 });
    assert.deepEqual(result[0]?.footprint, { width: 2, depth: 3 });
    assert.throws(() =>
        resolveGardenPackLayoutPlacements(
            { placements: [slot] },
            { x: 2147483647, y: 0 },
            0,
        ),
    );
    assert.throws(() =>
        resolveGardenPackLayoutPlacements(
            { placements: [slot] },
            { x: 0, y: 0 },
            4,
        ),
    );
});
test('requested rotation validates candidate multi-cell span without altering existing same-model occupancy', () => {
    const data = new Map([
        [
            'FallenLog',
            {
                attributes: {
                    spanWidth: 2,
                    spanDepth: 1,
                    height: 1,
                    stackable: false,
                    type: 'decoration',
                },
            },
        ],
        [
            'Block_Grass',
            { attributes: { height: 1, stackable: true, type: 'terrain' } },
        ],
    ]);
    const stacks = [{ positionX: 0, positionY: 1, blocks: ['existing'] }];
    const names = new Map([['existing', 'FallenLog']]);
    const args = {
        blockName: 'FallenLog',
        stacks,
        blockNameById: names,
        blockDataByName: data,
        blockRotationById: new Map([['existing', 0]]),
        requestedPosition: { x: 0, y: 0 },
    };
    assert.equal(
        resolveGardenBlockPlacement({ ...args, requestedRotation: 0 }).valid,
        true,
    );
    assert.equal(
        resolveGardenBlockPlacement({ ...args, requestedRotation: 1 }).valid,
        false,
    );
    assert.equal(
        resolveGardenBlockPlacement({
            ...args,
            requestedPosition: { x: 1, y: 1 },
            requestedRotation: 1,
        }).valid,
        false,
    );
});
