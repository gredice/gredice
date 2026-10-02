import type { BlockData } from '@gredice/client';
import { autumnBlanketBench } from '@gredice/js/autumnBlanketBench';
import { fallenLog } from '@gredice/js/fallenLog';
import { getGardenBlockSpan } from '@gredice/js/gardenBlocks';
import type { entityNameMap } from '../entities/entityNameMap';
import { isInternalSceneBlockData } from '../internalSceneBlockData';

type Placement = {
    id: string;
    entityName: keyof typeof entityNameMap;
    x: number;
    z: number;
    rotation: number;
    role: 'included' | 'scenery';
};

const scenery: Placement[] = [
    ...Array.from(
        { length: 16 },
        (_, index): Placement => ({
            id: `ground:${index}`,
            entityName: 'Block_Grass',
            x: index % 4,
            z: Math.floor(index / 4),
            rotation: 0,
            role: 'scenery',
        }),
    ),
    {
        id: 'tree',
        entityName: 'Tree',
        x: 2,
        z: 3,
        rotation: 0,
        role: 'scenery',
    },
    {
        id: 'pine',
        entityName: 'Pine',
        x: 3,
        z: 3,
        rotation: 0,
        role: 'scenery',
    },
    ...[0, 1, 2].map(
        (z): Placement => ({
            id: `path:${z}`,
            entityName: 'StoneWalkway',
            x: 2,
            z,
            rotation: 0,
            role: 'scenery',
        }),
    ),
];

function included(
    entityName: keyof typeof entityNameMap,
    x: number,
    z: number,
    rotation = 0,
): Placement {
    return { id: entityName, entityName, x, z, rotation, role: 'included' };
}

// Authored manual references. “Included” means part of the composition's item
// list, not a commercial bundle or inventory grant. Never place these automatically.
export const autumnArrangements = [
    {
        id: 'harvest-corner',
        collectionId: 'harvest',
        title: 'Kutak jesenske berbe',
        description:
            'Narančaste i krem bundeve uz sanduk s voćem i vedro strašilo.',
        preview: '/assets/arrangements/harvest-corner.png',
        placements: [
            included('HarvestPumpkinGroupOrange', 0, 1),
            included('HarvestPumpkinSquatCream', 0, 3),
            included('HarvestCrateOrchard', 1, 2),
            included('GardenScarecrow', 1, 3),
            ...scenery,
        ],
    },
    {
        id: 'woodland-path',
        collectionId: 'woodland',
        title: 'Staza uz šumski kutak',
        description:
            'Gljive, mahovinasto deblo i bakreno lišće uz kamenu stazu.',
        preview: '/assets/arrangements/woodland-path.png',
        placements: [
            included('WoodlandMushrooms', 0, 1),
            included('StoneMedium', 0, 2),
            included('AutumnLeafPileCrescent', 1, 2),
            included('FallenLog', 0, 3),
            ...scenery,
        ],
    },
    {
        id: 'evening-seat',
        collectionId: 'evening',
        title: 'Mjesto za toplu večer',
        description:
            'Klupa s dekom, čaj i ljubičasti asteri pod vrtnom lampom.',
        preview: '/assets/arrangements/evening-seat.png',
        placements: [
            included('AutumnBlanketBench', 0, 3),
            included('GardenTeaTable', 0, 1),
            included('EnamelGardenLamp', 0, 2),
            included('AutumnAsterPotMauve', 1, 1),
            ...scenery,
        ],
    },
];

export type AutumnArrangement = (typeof autumnArrangements)[number];

export function getAutumnArrangementItems(
    arrangement: AutumnArrangement,
    role: Placement['role'],
) {
    const counts = new Map<string, number>();
    for (const placement of arrangement.placements) {
        if (placement.role === role)
            counts.set(
                placement.entityName,
                (counts.get(placement.entityName) ?? 0) + 1,
            );
    }
    return Array.from(counts, ([entityName, quantity]) => ({
        entityName,
        quantity,
    }));
}

/** Caller supplies the published directory response, without internal fallback rows. */
export function getAvailableAutumnArrangements({
    blockData,
    isSandbox = false,
}: {
    blockData: BlockData[] | null | undefined;
    isSandbox?: boolean;
}) {
    const available = new Map(
        blockData
            ?.filter(
                (block) =>
                    isSandbox ||
                    (block.id > 0 && !isInternalSceneBlockData(block)),
            )
            .map((block) => [block.information.name, block]),
    );
    return autumnArrangements.filter((arrangement) =>
        arrangement.placements.every((placement) => {
            const block = available.get(placement.entityName);
            if (!block) return false;
            const expected = getGardenBlockSpan(
                placement.entityName === autumnBlanketBench.name
                    ? autumnBlanketBench
                    : placement.entityName === fallenLog.name
                      ? fallenLog
                      : undefined,
                placement.rotation,
            );
            const actual = getGardenBlockSpan(block, placement.rotation);
            if (
                actual.width !== expected.width ||
                actual.depth !== expected.depth
            )
                return false;
            const price = block.prices.sunflowers;
            return (
                isSandbox ||
                placement.role === 'scenery' ||
                (typeof price === 'number' &&
                    Number.isFinite(price) &&
                    price > 0)
            );
        }),
    );
}

/** Derive occupied cells and dimensions from the same catalogue spans as placement. */
export function getAutumnArrangementLayout(
    arrangement: AutumnArrangement,
    blockData: BlockData[],
) {
    const byName = new Map(
        blockData.map((block) => [block.information.name, block]),
    );
    const placements = arrangement.placements.map((placement) => {
        const block = byName.get(placement.entityName);
        if (!block)
            throw new Error(
                `Missing arrangement block: ${placement.entityName}`,
            );
        const span = getGardenBlockSpan(block, placement.rotation);
        return {
            ...placement,
            ...span,
            cells: Array.from(
                { length: span.width * span.depth },
                (_, index) => ({
                    x: placement.x + (index % span.width),
                    z: placement.z + Math.floor(index / span.width),
                }),
            ),
        };
    });
    function bounds(role?: Placement['role']) {
        const cells = placements
            .filter((placement) => !role || placement.role === role)
            .flatMap((placement) => placement.cells);
        const x = Math.min(...cells.map((cell) => cell.x));
        const z = Math.min(...cells.map((cell) => cell.z));
        return {
            x,
            z,
            width: Math.max(...cells.map((cell) => cell.x)) - x + 1,
            depth: Math.max(...cells.map((cell) => cell.z)) - z + 1,
            occupiedCells: new Set(cells.map((cell) => `${cell.x}:${cell.z}`))
                .size,
        };
    }
    return { placements, garden: bounds(), decoration: bounds('included') };
}
