export function resolveMatrixProfileSize(value: string | undefined) {
    return value === '8' ? 8 : value === '64' ? 64 : undefined;
}

export function createMatrixProfileStacks(size: 8 | 64) {
    // Both use the existing rigid instance path and compatible static planks.
    const models = ['GardenBox', 'Stool'];
    return Array.from({ length: size * size }, (_, index) => ({
        x: index % size,
        y: Math.floor(index / size),
        blocks: [
            { id: `matrix-ground-${index}`, name: 'Block_Grass', rotation: 0 },
            {
                id: `matrix-prop-${index}`,
                name: models[index % models.length],
                rotation: index % 4,
            },
        ],
    }));
}
