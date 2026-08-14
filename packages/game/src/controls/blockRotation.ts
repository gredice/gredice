const rotationLockedBlockNames = new Set(['FishingBoat', 'Raised_Bed']);

export function canRotatePlacedBlock(blockName: string) {
    return !rotationLockedBlockNames.has(blockName);
}
