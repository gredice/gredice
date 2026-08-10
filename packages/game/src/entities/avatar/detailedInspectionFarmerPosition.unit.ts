import assert from 'node:assert/strict';
import test from 'node:test';
import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import { findDetailedInspectionFarmerTransform } from './detailedInspectionFarmerPosition';

const blockData: BlockData[] = [
    {
        attributes: {
            height: 0.2,
            nightOnlyPurchase: false,
            stackable: true,
            type: 'terrain',
        },
        createdAt: '2026-08-10T00:00:00.000Z',
        entityType: { id: 8, label: 'Blok', name: 'block' },
        functions: { raisedBed: false, recycler: false },
        id: 1,
        information: {
            fullDescription: '',
            label: 'Trava',
            name: 'Block_Grass',
            shortDescription: '',
        },
        prices: { sunflowers: 0 },
        slug: 'block-grass',
        updatedAt: '2026-08-10T00:00:00.000Z',
    },
    {
        attributes: {
            height: 0.25,
            hitboxDepth: 0.8,
            hitboxHeight: 0.25,
            hitboxWidth: 0.8,
            nightOnlyPurchase: false,
            stackable: false,
            type: 'raisedBed',
        },
        createdAt: '2026-08-10T00:00:00.000Z',
        entityType: { id: 8, label: 'Blok', name: 'block' },
        functions: { raisedBed: true, recycler: false },
        id: 2,
        information: {
            fullDescription: '',
            label: 'Podignuta gredica',
            name: 'Raised_Bed',
            shortDescription: '',
        },
        prices: { sunflowers: 0 },
        slug: 'raised-bed',
        updatedAt: '2026-08-10T00:00:00.000Z',
    },
];

test('places the inspection farmer on walkable ground near the inspected bed', () => {
    const stacks: Stack[] = [];
    for (let x = -1; x <= 1; x += 1) {
        for (let z = -1; z <= 1; z += 1) {
            stacks.push({
                blocks: [
                    {
                        id: `ground-${x.toString()}-${z.toString()}`,
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    ...(x === 0 && z === 0
                        ? [
                              {
                                  id: 'raised-bed',
                                  name: 'Raised_Bed',
                                  rotation: 0,
                              },
                          ]
                        : []),
                ],
                position: new Vector3(x, 0, z),
            });
        }
    }

    const transform = findDetailedInspectionFarmerTransform({
        blockData,
        stacks,
        targetBlockId: 'raised-bed',
    });

    assert.ok(transform);
    assert.notDeepEqual(transform.position, [0, 0, 0]);
    assert.equal(Math.hypot(transform.position[0], transform.position[2]), 1);
    assert.equal(transform.position[1], 0.2);
});

test('falls back to the garden spawn when the inspected block is unavailable', () => {
    const transform = findDetailedInspectionFarmerTransform({
        blockData,
        stacks: [
            {
                blocks: [{ id: 'ground', name: 'Block_Grass', rotation: 0 }],
                position: new Vector3(2, 0, 3),
            },
        ],
        targetBlockId: null,
    });

    assert.deepEqual(transform, {
        position: [2, 0.2, 3],
        rotationY: 0,
    });
});
