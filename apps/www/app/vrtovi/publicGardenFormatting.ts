import type { PublicGardenResponse } from '@gredice/client';
import {
    type GardenBlockDataLike,
    getGardenBlockFootprintOffsets,
} from '@gredice/js/gardenBlocks';

const gardenDateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Zagreb',
});

const gardenNumberFormatter = new Intl.NumberFormat('hr-HR');

export type PublicGardenStatsBlockData = GardenBlockDataLike & {
    information: {
        name: string;
    };
    prices?: {
        sunflowers?: number | null;
    } | null;
};

export type PublicGardenStats = {
    areaSquareMeters: number;
    blockCount: number;
    totalSunflowerPrice: number | null;
};

export function countActivePlantsFromPublicGarden(
    garden: PublicGardenResponse,
) {
    return garden.raisedBeds.reduce(
        (total, raisedBed) =>
            total +
            raisedBed.fields.filter(
                (field) =>
                    field.active && typeof field.plantSortId === 'number',
            ).length,
        0,
    );
}

function createBlockDataByName(
    blockData: PublicGardenStatsBlockData[] | null | undefined,
) {
    const blockDataByName = new Map<string, PublicGardenStatsBlockData>();
    for (const block of blockData ?? []) {
        blockDataByName.set(block.information.name, block);
    }
    return blockDataByName;
}

function gardenStatCellKey(x: number, y: number) {
    return `${x.toString()}|${y.toString()}`;
}

function toGardenGridCoordinate(value: string) {
    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? coordinate : null;
}

export function calculatePublicGardenStackStats(
    stacks: PublicGardenResponse['stacks'],
    blockData?: PublicGardenStatsBlockData[] | null,
): PublicGardenStats {
    const blockDataByName = createBlockDataByName(blockData);
    const hasPriceData = Boolean(blockData);
    const occupiedCells = new Set<string>();
    let blockCount = 0;
    let totalSunflowerPrice = 0;

    for (const [rawX, rows] of Object.entries(stacks)) {
        const x = toGardenGridCoordinate(rawX);
        if (x === null) {
            continue;
        }

        for (const [rawY, blocks] of Object.entries(rows)) {
            const y = toGardenGridCoordinate(rawY);
            if (y === null) {
                continue;
            }

            for (const block of blocks) {
                blockCount += 1;

                const currentBlockData = blockDataByName.get(block.name);
                for (const offset of getGardenBlockFootprintOffsets(
                    currentBlockData,
                    block.rotation ?? 0,
                )) {
                    occupiedCells.add(
                        gardenStatCellKey(x + offset.x, y + offset.y),
                    );
                }

                const sunflowerPrice = currentBlockData?.prices?.sunflowers;
                if (
                    hasPriceData &&
                    typeof sunflowerPrice === 'number' &&
                    Number.isFinite(sunflowerPrice)
                ) {
                    totalSunflowerPrice += sunflowerPrice;
                }
            }
        }
    }

    return {
        areaSquareMeters: occupiedCells.size,
        blockCount,
        totalSunflowerPrice: hasPriceData ? totalSunflowerPrice : null,
    };
}

export function calculatePublicGardenStats(
    garden: PublicGardenResponse,
    blockData?: PublicGardenStatsBlockData[] | null,
) {
    return calculatePublicGardenStackStats(garden.stacks, blockData);
}

function isFiniteGardenNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function formatGardenDate(value: Date | string) {
    return gardenDateFormatter.format(new Date(value));
}

export function formatGardenNumber(value: unknown) {
    if (!isFiniteGardenNumber(value)) {
        return '—';
    }

    return gardenNumberFormatter.format(value);
}

export function formatGardenAreaSquareMeters(value: unknown) {
    if (!isFiniteGardenNumber(value)) {
        return '—';
    }

    return `${gardenNumberFormatter.format(value)} m²`;
}

export function formatGardenSunflowerPrice(value: unknown) {
    if (!isFiniteGardenNumber(value)) {
        return '—';
    }

    return `${gardenNumberFormatter.format(value)} 🌻`;
}
