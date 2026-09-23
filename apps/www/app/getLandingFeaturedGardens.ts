import { clientPublic } from '@gredice/client';
import 'server-only';
import {
    type LandingGardenCandidate,
    landingFeaturedGardenLimit,
} from './landingGardenCarousel';
import { comparePublicGardensByPopularity } from './vrtovi/publicGardenFormatting';

const landingFeaturedGardensListTimeoutMs = 3_000;
const landingFeaturedGardenDetailsTimeoutMs = 5_000;

async function fetchFeaturedGardenList(listSignal: AbortSignal) {
    const publicGardens = clientPublic().api.gardens.public;
    const response = await publicGardens.featured.$get(undefined, {
        init: { signal: listSignal, cache: 'no-store' },
    });
    // WWW and API can finish deploying independently. An older API has no
    // featured route; use its existing list without restarting the deadline.
    if ([404].includes(response.status)) {
        await response.body?.cancel();
        const fallback = await publicGardens.$get(undefined, {
            init: { signal: listSignal, cache: 'no-store' },
        });
        return {
            response: fallback,
            readItems: async () =>
                (await fallback.json()).items.toSorted(
                    comparePublicGardensByPopularity,
                ),
        };
    }
    return {
        response,
        readItems: async () => (await response.json()).items,
    };
}

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
    const listSignal = AbortSignal.timeout(landingFeaturedGardensListTimeoutMs);
    let listPhase = 'headers';
    let listHeadersMs: number | undefined;
    let listBodyMs: number | undefined;
    let apiTiming: string | null = null;
    let apiRequestId: string | null = null;
    try {
        const { response, readItems } =
            await fetchFeaturedGardenList(listSignal);
        listHeadersMs = Date.now() - startedAt;
        apiTiming = response.headers.get('server-timing');
        apiRequestId = response.headers.get('x-vercel-id');
        if (!response.ok) {
            console.error('Failed to fetch featured gardens for landing', {
                status: response.status,
                elapsedMs: Date.now() - startedAt,
                listHeadersMs,
                apiTiming,
                apiRequestId,
            });
            return [];
        }

        listPhase = 'body';
        const publicGardens = await readItems();
        const listDurationMs = Date.now() - startedAt;
        listBodyMs = listDurationMs - listHeadersMs;
        if (listDurationMs >= 2_500) {
            console.warn('Slow featured garden list for landing', {
                listDurationMs,
                listHeadersMs,
                listBodyMs,
                apiTiming,
                apiRequestId,
            });
        }
        listPhase = 'complete';
        const featuredGardenSummaries = publicGardens.slice(
            0,
            landingFeaturedGardenLimit,
        );
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
                        { init: { signal: detailSignal, cache: 'no-store' } },
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

                    const details = await gardenResponse.json();
                    return {
                        garden: details,
                        owner: details.members?.at(0) ?? null,
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
            listPhase,
            listHeadersMs,
            listBodyMs:
                listPhase === 'body' && listHeadersMs !== undefined
                    ? Date.now() - startedAt - listHeadersMs
                    : listBodyMs,
            apiTiming,
            apiRequestId,
            timedOut: listSignal.aborted,
        });
        return [];
    }
}
