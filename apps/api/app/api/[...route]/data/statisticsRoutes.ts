import { getEntitiesCount, getPlantPlaceEventsCount } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';

const app = new Hono().get(
    '/plants',
    describeRoute({
        description: 'Get plants statistics',
        responses: {
            200: {
                description: 'Successful response',
            },
        },
    }),
    async (context) => {
        try {
            // Get counts for published plants, plant sorts, and planted plants
            const [plantsCount, plantSortsCount, plantPlaceCount] =
                await Promise.all([
                    getEntitiesCount('plant', 'published'),
                    getEntitiesCount('plantSort', 'published'),
                    getPlantPlaceEventsCount(),
                ]);

            return context.json({
                totalPlants: plantsCount,
                totalPlantSorts: plantSortsCount,
                totalPlantedPlants: plantPlaceCount,
            });
        } catch (error) {
            console.error('Error fetching plant statistics:', error);
            return context.json(
                { error: 'Failed to fetch plant statistics' },
                { status: 500 },
            );
        }
    },
);

export default app;
