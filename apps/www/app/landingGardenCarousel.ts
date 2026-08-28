import type { PublicGardenDetail } from '@gredice/game';

export type LandingGardenSource = 'featured' | 'owned';

export type LandingGarden = {
    garden: PublicGardenDetail;
    source: LandingGardenSource;
};

export function orderLandingGardens(
    ownedGardens: PublicGardenDetail[],
    featuredGardens: PublicGardenDetail[],
): LandingGarden[] {
    const ownedGardenIds = new Set(ownedGardens.map((garden) => garden.id));

    return [
        ...ownedGardens.map((garden) => ({
            garden,
            source: 'owned' as const,
        })),
        ...featuredGardens
            .filter((garden) => !ownedGardenIds.has(garden.id))
            .map((garden) => ({
                garden,
                source: 'featured' as const,
            })),
    ];
}

export function getAdjacentLandingGardenIndex(
    currentIndex: number,
    gardenCount: number,
    direction: -1 | 1,
) {
    if (gardenCount < 1) {
        return -1;
    }

    return (currentIndex + direction + gardenCount) % gardenCount;
}
