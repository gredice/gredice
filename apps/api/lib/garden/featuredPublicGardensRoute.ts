import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { publicSecurity } from '../docs/security';

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
            const items = await getGardens();
            // Visibility changes must not wait for a cached list to expire.
            context.header('Cache-Control', 'no-store');
            context.header(
                'Server-Timing',
                `featured-list;dur=${(performance.now() - startedAt).toFixed(1)}`,
            );
            return context.json({ items });
        },
    );
}
