export const legacyStoneCornerStairsBlockName = 'Block_Stone_Stairs_Half';
export const stoneCornerStairsBlockName = 'Block_Stone_Stairs_Corner';

export const terrainStraightStairBlockNames = [
    'Block_Stone_Stairs',
    'Block_Polished_Stone_Stairs',
] as const;

export const terrainCornerStairBlockNames = [
    stoneCornerStairsBlockName,
    'Block_Polished_Stone_Stairs_Corner',
    legacyStoneCornerStairsBlockName,
] as const;

export function isTerrainStraightStairBlockName(blockName: string) {
    return terrainStraightStairBlockNames.some(
        (candidate) => candidate === blockName,
    );
}

export function isTerrainCornerStairBlockName(blockName: string) {
    return terrainCornerStairBlockNames.some(
        (candidate) => candidate === blockName,
    );
}

export function isTerrainStairBlockName(blockName: string) {
    return (
        isTerrainStraightStairBlockName(blockName) ||
        isTerrainCornerStairBlockName(blockName)
    );
}

export function resolveCurrentTerrainBlockName(blockName: string) {
    return blockName === legacyStoneCornerStairsBlockName
        ? stoneCornerStairsBlockName
        : blockName;
}
