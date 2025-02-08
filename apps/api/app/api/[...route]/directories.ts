import { Hono } from 'hono';
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { getEntitiesFormatted } from '@gredice/storage';
import { openApiDocs } from '@gredice/apidocs/openApiDocs';
import { ApiReference } from '@scalar/nextjs-api-reference';

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
        })
    .get('/docs', async (context) => context.json(await openApiDocs()))
    .get('/docs/ui', ApiReference({
        spec: {
            url: '/api/directories/docs'
        },
    }));

export default app;