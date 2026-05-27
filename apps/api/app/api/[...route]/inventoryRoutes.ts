import {
    consumeGardenBoxInventoryItem,
    createGardenBlock,
    createGardenStack,
    type EntityStandardized,
    getEntitiesFormatted,
    getGarden,
    getGardenBlock,
    getGardenBlocks,
    getGardenBoxBlocksForAccount,
    getGardenBoxInventory,
    getInventory,
    type InventoryItem,
    type InventoryItemInput,
    setGardenBoxInventory,
    storage,
    updateGardenStack,
} from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { getBlockData } from '../../../lib/blocks/blockDataService';
import { authSecurity } from '../../../lib/docs/security';
import { resolveGardenBlockPlacement } from '../../../lib/garden/blockPlacementService';
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
    )
    .post(
        '/garden-boxes/:gardenId/:blockId/items/block/:entityId/place',
        describeRoute({
            description:
                'Place one block from a garden box inventory into the garden using standard block placement rules.',
            security: authSecurity,
            tags: ['Inventory'],
        }),
        authValidator(['user', 'admin']),
        zValidator('param', gardenBoxInventoryBlockPlacementParamsSchema),
        async (context) => {
            const { accountId } = context.get('authContext');
            const { gardenId, blockId, entityId } = context.req.valid('param');
            const [garden, gardenBoxBlock, gardenBlocks, blockData] =
                await Promise.all([
                    getGarden(gardenId),
                    getGardenBlock(gardenId, blockId),
                    getGardenBlocks(gardenId),
                    getBlockData(),
                ]);

            if (
                !garden ||
                garden.accountId !== accountId ||
                gardenBoxBlock?.name !== 'GardenBox'
            ) {
                return context.json({ error: 'Garden box not found' }, 404);
            }

            const block = blockData.find(
                (candidate) => candidate.id.toString() === entityId,
            );
            const blockName = block?.information?.name;
            if (!block || !blockName) {
                return context.json({ error: 'Block not found' }, 404);
            }

            if (blockName === 'GardenBox') {
                return context.json(
                    {
                        error: 'Garden boxes cannot be placed from garden boxes',
                    },
                    400,
                );
            }

            if (blockName === 'Raised_Bed') {
                return context.json(
                    { error: 'Raised beds cannot be placed from garden boxes' },
                    400,
                );
            }

            const blockNameById = new Map(
                gardenBlocks.map((gardenBlock) => [
                    gardenBlock.id,
                    gardenBlock.name,
                ]),
            );
            const blockDataByName = new Map<
                string,
                (typeof blockData)[number]
            >();
            for (const candidate of blockData) {
                const candidateName = candidate.information?.name;
                if (candidateName) {
                    blockDataByName.set(candidateName, candidate);
                }
            }

            const placement = resolveGardenBlockPlacement({
                blockName,
                stacks: garden.stacks,
                blockNameById,
                blockDataByName,
            });
            if (!placement.valid) {
                return context.json({ error: placement.error }, 400);
            }

            const { x, y, existingBlocks } = placement.placement;
            const hasTargetStack = garden.stacks.some(
                (stack) => stack.positionX === x && stack.positionY === y,
            );

            try {
                const placedBlockId = await storage().transaction(
                    async (tx) => {
                        await consumeGardenBoxInventoryItem(
                            accountId,
                            gardenId,
                            blockId,
                            {
                                entityTypeName: 'block',
                                entityId,
                                amount: 1,
                                source: 'gardenBox:place',
                            },
                            tx,
                        );

                        if (!hasTargetStack) {
                            await createGardenStack(gardenId, { x, y }, tx);
                        }

                        const createdBlockId = await createGardenBlock(
                            gardenId,
                            blockName,
                            tx,
                        );
                        await updateGardenStack(
                            gardenId,
                            {
                                x,
                                y,
                                blocks: [...existingBlocks, createdBlockId],
                            },
                            tx,
                        );

                        return createdBlockId;
                    },
                );

                return context.json({
                    id: placedBlockId,
                    position: { x, y },
                    item: {
                        entityTypeName: 'block',
                        entityId,
                        amount: 1,
                    },
                });
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : 'Failed to place block';
                const status =
                    errorMessage === 'Nedovoljno predmeta u vrtnoj kutiji'
                        ? 400
                        : 500;

                return context.json({ error: errorMessage }, status);
            }
        },
    );

export default app;
