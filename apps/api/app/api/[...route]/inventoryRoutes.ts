import {
    type EntityStandardized,
    getEntitiesFormatted,
    getGarden,
    getGardenBlock,
    getGardenBoxBlocksForAccount,
    getGardenBoxInventory,
    getInventory,
    type InventoryItem,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import {
    gardenBoxBlockPlacementBodySchema,
    resolveGardenBoxBlockPlacementOperationId,
} from '../../../lib/garden/gardenBoxBlockPlacementSchemas';
import { placeGardenBoxBlockForAccount } from '../../../lib/garden/gardenBoxBlockPlacementService';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const gardenBoxInventoryParamsSchema = z.object({
    gardenId: z.coerce.number().int().positive(),
    blockId: z.string().trim().min(1).max(128),
});

const gardenBoxInventoryBlockPlacementParamsSchema =
    gardenBoxInventoryParamsSchema.extend({
        entityId: z.string().trim().min(1).max(100),
    });

type EnrichedInventoryItem = InventoryItem & {
    name?: string;
    image?: string;
};

async function enrichInventoryItems(
    inventories: InventoryItem[][],
): Promise<EnrichedInventoryItem[][]> {
    const allItems = inventories.flat();
    const entityTypeNames = Array.from(
        new Set(allItems.map((item) => item.entityTypeName)),
    );
    if (entityTypeNames.length === 0) {
        return inventories.map(() => []);
    }

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

    return inventories.map((inventory) =>
        inventory.map((item) => {
            const entity = (entitiesByType[item.entityTypeName] ?? []).find(
                (entity) =>
                    (entity as { id?: string | number }).id?.toString() ===
                    item.entityId,
            );

            return {
                ...item,
                name: entity?.information?.name ?? entity?.information?.label,
                image: (entity as { image?: { cover?: { url?: string } } })
                    ?.image?.cover?.url,
            };
        }),
    );
}

async function getGardenBoxForAccount(
    accountId: string,
    gardenId: number,
    blockId: string,
) {
    const [garden, block] = await Promise.all([
        getGarden(gardenId),
        getGardenBlock(gardenId, blockId),
    ]);

    if (
        !garden ||
        garden.accountId !== accountId ||
        block?.name !== 'GardenBox'
    ) {
        return null;
    }

    return {
        blockId: block.id,
        gardenId,
        gardenName: garden.name,
    };
}

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description:
                'Get account inventory and inventory stored in garden boxes for the current account.',
            security: authSecurity,
            tags: ['Inventory'],
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const inventory = await getInventory(accountId);
            const gardenBoxes = await getGardenBoxBlocksForAccount(accountId);
            const gardenBoxInventories = await Promise.all(
                gardenBoxes.map((gardenBox) =>
                    getGardenBoxInventory(
                        accountId,
                        gardenBox.gardenId,
                        gardenBox.blockId,
                    ),
                ),
            );
            const [items, ...gardenBoxItems] = await enrichInventoryItems([
                inventory,
                ...gardenBoxInventories,
            ]);

            return context.json({
                items,
                gardenBoxes: gardenBoxes.map((gardenBox, index) => ({
                    ...gardenBox,
                    items: gardenBoxItems[index] ?? [],
                })),
            });
        },
    )
    .get(
        '/garden-boxes/:gardenId/:blockId',
        describeRoute({
            description:
                'Get inventory stored in one garden box owned by the current account.',
            security: authSecurity,
            tags: ['Inventory'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', gardenBoxInventoryParamsSchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { gardenId, blockId } = context.req.valid('param');
            const gardenBox = await getGardenBoxForAccount(
                accountId,
                gardenId,
                blockId,
            );
            if (!gardenBox) {
                return context.json({ error: 'Garden box not found' }, 404);
            }

            const inventory = await getGardenBoxInventory(
                accountId,
                gardenId,
                blockId,
            );
            const [items] = await enrichInventoryItems([inventory]);

            return context.json({
                ...gardenBox,
                items,
            });
        },
    )
    .put(
        '/garden-boxes/:gardenId/:blockId',
        describeRoute({
            description:
                'Garden box inventory replacement is disabled. Use the atomic garden block place and store routes.',
            security: authSecurity,
            tags: ['Inventory'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', gardenBoxInventoryParamsSchema),
        async (context) => {
            context.header('Allow', 'GET');
            return context.json(
                {
                    error: 'Garden box inventory replacement is disabled. Use the atomic garden block place and store routes.',
                    code: 'GARDEN_BOX_INVENTORY_REPLACEMENT_DISABLED',
                },
                405,
            );
        },
    )
    .post(
        '/garden-boxes/:gardenId/:blockId/items/block/:entityId/place',
        describeRoute({
            description:
                'Atomically place and consume one block from a garden box. New clients can replay an exact bounded operation ID; legacy requests receive a one-shot server identity.',
            security: authSecurity,
            tags: ['Inventory'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', gardenBoxInventoryBlockPlacementParamsSchema),
        zValidator('json', gardenBoxBlockPlacementBodySchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { gardenId, blockId, entityId } = context.req.valid('param');
            const { operationId } = context.req.valid('json');
            try {
                const result = await placeGardenBoxBlockForAccount({
                    accountId,
                    gardenId,
                    gardenBoxBlockId: blockId,
                    entityId,
                    operationId:
                        resolveGardenBoxBlockPlacementOperationId(operationId),
                });
                if (!result.ok) {
                    return context.json(
                        { error: result.error, code: result.code },
                        result.status,
                    );
                }

                return context.json({
                    id: result.blockId,
                    position: result.position,
                    item: result.item,
                });
            } catch (error) {
                console.error('Failed to place block from garden box', {
                    accountId,
                    gardenId,
                    gardenBoxBlockId: blockId,
                    entityId,
                    error,
                });
                return context.json({ error: 'Failed to place block' }, 500);
            }
        },
    );

export default app;
