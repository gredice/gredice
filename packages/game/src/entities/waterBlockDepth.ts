import type { BlockData } from '@gredice/client';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import {
    getBlockDataByName,
    getStackHeight,
    isEdgeOrCornerTerrainBlockName,
} from '../utils/stackHeightCore';
import { waterBlockName } from './waterBlockFoam';
import {
    defaultWaterBlockVisualHeight,
    waterBlockBottomOverlap,
} from './waterBlockGeometry';
import { getWaterBlockVerticalRange } from './waterBlockHeight';

export type WaterBlockDepthSamples = [number, number, number, number];

const waterDepthSamplePositions = [
    [-0.5, -0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
    [0.5, -0.5],
] as const;

function getWaterBlockColumnBounds({
    block,
    stack,
}: {
    block: Block;
    stack: Stack;
}) {
    if (block.name !== waterBlockName) {
        return null;
    }

    const waterBlockIndex = stack.blocks.indexOf(block);

    if (waterBlockIndex < 0) {
        return null;
    }

    let bottomIndex = waterBlockIndex;
    let topIndex = waterBlockIndex;

    while (stack.blocks[bottomIndex - 1]?.name === waterBlockName) {
        bottomIndex -= 1;
    }

    while (stack.blocks[topIndex + 1]?.name === waterBlockName) {
        topIndex += 1;
    }

    return { bottomIndex, topIndex };
}

function clamp01(value: number) {
    return Math.min(Math.max(value, 0), 1);
}

function rotateLocalPointIntoBlockSpace({
    localX,
    localZ,
    rotation,
}: {
    localX: number;
    localZ: number;
    rotation: number | undefined;
}) {
    const angle = -(((Math.round(rotation ?? 0) % 4) + 4) % 4) * (Math.PI / 2);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return {
        x: localX * cos + localZ * sin,
        z: -localX * sin + localZ * cos,
    };
}

function getShapedTerrainSurfaceRatio({
    block,
    localX,
    localZ,
}: {
    block: Block;
    localX: number;
    localZ: number;
}) {
    const rotated = rotateLocalPointIntoBlockSpace({
        localX,
        localZ,
        rotation: block.rotation,
    });
    const x = clamp01(rotated.x + 0.5);
    const z = clamp01(rotated.z + 0.5);

    if (block.name.endsWith('_Reverse_Corner')) {
        return Math.max(x, z);
    }

    if (block.name.endsWith('_Corner')) {
        return Math.min(x, z);
    }

    if (block.name.endsWith('_Angle')) {
        return x;
    }

    return 1;
}

function getWaterColumnBottomSurfaceY({
    block,
    blockData,
    localX,
    localZ,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    localX: number;
    localZ: number;
    stack: Stack;
}) {
    const bounds = getWaterBlockColumnBounds({ block, stack });
    if (!bounds) {
        return 0;
    }

    const supportBlock = stack.blocks[bounds.bottomIndex - 1];
    if (!supportBlock) {
        return 0;
    }

    const supportBaseY = getStackHeight(blockData, stack, supportBlock);
    const supportHeight =
        getBlockDataByName(blockData, supportBlock.name)?.attributes.height ??
        defaultWaterBlockVisualHeight;

    if (!isEdgeOrCornerTerrainBlockName(supportBlock.name)) {
        return supportBaseY + supportHeight;
    }

    return (
        supportBaseY +
        supportHeight *
            getShapedTerrainSurfaceRatio({
                block: supportBlock,
                localX,
                localZ,
            })
    );
}

export function getWaterBlockColumnDepth({
    block,
    stack,
}: {
    block: Block;
    stack: Stack;
}) {
    if (block.name !== waterBlockName) {
        return 0;
    }

    const bounds = getWaterBlockColumnBounds({ block, stack });

    if (!bounds) {
        return 1;
    }

    return bounds.topIndex - bounds.bottomIndex + 1;
}

export function getWaterBlockColumnSurfaceY({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}) {
    const bounds = getWaterBlockColumnBounds({ block, stack });
    const topWaterBlock =
        bounds === null ? block : stack.blocks[bounds.topIndex];

    if (!topWaterBlock) {
        return 0;
    }

    return (
        getWaterBlockVerticalRange({
            block: topWaterBlock,
            blockData,
            stack,
        })?.max ?? 0
    );
}

export function getWaterBlockDepthAtLocalPosition({
    block,
    blockData,
    localX,
    localZ,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    localX: number;
    localZ: number;
    stack: Stack;
}) {
    const surfaceY = getWaterBlockColumnSurfaceY({
        block,
        blockData,
        stack,
    });
    const bottomSurfaceY = getWaterColumnBottomSurfaceY({
        block,
        blockData,
        localX,
        localZ,
        stack,
    });

    return Math.max(
        (surfaceY - bottomSurfaceY + waterBlockBottomOverlap) /
            defaultWaterBlockVisualHeight,
        0,
    );
}

export function getWaterBlockDepthSamples({
    block,
    blockData,
    stack,
}: {
    block: Block;
    blockData: BlockData[] | null | undefined;
    stack: Stack;
}): WaterBlockDepthSamples {
    return waterDepthSamplePositions.map(([localX, localZ]) =>
        getWaterBlockDepthAtLocalPosition({
            block,
            blockData,
            localX,
            localZ,
            stack,
        }),
    ) as WaterBlockDepthSamples;
}
