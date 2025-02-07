import { Hono } from 'hono';
import { withAuth } from '../../../lib/auth/auth';
import { getAccountGardens, getGarden } from '@gredice/storage';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono()
    .get(
        '/',
        async (context) => await withAuth(
            ['user', 'admin'],
            async (user) => {
                const gardens = await getAccountGardens(user.accountId);
                return context.json(gardens.map(garden => ({
                    id: garden.id,
                    name: garden.name,
                    createdAt: garden.createdAt,
                })));
            }))
    .get(
        '/:gardenId',
        zValidator(
            "param",
            z.object({
                gardenId: z.number(),
            })
        ),
        async (context) => await withAuth(
            ['user', 'admin'],
            async () => {
                const { gardenId } = context.req.valid('param');
                const garden = await getGarden(gardenId);
                if (!garden) {
                    return context.notFound();
                }

                return context.json({
                    id: garden.id,
                    name: garden.name,
                    latitude: garden.farm.latitude,
                    longitude: garden.farm.longitude,
                    createdAt: garden.createdAt
                });
            }));

export default app;