import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fallenLog } from '@gredice/js/fallenLog';
import { getGardenBlockFootprintOffsets } from '@gredice/js/gardenBlocks';
import { Vector3 } from 'three';
import { resolvePickupPlacementPreviewForRelative } from '../controls/PickupPlacementResolver';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Stack } from '../types/Stack';
import { canRotateSpanningDecorations } from './spanningDecorationPlacement';

const blockData = getLocalSandboxBlockData();
const candidate = { name: fallenLog.name, id: 'log', rotation: 0 };
const grass = (id: string) => ({ name: 'Block_Grass', id, rotation: 0 });

describe('FallenLog placement', () => {
    for (const rotation of [0, 1, 2, 3]) {
        it(`requires two compatible, level cells for placement and rotation ${rotation}`, () => {
            const offsets = getGardenBlockFootprintOffsets(fallenLog, rotation);
            assert.equal(offsets.length, 2);
            const source: Stack = {
                position: new Vector3(-5, 0, -5),
                blocks: [{ ...candidate, rotation }],
            };
            const supports = offsets.map((offset, index) => ({
                position: new Vector3(offset.x, 0, offset.y),
                blocks: [grass(`support-${index}`)],
            }));
            const preview = (stacks: Stack[]) =>
                resolvePickupPlacementPreviewForRelative({
                    blockData,
                    gardenIsSandbox: false,
                    localSandboxStorageKey: null,
                    movingSegments: [
                        {
                            sourceStack: source,
                            sourceStartIndex: 0,
                            blocks: source.blocks,
                            baseHeight: 0,
                            canRecycle: false,
                        },
                    ],
                    relative: { x: 5, y: 0, z: 5 },
                    stacks: [source, ...stacks],
                });
            assert.equal(preview(supports)?.nextIsBlocked, false);
            assert.equal(preview(supports)?.previewHoverHeight, 0.4);
            assert.equal(preview(supports.slice(0, 1))?.nextIsBlocked, true);
            for (const obstacle of [
                'Block_Grass',
                'Block_Water',
                'HarvestCrate',
            ]) {
                const uneven = supports.map((stack, index) =>
                    index === 1
                        ? {
                              ...stack,
                              blocks: [
                                  ...stack.blocks,
                                  {
                                      name: obstacle,
                                      id: 'obstacle',
                                      rotation: 0,
                                  },
                              ],
                          }
                        : stack,
                );
                assert.equal(preview(uneven)?.nextIsBlocked, true, obstacle);
            }
            const grid: Stack[] = [0, 1].flatMap((x) =>
                [0, 1].map((z) => ({
                    position: new Vector3(x, 0, z),
                    blocks: [
                        grass(`${x}:${z}`),
                        ...(x === 0 && z === 0 ? [candidate] : []),
                    ],
                })),
            );
            const canRotate = (stacks: Stack[]) =>
                canRotateSpanningDecorations({
                    blockData,
                    blockIds: new Set(['log']),
                    rotation,
                    stacks,
                });
            assert.equal(canRotate(grid), true);
            const second = offsets[1];
            const blocked = grid.map((stack) =>
                stack.position.x === second.x && stack.position.z === second.y
                    ? {
                          ...stack,
                          blocks: [
                              ...stack.blocks,
                              {
                                  name: 'HarvestCrate',
                                  id: 'crate',
                                  rotation: 0,
                              },
                          ],
                      }
                    : stack,
            );
            assert.equal(canRotate(blocked), false);
            const uneven = grid.map((stack) =>
                stack.position.x === second.x && stack.position.z === second.y
                    ? { ...stack, blocks: [...stack.blocks, grass('extra')] }
                    : stack,
            );
            assert.equal(canRotate(uneven), false);
        });
    }
    it('fails closed for missing fallen log metadata and preserves unrelated rotations', () => {
        const stack = { position: new Vector3(), blocks: [candidate] };
        assert.equal(
            canRotateSpanningDecorations({
                blockData: undefined,
                blockIds: new Set(['log']),
                rotation: 1,
                stacks: [stack],
            }),
            false,
        );
        assert.equal(
            canRotateSpanningDecorations({
                blockData: undefined,
                blockIds: new Set(['other']),
                rotation: 1,
                stacks: [stack],
            }),
            true,
        );
    });
});
