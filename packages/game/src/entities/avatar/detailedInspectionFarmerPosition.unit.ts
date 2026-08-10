import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import type { Stack } from '../../types/Stack';
import { findDetailedInspectionFarmerTransform } from './detailedInspectionFarmerPosition';

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
        blockData: null,
        stacks,
        targetBlockId: 'raised-bed',
    });

    assert.ok(transform);
    assert.notDeepEqual(transform.position, [0, 0, 0]);
    assert.equal(Math.hypot(transform.position[0], transform.position[2]), 1);
});

test('falls back to the garden spawn when the inspected block is unavailable', () => {
    const transform = findDetailedInspectionFarmerTransform({
        blockData: null,
        stacks: [
            {
                blocks: [{ id: 'ground', name: 'Block_Grass', rotation: 0 }],
                position: new Vector3(2, 0, 3),
            },
        ],
        targetBlockId: null,
    });

    assert.deepEqual(transform, {
        position: [2, 0, 3],
        rotationY: 0,
    });
});
