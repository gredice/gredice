import { clientPublic } from '@gredice/client';
import 'server-only';
import {
    type LandingFeaturedGarden,
    landingFeaturedGardenLimit,
} from './landingGardenCarousel';

const landingFeaturedGardensListTimeoutMs = 3_000;

const playwrightFeaturedGardensFixture: LandingFeaturedGarden[] = [
    {
        garden: {
            id: 99_999,
            name: 'Istaknuti testni vrt',
        },
        owner: {
            avatarUrl: null,
            displayName: 'Testni vrtlar',
        },
    },
];

export async function getLandingFeaturedGardens(): Promise<
    LandingFeaturedGarden[]
> {
    if (process.env.GREDICE_PLAYWRIGHT_FEATURED_GARDENS_FIXTURE === 'true') {
        return playwrightFeaturedGardensFixture;
    }

    const startedAt = Date.now();
    const traceId = crypto.randomUUID();
    const listSignal = AbortSignal.timeout(landingFeaturedGardensListTimeoutMs);
    let listPhase = 'headers';
    let listHeadersMs: number | undefined;
    let apiTiming: string | null = null;
    let apiRequestId: string | null = null;
    let apiCacheStatus: string | null = null;
    try {
        const response =
            await clientPublic().api.gardens.public.featured.summaries.$get(
                undefined,
                {
                    init: {
                        signal: listSignal,
                        cache: 'no-store',
                        headers: { 'x-gredice-featured-trace': traceId },
                    },
                },
            );
        listHeadersMs = Date.now() - startedAt;
        apiTiming = response.headers.get('server-timing');
        apiRequestId = response.headers.get('x-vercel-id');
        apiCacheStatus = response.headers.get('x-vercel-cache');
        if (!response.ok) {
            // Independent WWW/API deployments can briefly expose an older API.
            // Keep the landing fallback without restoring scene-detail fan-out.
            console.error('Failed to fetch featured gardens for landing', {
                status: response.status,
                elapsedMs: Date.now() - startedAt,
                listHeadersMs,
                apiTiming,
                apiRequestId,
                apiCacheStatus,
                traceId,
            });
            return [];
        }

        listPhase = 'body';
        const { items } = await response.json();
        const listDurationMs = Date.now() - startedAt;
        if (listDurationMs >= 2_500) {
            console.warn('Slow featured garden list for landing', {
                listDurationMs,
                listHeadersMs,
                listBodyMs: listDurationMs - listHeadersMs,
                apiTiming,
                apiRequestId,
                apiCacheStatus,
                traceId,
            });
        }
        listPhase = 'complete';
        return items.slice(0, landingFeaturedGardenLimit).map((item) => ({
            garden: { id: item.garden.id, name: item.garden.name },
            owner: item.owner
                ? {
                      publicId: item.owner.publicId,
                      displayName: item.owner.displayName,
                      avatarUrl: item.owner.avatarUrl,
                      achievementCount: item.owner.achievementCount,
                  }
                : null,
            dayPreviewImageUrl: item.dayPreviewImageUrl,
            nightPreviewImageUrl: item.nightPreviewImageUrl,
        }));
    } catch (error) {
        console.error('Failed to prepare featured gardens for landing', {
            error,
            elapsedMs: Date.now() - startedAt,
            listPhase,
            listHeadersMs,
            listBodyMs:
                listPhase === 'body' && listHeadersMs !== undefined
                    ? Date.now() - startedAt - listHeadersMs
                    : undefined,
            apiTiming,
            apiRequestId,
            apiCacheStatus,
            traceId,
            timedOut: listSignal.aborted,
        });
        return [];
    }
}
