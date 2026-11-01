export function resolveMatrixProfileSize(value: string | undefined) {
    return value === '8' ? 8 : value === '64' ? 64 : undefined;
}

export function createMatrixProfileStacks(size: 8 | 64) {
    const models = [
        'FenceGate',
        'AutumnFenceGate',
        'WoodenWalkway',
        'Bucket',
        'BeachChair',
    ];
    return Array.from({ length: size * size }, (_, index) => ({
        x: index % size,
        y: Math.floor(index / size),
        blocks: [
            { id: `matrix-ground-${index}`, name: 'Block_Grass', rotation: 0 },
            {
                id: `matrix-stone-${index}`,
                name: models[index % models.length],
                rotation: index % 4,
            },
        ],
    }));
}
