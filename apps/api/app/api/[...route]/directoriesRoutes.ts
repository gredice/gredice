import {
    type EntityStandardized,
    getEntitiesFormatted,
    getEntityFormatted,
} from '@gredice/storage';
import { Hono } from 'hono';
import { validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    cacheControlPresets,
    setCacheControl,
} from '../../../lib/http/cacheControl';

const app = new Hono()
    .get(
        '/entities/:entityType',
        zValidator(
            'param',
            z.object({
                entityType: z.string(),
            }),
        ),
        async (context) => {
            const { entityType } = context.req.valid('param');
            const entities = await getEntitiesFormatted(entityType);
            setCacheControl(context, cacheControlPresets.directories);
            return context.json(entities);
        },
    )
    .get(
        '/entities/:entityType/:entityId',
        zValidator(
            'param',
            z.object({
                entityType: z.string(),
                entityId: z.string(),
            }),
        ),
        async (context) => {
            const { entityType, entityId } = context.req.valid('param');
            const entityIdNumber = parseInt(entityId, 10);
            if (Number.isNaN(entityIdNumber)) {
                return context.json(
                    { error: 'Invalid entityId' },
                    { status: 400 },
                );
            }
            const entity =
                await getEntityFormatted<EntityStandardized>(entityIdNumber);
            if (!entity || entity.entityType?.name !== entityType) {
                return context.json(
                    { error: 'Entity not found' },
                    { status: 404 },
                );
            }
            setCacheControl(context, cacheControlPresets.directories);
            return context.json(entity);
        },
    );

export default app;
