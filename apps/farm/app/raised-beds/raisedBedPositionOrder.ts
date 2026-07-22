export function getRaisedBedPositionIndexesDescending(
    positionIndexes: number[],
) {
    const highestPositionIndex = Math.max(8, ...positionIndexes);

    return Array.from(
        { length: highestPositionIndex + 1 },
        (_, displayIndex) => highestPositionIndex - displayIndex,
    );
}
