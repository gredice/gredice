const rotationLockedBlockNames = new Set([
    'FishingBoat',
    'Horse',
    'Raised_Bed',
]);

export function canRotatePlacedBlock(blockName: string) {
    return !rotationLockedBlockNames.has(blockName);
}
