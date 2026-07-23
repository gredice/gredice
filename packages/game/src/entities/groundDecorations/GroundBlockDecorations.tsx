'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
    type ActiveDragPreviewTarget,
    createActiveDragPreviewTarget,
    getActiveDragPreviewTargetPositionOffset,
} from '../../dragPreviewIdentity';
import { useBlockData } from '../../hooks/useBlockData';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { updateGameProfileMetadata } from '../../scene/gameProfileMetadata';
import type { Stack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
import { getStackHeight } from '../../utils/getStackHeight';
import {
    type GroundDecorationInstance,
    GroundDecorationInstances,
} from './GroundDecorationInstances';
import { getBlockSurfaceDecorations } from './getBlockSurfaceDecorations';
import { getGroundDecorationBlocks } from './groundDecorationBlocks';

const blockSurfaceYOffset = 0.2;
type GroundBlockDecorationsProps = {
    density: number;
    farmId?: number | null;
    stacks: Stack[] | undefined;
};

function activeDragTargetKey(target: ActiveDragPreviewTarget) {
    return `${target.stackPosition.x}|${target.stackPosition.z}|${target.blockId}|${target.blockIndex}`;
}

function numbersEqual(left: number, right: number) {
    return Math.abs(left - right) <= 0.0001;
}

function decorationInstancesEqual(
    left: GroundDecorationInstance[] | undefined,
    right: GroundDecorationInstance[],
) {
    if (left === right) {
        return true;
    }
    if (!left || left.length !== right.length) {
        return false;
    }

    return left.every((leftInstance, index) => {
        const rightInstance = right[index];
        return (
            Boolean(rightInstance) &&
            numbersEqual(leftInstance.alphaTest, rightInstance.alphaTest) &&
            numbersEqual(leftInstance.height, rightInstance.height) &&
            numbersEqual(leftInstance.opacity, rightInstance.opacity) &&
            numbersEqual(
                leftInstance.position[0],
                rightInstance?.position[0] ?? Number.NaN,
            ) &&
            numbersEqual(
                leftInstance.position[1],
                rightInstance?.position[1] ?? Number.NaN,
            ) &&
            numbersEqual(
                leftInstance.position[2],
                rightInstance?.position[2] ?? Number.NaN,
            ) &&
            numbersEqual(leftInstance.rotationZ, rightInstance.rotationZ) &&
            leftInstance.spriteName === rightInstance.spriteName
        );
    });
}

function useStableDecorationInstances(instances: GroundDecorationInstance[]) {
    const previous = useRef<GroundDecorationInstance[] | undefined>(undefined);

    if (!decorationInstancesEqual(previous.current, instances)) {
        previous.current = instances;
    }

    return previous.current ?? instances;
}

export function GroundBlockDecorations({
    density,
    farmId,
    stacks,
}: GroundBlockDecorationsProps) {
    const { data: blockData } = useBlockData();
    const { data: garden } = useCurrentGarden();
    const decorationBlocks = useMemo(() => {
        if (!stacks || density <= 0) {
            return [];
        }

        return getGroundDecorationBlocks(stacks).flatMap(
            ({ block, blockIndex, stack, surface }) => {
                const placements = getBlockSurfaceDecorations({
                    block,
                    density,
                    gardenId: garden?.id,
                    surface,
                });

                if (!placements.length) {
                    return [];
                }

                return [
                    {
                        block,
                        blockIndex,
                        placements,
                        stack,
                        surface,
                    },
                ];
            },
        );
    }, [density, garden?.id, stacks]);
    const decoratedBlockPreviewKeys = useMemo(
        () =>
            new Set(
                decorationBlocks.map(({ block, blockIndex, stack }) =>
                    activeDragTargetKey(
                        createActiveDragPreviewTarget({
                            blockId: block.id,
                            blockIndex,
                            stackPosition: stack.position,
                        }),
                    ),
                ),
            ),
        [decorationBlocks],
    );
    const activeDragPreview = useGameState((state) => {
        const preview = state.activeDragPreview;
        if (!preview) {
            return null;
        }

        if (
            decoratedBlockPreviewKeys.has(activeDragTargetKey(preview.source))
        ) {
            return preview;
        }

        return preview.targets.some((target) =>
            decoratedBlockPreviewKeys.has(activeDragTargetKey(target)),
        )
            ? preview
            : null;
    });
    const decorationCount = decorationBlocks.reduce(
        (sum, block) => sum + block.placements.length,
        0,
    );
    const computedDecorationInstances = useMemo(() => {
        const instances: GroundDecorationInstance[] = [];

        for (const {
            block,
            blockIndex,
            placements,
            stack,
        } of decorationBlocks) {
            const dragPreviewOffset = getActiveDragPreviewTargetPositionOffset(
                createActiveDragPreviewTarget({
                    blockId: block.id,
                    blockIndex,
                    stackPosition: stack.position,
                }),
                activeDragPreview,
            );
            const blockRotation = block.rotation * (Math.PI / 2);
            const cos = Math.cos(blockRotation);
            const sin = Math.sin(blockRotation);
            const baseHeight =
                getStackHeight(blockData, stack, block) + blockSurfaceYOffset;
            const offsetX = dragPreviewOffset?.x ?? 0;
            const offsetY = dragPreviewOffset?.y ?? 0;
            const offsetZ = dragPreviewOffset?.z ?? 0;

            for (const placement of placements) {
                const [localX, localY, localZ] = placement.position;
                const rotatedX = localX * cos + localZ * sin;
                const rotatedZ = -localX * sin + localZ * cos;

                instances.push({
                    alphaTest: placement.kind === 'flower' ? 0.05 : 0.06,
                    height:
                        placement.kind === 'flower'
                            ? placement.scale
                            : placement.height,
                    opacity:
                        placement.kind === 'flower'
                            ? 0.95
                            : Math.round(placement.opacity * 20) / 20,
                    position: [
                        stack.position.x + rotatedX + offsetX,
                        baseHeight + localY + offsetY,
                        stack.position.z + rotatedZ + offsetZ,
                    ],
                    rotationZ:
                        placement.kind === 'flower' ? placement.rotation : 0,
                    spriteName: placement.spriteName,
                });
            }
        }

        return instances;
    }, [activeDragPreview, blockData, decorationBlocks]);
    const decorationInstances = useStableDecorationInstances(
        computedDecorationInstances,
    );

    useEffect(() => {
        updateGameProfileMetadata({
            groundDecorationCount: decorationCount,
            groundDecorationDensity: density,
        });
    }, [decorationCount, density]);

    if (!stacks || density <= 0 || !decorationBlocks.length) {
        return null;
    }

    return (
        <GroundDecorationInstances
            farmId={farmId}
            instances={decorationInstances}
        />
    );
}
