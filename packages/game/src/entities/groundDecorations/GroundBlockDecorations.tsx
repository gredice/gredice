'use client';

import { useEffect, useMemo } from 'react';
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
    stacks: Stack[] | undefined;
};

function activeDragTargetKey(target: ActiveDragPreviewTarget) {
    return `${target.stackPosition.x}|${target.stackPosition.z}|${target.blockId}|${target.blockIndex}`;
}

export function GroundBlockDecorations({
    density,
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
    const decorationInstances = useMemo(() => {
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

    useEffect(() => {
        updateGameProfileMetadata({
            groundDecorationCount: decorationCount,
            groundDecorationDensity: density,
        });
    }, [decorationCount, density]);

    if (!stacks || density <= 0 || !decorationBlocks.length) {
        return null;
    }

    return <GroundDecorationInstances instances={decorationInstances} />;
}
