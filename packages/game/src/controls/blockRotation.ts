const rotationLockedBlockNames = new Set([
    'Cow',
    'FishingBoat',
    'Horse',
    'Raised_Bed',
]);

export function canRotatePlacedBlock(blockName: string) {
    return !rotationLockedBlockNames.has(blockName);
}
