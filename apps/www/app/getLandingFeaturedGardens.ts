import { clientPublic } from '@gredice/client';
import 'server-only';
import {
    type LandingGardenCandidate,
    landingFeaturedGardenLimit,
} from './landingGardenCarousel';
import { comparePublicGardensByPopularity } from './vrtovi/publicGardenFormatting';

const landingFeaturedGardensTimeoutMs = 5_000;

const playwrightFeaturedGardensFixture: LandingGardenCandidate[] = [
    {
        garden: {
            backgroundPalette: 'current',
            farmId: 1,
            homeCamera: null,
            id: 99_999,
            isPublic: true,
            isSandbox: false,
            latitude: 45.815,
            longitude: 15.982,
            name: 'Istaknuti testni vrt',
            raisedBeds: [],
            stacks: {},
            structures: [],
            updatedAt: '2026-08-29T12:00:00.000Z',
        },
        owner: {
            avatarUrl: null,
            displayName: 'Testni vrtlar',
        },
    },
];

export async function getLandingFeaturedGardens(): Promise<
    LandingGardenCandidate[]
> {
    if (process.env.GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE === 'true') {
        return playwrightFeaturedGardensFixture;
    }

    try {
        const signal = AbortSignal.timeout(landingFeaturedGardensTimeoutMs);
        const response = await clientPublic().api.gardens.public.$get(
            undefined,
            { init: { signal } },
        );
        if (!response.ok) {
            console.error('Failed to fetch featured gardens for landing', {
                status: response.status,
            });
            return [];
        }

        const publicGardens = await response.json();
        const featuredGardenSummaries = publicGardens.items
            .toSorted(comparePublicGardensByPopularity)
            .slice(0, landingFeaturedGardenLimit);
        const featuredGardens = await Promise.all(
            featuredGardenSummaries.map(async (garden) => {
                const gardenResponse = await clientPublic().api.gardens[
                    ':gardenId'
                ].public.$get(
                    {
                        param: { gardenId: garden.id.toString() },
                    },
                    { init: { signal } },
                );

                if (!gardenResponse.ok) {
                    console.error('Failed to fetch featured garden details', {
                        gardenId: garden.id,
                        status: gardenResponse.status,
                    });
                    return null;
                }

                return {
                    garden: await gardenResponse.json(),
                    owner: garden.owner ?? null,
                };
            }),
        );

        return featuredGardens.filter((garden) => garden !== null);
    } catch (error) {
        console.error('Failed to prepare featured gardens for landing', error);
        return [];
    }
}
