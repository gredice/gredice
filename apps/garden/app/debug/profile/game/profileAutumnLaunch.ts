import { autumnArrangements } from '@gredice/js/autumnArrangements';

/** First-wave A/B render identities; this fixture is never a product catalogue. */
export const autumnLaunchFirstWaveNames = [
    ...['Squat', 'Gourd', 'Group'].flatMap((shape) =>
        ['Orange', 'Cream', 'Green'].map(
            (color) => `HarvestPumpkin${shape}${color}`,
        ),
    ),
    'GardenScarecrow',
    'HarvestCrate',
    'HarvestCrateOrchard',
    'HarvestWheelbarrow',
    'AutumnAsterPotMauve',
    'AutumnAsterPotCream',
    'AutumnAsterPotGold',
    'AutumnShrub',
    'WoodlandMushrooms',
    'FallenLog',
    'AutumnLeafPileMound',
    'AutumnLeafPileCrescent',
    'LeafRake',
    'AutumnBlanketBench',
    'GardenTeaTable',
];
export function resolveAutumnLaunchSize(value: string | undefined) {
    return value === 'small' || value === 'medium' || value === 'dense'
        ? value
        : null;
}

/** Exact pack layouts plus the other first-wave props, repeated at bounded densities. */
export function createAutumnLaunchFixture(size: 'small' | 'medium' | 'dense') {
    const repetitions = size === 'small' ? 1 : size === 'medium' ? 3 : 9;
    const pilotNames = new Set<string>(
        autumnArrangements.flatMap((arrangement) =>
            arrangement.placements
                .filter((p) => p.role === 'included')
                .map((p) => p.entityName),
        ),
    );
    const otherNames = autumnLaunchFirstWaveNames.filter(
        (name) => !pilotNames.has(name),
    );
    // Always keep one full authored repeat at the standard camera origin.
    // Three repeats must not leave the camera in an empty fourth corner.
    const repeatCells = [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
    ];
    const stacks = new Map<
        string,
        {
            x: number;
            y: number;
            blocks: {
                id: string;
                name: string;
                rotation: number;
                variant: null;
            }[];
        }
    >();
    const names: Record<string, number> = {};
    const append = (
        x: number,
        y: number,
        name: string,
        id: string,
        rotation: number,
    ) => {
        const key = `${x}:${y}`;
        let stack = stacks.get(key);
        if (!stack) {
            stack = { x, y, blocks: [] };
            stacks.set(key, stack);
        }
        stack.blocks.push({ name, id, rotation, variant: null });
        names[name] = (names[name] ?? 0) + 1;
    };
    for (let repeat = 0; repeat < repetitions; repeat++) {
        const cell = repeatCells[repeat];
        if (!cell) throw new Error('Unbounded launch fixture repeat');
        const offsetX = cell[0] * 16 - 6;
        const offsetY = cell[1] * 20 - 8;
        for (const [index, arrangement] of autumnArrangements.entries()) {
            for (const placement of arrangement.placements) {
                append(
                    offsetX + index * 4 + placement.x,
                    offsetY + placement.z,
                    placement.entityName,
                    `launch:${repeat}:${arrangement.id}:${placement.id}`,
                    placement.rotation,
                );
            }
        }
        for (const [index, name] of otherNames.entries()) {
            const x = offsetX + (index % 4) * 3;
            const y = offsetY + 6 + Math.floor(index / 4) * 3;
            const width = name === 'HarvestWheelbarrow' ? 2 : 1;
            for (let cell = 0; cell < width; cell++) {
                append(
                    x + cell,
                    y,
                    'Block_Grass',
                    `launch:${repeat}:extra-ground:${index}:${cell}`,
                    0,
                );
            }
            append(x, y, name, `launch:${repeat}:extra:${name}`, 0);
        }
    }
    return {
        stacks: [...stacks.values()].map((stack) => ({
            ...stack,
            blocks: stack.blocks.toSorted(
                (a, b) =>
                    Number(b.name === 'Block_Grass') -
                    Number(a.name === 'Block_Grass'),
            ),
        })),
        stats: {
            schemaVersion: 1,
            scope: 'A/B first-wave 24 + pilot legacy extras StoneMedium/EnamelGardenLamp',
            size,
            repetitions,
            firstWaveIdentityCount: autumnLaunchFirstWaveNames.length,
            firstWavePropCount: autumnLaunchFirstWaveNames.length * repetitions,
            pilotIncludedPropCount: 12 * repetitions,
            legacyExtraPropCount: 2 * repetitions,
            stackCount: stacks.size,
            blockCount: Object.values(names).reduce((a, b) => a + b, 0),
            blockCountsByName: Object.fromEntries(
                Object.entries(names).sort(([a], [b]) => a.localeCompare(b)),
            ),
            reducedMotionCoverage:
                'Scenario media preference; not a separate renderer implementation',
        },
    };
}
