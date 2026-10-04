import {
    type AdvancedSowingLayoutOption,
    getAdvancedSowingLayoutOptions,
} from '@gredice/js/plants';
import { slugify } from '@gredice/js/slug';

export type AdvancedSowingPlantSpacingEntry = {
    maxDistanceCm: number;
    minDistanceCm: number;
    name: string;
    optimalDistanceCm: number;
};

// A Gredice field is 30 x 30 cm. These values are the exact transitions for
// square-foot layouts: 36, 16, 9, 4, or 1 plant per field, followed by one
// plant across a 2 x 2 or 3 x 3 field footprint.
export const advancedSowingCanonicalDistancesCm = [
    5, 7.5, 10, 15, 30, 60, 90,
] as const;

/**
 * Square-foot spacing policy for every published plant in the catalogue.
 *
 * The standard values follow the Square Foot Gardening Foundation's common
 * 1/4/9/16 groups and UF/IFAS square-foot guidance. Bounds add a denser or
 * less-dense choice only where the plant's harvested size or growth habit can
 * reasonably support it. Larger crops use the square footprints supported by
 * the current 3-column raised-bed geometry.
 */
export const advancedSowingPlantSpacing = [
    {
        name: 'Paprika',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Mrkva',
        minDistanceCm: 5,
        optimalDistanceCm: 7.5,
        maxDistanceCm: 10,
    },
    {
        name: 'Patlidžan',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Rajčica',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Blitva',
        minDistanceCm: 10,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Luk',
        minDistanceCm: 7.5,
        optimalDistanceCm: 10,
        maxDistanceCm: 15,
    },
    {
        name: 'Peršin',
        minDistanceCm: 10,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Češnjak',
        minDistanceCm: 7.5,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Krastavac',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Tikvice',
        minDistanceCm: 30,
        optimalDistanceCm: 60,
        maxDistanceCm: 90,
    },
    {
        name: 'Mahuna',
        minDistanceCm: 7.5,
        optimalDistanceCm: 10,
        maxDistanceCm: 15,
    },
    {
        name: 'Grah',
        minDistanceCm: 7.5,
        optimalDistanceCm: 10,
        maxDistanceCm: 15,
    },
    {
        name: 'Kupus',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Kelj',
        minDistanceCm: 15,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Salata',
        minDistanceCm: 10,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Rukola',
        minDistanceCm: 7.5,
        optimalDistanceCm: 10,
        maxDistanceCm: 15,
    },
    {
        name: 'Rotkvica',
        minDistanceCm: 5,
        optimalDistanceCm: 7.5,
        maxDistanceCm: 10,
    },
    {
        name: 'Poriluk',
        minDistanceCm: 7.5,
        optimalDistanceCm: 10,
        maxDistanceCm: 15,
    },
    {
        name: 'Cvjetača',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Brokula',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Celer',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Cikla',
        minDistanceCm: 7.5,
        optimalDistanceCm: 10,
        maxDistanceCm: 15,
    },
    {
        name: 'Špinat',
        minDistanceCm: 7.5,
        optimalDistanceCm: 10,
        maxDistanceCm: 15,
    },
    {
        name: 'Komorač',
        minDistanceCm: 10,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Grašak',
        minDistanceCm: 7.5,
        optimalDistanceCm: 10,
        maxDistanceCm: 15,
    },
    {
        name: 'Luk vlasac',
        minDistanceCm: 10,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Koraba',
        minDistanceCm: 10,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Repa',
        minDistanceCm: 7.5,
        optimalDistanceCm: 10,
        maxDistanceCm: 15,
    },
    {
        name: 'Bosiljak',
        minDistanceCm: 15,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Matovilac',
        minDistanceCm: 5,
        optimalDistanceCm: 7.5,
        maxDistanceCm: 10,
    },
    {
        name: 'Bob',
        minDistanceCm: 10,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Raštika',
        minDistanceCm: 15,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Tikva',
        minDistanceCm: 30,
        optimalDistanceCm: 60,
        maxDistanceCm: 90,
    },
    {
        name: 'Bamija',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Dinja',
        minDistanceCm: 30,
        optimalDistanceCm: 60,
        maxDistanceCm: 90,
    },
    {
        name: 'Artičoka',
        minDistanceCm: 90,
        optimalDistanceCm: 90,
        maxDistanceCm: 90,
    },
    {
        name: 'Kopar',
        minDistanceCm: 15,
        optimalDistanceCm: 30,
        maxDistanceCm: 30,
    },
    {
        name: 'Ljupčac',
        minDistanceCm: 60,
        optimalDistanceCm: 90,
        maxDistanceCm: 90,
    },
    {
        name: 'Korijandar',
        minDistanceCm: 10,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Origano',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Timijan',
        minDistanceCm: 15,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Kamilica',
        minDistanceCm: 10,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
    {
        name: 'Čili',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Matičnjak',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Kadulja',
        minDistanceCm: 30,
        optimalDistanceCm: 30,
        maxDistanceCm: 60,
    },
    {
        name: 'Kelj pupčar',
        minDistanceCm: 30,
        optimalDistanceCm: 60,
        maxDistanceCm: 60,
    },
    {
        name: 'Jagoda',
        minDistanceCm: 15,
        optimalDistanceCm: 15,
        maxDistanceCm: 30,
    },
] satisfies AdvancedSowingPlantSpacingEntry[];

export function normalizeAdvancedSowingPlantName(value: string) {
    return slugify(value.trim());
}

function isCanonicalDistance(value: number) {
    return advancedSowingCanonicalDistancesCm.some(
        (distance) => distance === value,
    );
}

export function advancedSowingPlantSpacingByNormalizedName(
    entries: readonly AdvancedSowingPlantSpacingEntry[],
) {
    const result = new Map<string, AdvancedSowingPlantSpacingEntry>();

    for (const entry of entries) {
        const normalizedName = normalizeAdvancedSowingPlantName(entry.name);
        if (!normalizedName) {
            throw new Error('Advanced Sowing spacing contains an empty name.');
        }
        if (result.has(normalizedName)) {
            throw new Error(
                `Advanced Sowing spacing contains duplicate normalized name ${normalizedName}.`,
            );
        }
        for (const distance of [
            entry.minDistanceCm,
            entry.optimalDistanceCm,
            entry.maxDistanceCm,
        ]) {
            if (!isCanonicalDistance(distance)) {
                throw new Error(
                    `${entry.name} uses non-canonical distance ${distance.toString()} cm.`,
                );
            }
        }

        getAdvancedSowingLayoutOptions({
            maxDistanceCm: entry.maxDistanceCm,
            minDistanceCm: entry.minDistanceCm,
            optimalDistanceCm: entry.optimalDistanceCm,
        });
        result.set(normalizedName, entry);
    }

    return result;
}

export function getAdvancedSowingPlantSpacingOptions(
    entry: AdvancedSowingPlantSpacingEntry,
): AdvancedSowingLayoutOption[] {
    return getAdvancedSowingLayoutOptions({
        maxDistanceCm: entry.maxDistanceCm,
        minDistanceCm: entry.minDistanceCm,
        optimalDistanceCm: entry.optimalDistanceCm,
    });
}
