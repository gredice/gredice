import {
    isTerrainCornerStairBlockName,
    isTerrainStraightStairBlockName,
} from './terrainStairs';

const terrainHalfSize = 0.5;

function clampUnit(value: number) {
    return Math.max(0, Math.min(1, value));
}

/**
 * Returns the normalized surface height for shaped garden terrain. A value of
 * 0 is the base plane and 1 is the raised edge, corner, or top stair.
 */
export function getSlopedGroundNormalizedHeight(
    blockName: string,
    localX: number,
    localZ: number,
) {
    if (isTerrainStraightStairBlockName(blockName)) {
        return localX < 0 ? 0.5 : 1;
    }

    if (isTerrainCornerStairBlockName(blockName)) {
        return localX >= 0 && localZ <= 0 ? 1 : 0.5;
    }

    if (blockName.endsWith('_Reverse_Corner')) {
        return clampUnit(Math.max(localX, localZ) + terrainHalfSize);
    }

    if (blockName.endsWith('_Corner')) {
        return clampUnit(Math.min(localX, localZ) + terrainHalfSize);
    }

    if (blockName.endsWith('_Angle')) {
        return clampUnit(localX + terrainHalfSize);
    }

    return null;
}
