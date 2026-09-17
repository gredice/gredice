import { clientPublic } from '@gredice/client';
import 'server-only';
import {
    type LandingGardenCandidate,
    landingFeaturedGardenLimit,
} from './landingGardenCarousel';
import { comparePublicGardensByPopularity } from './vrtovi/publicGardenFormatting';

const landingFeaturedGardensListTimeoutMs = 3_000;
const landingFeaturedGardenDetailsTimeoutMs = 5_000;

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

    const startedAt = Date.now();
    try {
        const listSignal = AbortSignal.timeout(
            landingFeaturedGardensListTimeoutMs,
        );
        const response = await clientPublic().api.gardens.public.$get(
            undefined,
            { init: { signal: listSignal } },
        );
        if (!response.ok) {
            console.error('Failed to fetch featured gardens for landing', {
                status: response.status,
                elapsedMs: Date.now() - startedAt,
            });
            return [];
        }

        const publicGardens = await response.json();
        const listDurationMs = Date.now() - startedAt;
        const featuredGardenSummaries = publicGardens.items
            .toSorted(comparePublicGardensByPopularity)
            .slice(0, landingFeaturedGardenLimit);
        // Keep the detail fan-out bounded without allowing a slow list to
        // consume the time needed to prepare otherwise healthy gardens.
        const detailSignal = AbortSignal.timeout(
            landingFeaturedGardenDetailsTimeoutMs,
        );
        const featuredGardens = await Promise.all(
            featuredGardenSummaries.map(async (garden) => {
                const detailStartedAt = Date.now();
                try {
                    const gardenResponse = await clientPublic().api.gardens[
                        ':gardenId'
                    ].public.$get(
                        {
                            param: { gardenId: garden.id.toString() },
                        },
                        { init: { signal: detailSignal } },
                    );

                    if (!gardenResponse.ok) {
                        console.warn(
                            'Failed to fetch featured garden details',
                            {
                                gardenId: garden.id,
                                status: gardenResponse.status,
                                listDurationMs,
                                detailDurationMs: Date.now() - detailStartedAt,
                            },
                        );
                        return null;
                    }

                    return {
                        garden: await gardenResponse.json(),
                        owner: garden.owner ?? null,
                    };
                } catch (error) {
                    // A failed fetch or body read must not discard gardens
                    // that completed within the detail deadline.
                    console.warn('Failed to prepare featured garden details', {
                        gardenId: garden.id,
                        error,
                        listDurationMs,
                        detailDurationMs: Date.now() - detailStartedAt,
                        elapsedMs: Date.now() - startedAt,
                        timedOut: detailSignal.aborted,
                    });
                    return null;
                }
            }),
        );

        return featuredGardens.filter((garden) => garden !== null);
    } catch (error) {
        console.error('Failed to prepare featured gardens for landing', {
            error,
            elapsedMs: Date.now() - startedAt,
        });
        return [];
    }
}
