const terrainHalfSize = 0.5;

function clampUnit(value: number) {
    return Math.max(0, Math.min(1, value));
}

/**
 * Returns the normalized surface height for the garden's wedge-shaped terrain
 * blocks. A value of 0 is the low edge and 1 is the raised edge/corner.
 */
export function getSlopedGroundNormalizedHeight(
    blockName: string,
    localX: number,
    localZ: number,
) {
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
