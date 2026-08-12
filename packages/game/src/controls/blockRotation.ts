const rotationLockedBlockNames = new Set(['FishingBoat']);

export function canRotatePlacedBlock(blockName: string) {
    return !rotationLockedBlockNames.has(blockName);
}
