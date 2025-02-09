import { Hono } from 'hono';
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { getEntitiesFormatted } from '@gredice/storage';

const app = new Hono()
    .get(
        '/entities/:entityType',
        zValidator(
            "param",
            z.object({
                entityType: z.string(),
            })
        ),
        async (context) => {
            const { entityType } = context.req.valid('param');
            const entities = await getEntitiesFormatted(entityType);
            return context.json(entities);
        });

export default app;