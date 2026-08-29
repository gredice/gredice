import type { PublicGardenDetail } from '@gredice/game';

export type LandingGardenSource = 'featured' | 'owned';

export type LandingGardenOwner = {
    avatarUrl: string | null;
    displayName: string;
};

export type LandingGardenCandidate = {
    garden: PublicGardenDetail;
    owner: LandingGardenOwner | null;
};

export type LandingGarden = LandingGardenCandidate & {
    source: LandingGardenSource;
};

export function orderLandingGardens(
    ownedGardens: LandingGardenCandidate[],
    featuredGardens: LandingGardenCandidate[],
): LandingGarden[] {
    const seenGardenIds = new Set<number>();
    const appendUniqueGardens = (
        candidates: LandingGardenCandidate[],
        source: LandingGardenSource,
    ) =>
        candidates.flatMap((candidate) => {
            if (seenGardenIds.has(candidate.garden.id)) {
                return [];
            }

            seenGardenIds.add(candidate.garden.id);
            return [{ ...candidate, source }];
        });

    return [
        ...appendUniqueGardens(ownedGardens, 'owned'),
        ...appendUniqueGardens(featuredGardens, 'featured'),
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
