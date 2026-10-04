import type { getFeaturedPublicGardenSummaries } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { publicSecurity } from '../docs/security';

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
            const items = await getSummaries();
            // Shared caching belongs to the ranking/count read model. Do not
            // cache this visibility-checked response at a browser/CDN layer.
            context.header('Cache-Control', 'no-store');
            context.header(
                'Server-Timing',
                `featured-summaries;dur=${(performance.now() - startedAt).toFixed(1)}`,
            );
            return context.json({ items });
        },
    );
}
