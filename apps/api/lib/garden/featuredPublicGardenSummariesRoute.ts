import type { getFeaturedPublicGardenSummaries } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { publicSecurity } from '../docs/security';
import { parseFeaturedGardenTraceId } from './featuredGardenTrace';

export function featuredPublicGardenSummariesRoute(
    getSummaries: typeof getFeaturedPublicGardenSummaries,
) {
    return new Hono().get(
        '/public/featured/summaries',
        describeRoute({
            description:
                'Get up to ten featured public garden summaries, with public owner fields and current day/night preview URLs. Ranking and active-plant counts share a 30–60 minute cache; every response rechecks public visibility and current preview metadata. Full scenes are loaded separately when opened.',
            security: publicSecurity,
        }),
        async (context) => {
            const startedAt = performance.now();
            const traceId = parseFeaturedGardenTraceId(
                context.req.header('x-gredice-featured-trace'),
            );
            if (traceId) {
                context.header('x-gredice-featured-trace', traceId);
                console.info('Featured garden summaries request started', {
                    traceId,
                });
            }
            try {
                const items = await getSummaries();
                const durationMs = performance.now() - startedAt;
                if (traceId) {
                    console.info(
                        'Featured garden summaries request completed',
                        {
                            traceId,
                            durationMs,
                        },
                    );
                }
                // Shared caching belongs to the ranking/count read model. Do not
                // cache this visibility-checked response at a browser/CDN layer.
                context.header('Cache-Control', 'no-store');
                context.header(
                    'Server-Timing',
                    `featured-summaries;dur=${durationMs.toFixed(1)}`,
                );
                return context.json({ items });
            } catch (error) {
                if (traceId) {
                    console.error('Featured garden summaries request failed', {
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
