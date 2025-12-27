import {
    type EntityStandardized,
    getEntitiesFormatted,
    getInventory,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const app = new Hono<{ Variables: AuthVariables }>().get(
    '/',
    describeRoute({ description: 'Popis inventara za račun' }),
    authValidator(['user', 'admin']),
    async (context) => {
        const { accountId } = context.get('authContext');
        const inventory = await getInventory(accountId);

        const entityTypeNames = Array.from(
            new Set(inventory.map((item) => item.entityTypeName)),
        );
        const entitiesData = await Promise.all(
            entityTypeNames.map(getEntitiesFormatted<EntityStandardized>),
        );
        const entitiesByType = entityTypeNames.reduce(
            (acc, type, index) => {
                acc[type] = entitiesData[index] ?? [];
                return acc;
            },
            {} as Record<string, EntityStandardized[]>,
        );

        return context.json({
            items: inventory.map((item) => {
                const entity = (entitiesByType[item.entityTypeName] ?? []).find(
                    (entity) =>
                        (entity as { id?: string | number }).id?.toString() ===
                        item.entityId,
                );

                return {
                    ...item,
                    name:
                        entity?.information?.name ?? entity?.information?.label,
                    image: (entity as { image?: { cover?: { url?: string } } })
                        ?.image?.cover?.url,
                };
            }),
        });
    },
);

export default app;
