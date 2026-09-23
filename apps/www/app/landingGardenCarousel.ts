import type { PublicGardenDetail } from '@gredice/game';

export const landingFeaturedGardenLimit = 10;
export const landingGardenIndicatorLimit = 4;

export type LandingGardenSource = 'featured' | 'owned';

export type LandingGardenOwner = {
    publicId?: string;
    achievementCount?: number;
    avatarUrl: string | null;
    displayName: string;
};

export type LandingGardenCandidate = {
    garden: PublicGardenDetail;
    owner: LandingGardenOwner | null;
};

export type LandingFeaturedGarden = {
    garden: Pick<PublicGardenDetail, 'id' | 'name'>;
    owner: LandingGardenOwner | null;
    dayPreviewImageUrl?: string | null;
    nightPreviewImageUrl?: string | null;
};

export type LandingGarden =
    | (LandingGardenCandidate & { source: 'owned' })
    | (LandingFeaturedGarden & { source: 'featured' });

export function orderLandingGardens(
    ownedGardens: LandingGardenCandidate[],
    featuredGardens: LandingFeaturedGarden[],
): LandingGarden[] {
    const seenGardenIds = new Set<number>();
    const gardens: LandingGarden[] = [];
    for (const candidate of ownedGardens) {
        if (seenGardenIds.has(candidate.garden.id)) continue;
        seenGardenIds.add(candidate.garden.id);
        gardens.push({ ...candidate, source: 'owned' });
    }
    for (const candidate of featuredGardens) {
        if (seenGardenIds.has(candidate.garden.id)) continue;
        seenGardenIds.add(candidate.garden.id);
        gardens.push({ ...candidate, source: 'featured' });
    }
    return gardens;
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

export function getVisibleLandingGardenIndexes(
    currentIndex: number,
    gardenCount: number,
    maxVisible = landingGardenIndicatorLimit,
) {
    const visibleCount = Math.min(gardenCount, Math.max(0, maxVisible));
    if (visibleCount < 1) {
        return [];
    }

    const safeCurrentIndex = Math.min(
        Math.max(currentIndex, 0),
        gardenCount - 1,
    );
    const startIndex = Math.min(
        Math.max(safeCurrentIndex - 1, 0),
        gardenCount - visibleCount,
    );

    return Array.from(
        { length: visibleCount },
        (_, offset) => startIndex + offset,
    );
}
