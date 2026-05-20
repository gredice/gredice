import {
    type EntityStandardized,
    getEntitiesFormatted,
    getGarden,
    getGardenBlock,
    getGardenBoxBlocksForAccount,
    getGardenBoxInventory,
    getInventory,
    type InventoryItem,
    type InventoryItemInput,
    setGardenBoxInventory,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const gardenBoxInventoryParamsSchema = z.object({
    gardenId: z.coerce.number().int().positive(),
    blockId: z.string().trim().min(1).max(128),
});

const inventoryItemSchema = z.object({
    entityTypeName: z.string().trim().min(1).max(100),
    entityId: z.string().trim().min(1).max(100),
    amount: z.number().int().min(0).max(1000),
});

const gardenBoxInventoryBodySchema = z.object({
    items: z.array(inventoryItemSchema).max(100),
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
                'Replace the inventory contents stored in one garden box owned by the current account.',
            security: authSecurity,
            tags: ['Inventory'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', gardenBoxInventoryParamsSchema),
        zValidator('json', gardenBoxInventoryBodySchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { gardenId, blockId } = context.req.valid('param');
            const { items } = context.req.valid('json');
            const gardenBox = await getGardenBoxForAccount(
                accountId,
                gardenId,
                blockId,
            );
            if (!gardenBox) {
                return context.json({ error: 'Garden box not found' }, 404);
            }

            const inventory = await setGardenBoxInventory(
                accountId,
                gardenId,
                blockId,
                items satisfies InventoryItemInput[],
            );
            const [enrichedItems] = await enrichInventoryItems([inventory]);

            return context.json({
                ...gardenBox,
                items: enrichedItems,
            });
        },
    );

export default app;
