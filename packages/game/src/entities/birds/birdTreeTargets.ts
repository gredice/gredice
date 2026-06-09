import type { BlockData } from '@gredice/client';
import { Vector3 } from 'three';
import type { Block } from '../../types/Block';
import type { Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/stackHeightCore';

export type BirdTreeLandingTarget = {
    blockId: string;
    facingYaw?: number;
    id: string;
    position: Vector3;
};

type BirdTreeLandingPoint = {
    id: string;
    position: readonly [number, number, number];
};

// Positions are render-space offsets from the block base, after each tree
// asset's model offset and scale. Y values sit just under the visible surface.
const birdTreeLandingPointsByBlockName: Record<
    string,
    readonly BirdTreeLandingPoint[]
> = {
    Tree: [
        { id: 'canopy-top-front', position: [-0.14, 2.31, 0.23] },
        { id: 'canopy-top-right', position: [0.18, 2.24, -0.34] },
        { id: 'canopy-top-left', position: [-0.24, 2.18, 0.4] },
    ],
    Pine: [
        { id: 'canopy-upper-front', position: [0, 1.7, 0.28] },
        { id: 'canopy-upper-right', position: [0.24, 1.67, 0.08] },
        { id: 'canopy-upper-left', position: [-0.2, 1.67, -0.16] },
    ],
    PineAdvent: [
        { id: 'canopy-upper-front', position: [0, 1.7, 0.28] },
        { id: 'canopy-upper-right', position: [0.24, 1.67, 0.08] },
        { id: 'canopy-upper-left', position: [-0.2, 1.67, -0.16] },
    ],
    DeadTreeTall: [
        { id: 'branch-right-top', position: [0.53, 1.58, -0.15] },
        { id: 'branch-left-tip', position: [-0.35, 1.56, -0.12] },
    ],
    DeadTreeStump: [{ id: 'broken-top', position: [0.06, 0.88, 0.12] }],
};

export function isBirdTreeBlockName(blockName: string) {
    return Object.hasOwn(birdTreeLandingPointsByBlockName, blockName);
}

export function getBirdTreeVisualPerchYOffset(blockName: string) {
    return (
        birdTreeLandingPointsByBlockName[blockName]?.[0]?.position[1] ?? null
    );
}

function rotateTreeOffset(
    position: readonly [number, number, number],
    rotation: number,
) {
    const yaw = rotation * (Math.PI / 2);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const [x, y, z] = position;

    return new Vector3(x * cos + z * sin, y, -x * sin + z * cos);
}

function facingYawFromOffset(offset: Vector3) {
    if (Math.hypot(offset.x, offset.z) <= 0.001) {
        return undefined;
    }

    return Math.atan2(offset.x, offset.z);
}

export function createBirdTreeLandingTargets({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const landingPoints = birdTreeLandingPointsByBlockName[block.name] ?? [];
    const baseY = getStackHeight(blockData, stack, block);

    return landingPoints.map((landingPoint) => {
        const offset = rotateTreeOffset(landingPoint.position, block.rotation);
        return {
            blockId: block.id,
            facingYaw: facingYawFromOffset(offset),
            id: `${block.id}-${landingPoint.id}`,
            position: new Vector3(
                stack.position.x + offset.x,
                baseY + offset.y,
                stack.position.z + offset.z,
            ),
        };
    });
}
