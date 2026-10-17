import { clientPublic } from '@gredice/client';
import 'server-only';
import {
    type LandingFeaturedGarden,
    landingFeaturedGardenLimit,
} from './landingGardenCarousel';

const landingFeaturedGardensListTimeoutMs = 3_000;

function featuredResponseDiagnostics(traceId: string, response?: Response) {
    const contentType = response?.headers
        .get('content-type')
        ?.split(';')[0]
        ?.trim()
        .toLowerCase();
    const errorCode = response?.headers.get('x-vercel-error');
    const mitigation = response?.headers.get('x-vercel-mitigated');
    return {
        apiTiming: response?.headers.get('server-timing') ?? null,
        apiRequestId: response?.headers.get('x-vercel-id') ?? null,
        apiCacheStatus: response?.headers.get('x-vercel-cache') ?? null,
        apiContentType: contentType
            ? ['application/json', 'text/html', 'text/plain'].includes(
                  contentType,
              )
                ? contentType
                : 'other'
            : null,
        apiErrorCode:
            errorCode && /^[A-Z][A-Z0-9_]{0,99}$/u.test(errorCode)
                ? errorCode
                : null,
        apiMitigation:
            mitigation === 'challenge' || mitigation === 'deny'
                ? mitigation
                : null,
        apiTraceMatched:
            response?.headers.get('x-gredice-featured-trace') === traceId,
        apiRedirected: response?.redirected ?? false,
    };
}

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
    let apiHost: string | undefined;
    let apiDiagnostics = featuredResponseDiagnostics(traceId);
    try {
        const summaries = clientPublic().api.gardens.public.featured.summaries;
        apiHost = summaries.$url().hostname;
        const response = await summaries.$get(undefined, {
            init: {
                signal: listSignal,
                cache: 'no-store',
                headers: { 'x-gredice-featured-trace': traceId },
            },
        });
        listHeadersMs = Date.now() - startedAt;
        apiDiagnostics = featuredResponseDiagnostics(traceId, response);
        if (!response.ok) {
            // A status alone cannot identify an application, deployment
            // protection or edge rejection. Keep bounded metadata for
            // correlation; never log response bodies, cookies or bypass tokens.
            console.error('Failed to fetch featured gardens for landing', {
                status: response.status,
                elapsedMs: Date.now() - startedAt,
                listHeadersMs,
                apiHost,
                ...apiDiagnostics,
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
                apiHost,
                ...apiDiagnostics,
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
            apiHost,
            ...apiDiagnostics,
            traceId,
            timedOut: listSignal.aborted,
        });
        return [];
    }
}
