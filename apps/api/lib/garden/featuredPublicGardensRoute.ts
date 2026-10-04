import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { publicSecurity } from '../docs/security';

const featuredTraceHeader = 'x-gredice-featured-trace';
const featuredTracePattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export function featuredPublicGardensRoute(
    getGardens: () => Promise<{ id: number }[]>,
) {
    return new Hono().get(
        '/public/featured',
        describeRoute({
            description:
                'Get up to ten current public garden IDs, ordered by likes, active plants and most recent update. Fetch public details to recheck visibility and load the garden and its members.',
            security: publicSecurity,
        }),
        async (context) => {
            const startedAt = performance.now();
            const requestedTraceId = context.req.header(featuredTraceHeader);
            const traceId =
                requestedTraceId && featuredTracePattern.test(requestedTraceId)
                    ? requestedTraceId
                    : null;
            if (traceId) {
                console.info('Featured garden list request started', {
                    traceId,
                });
            }
            try {
                const items = await getGardens();
                const durationMs = performance.now() - startedAt;
                if (traceId) {
                    console.info('Featured garden list request completed', {
                        traceId,
                        durationMs,
                    });
                }
                // Detail reads recheck visibility. Keep the list itself fresh.
                context.header('Cache-Control', 'no-store');
                context.header(
                    'Server-Timing',
                    `featured-list;dur=${durationMs.toFixed(1)}`,
                );
                return context.json({ items });
            } catch (error) {
                if (traceId) {
                    console.error('Featured garden list request failed', {
                        traceId,
                        durationMs: performance.now() - startedAt,
                        errorName:
                            error instanceof Error ? error.name : 'Unknown',
                    });
                }
                throw error;
            }
        },
    );
}
