import { Hono } from 'hono';
import { createGardenBlock, createGardenStack, deleteGardenStack, getAccountGardens, getEntitiesFormatted, getGarden, getGardenBlocks, getGardenStack, spendSunflowers, updateGardenBlock, updateGardenStack } from '@gredice/storage';
import { validator as zValidator } from "hono-openapi/zod";
import { z } from 'zod';
import { describeRoute } from 'hono-openapi';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';
import { getEvents, knownEventTypes } from '@gredice/storage';

export const getBlockData = async () => {
    return await getEntitiesFormatted('block') as BlockData[]
};

export type BlockData = {
    id: string,
    information: {
        name: string,
        label: string,
        shortDescription: string,
        fullDescription: string,
    },
    attributes: {
        height: number,
        stackable?: boolean
    },
    prices: {
        sunflowers: number
    }
}

const app = new Hono<{ Variables: AuthVariables }>()
    .get(
        '/',
        describeRoute({
            description: 'Get gardens authorized for account',
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId } = context.get('authContext');
            const gardens = await getAccountGardens(accountId);
            return context.json(gardens.map(garden => ({
                id: garden.id,
                name: garden.name,
                createdAt: garden.createdAt,
            })));
        })
    .get(
        '/:gardenId',
        describeRoute({
            description: 'Get garden information'
        }),
        zValidator(
            "param",
            z.object({
                gardenId: z.string(),
            })
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId);
            if (isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const [garden, blockPlaceEventsRaw, blocks] = await Promise.all([
                getGarden(gardenIdNumber),
                getEvents(knownEventTypes.gardens.blockPlace, gardenId, 0, 1000),
                getGardenBlocks(gardenIdNumber)
            ]);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const blockPlaceEvents = blockPlaceEventsRaw.map(event => ({
                ...event,
                data: event.data as { id: string, name: string }
            }));

            // Stacks: group by x then by y
            const stacks = garden.stacks.reduce((acc, stack) => {
                if (!acc[stack.positionX]) {
                    acc[stack.positionX] = {};
                }
                acc[stack.positionX][stack.positionY] = stack.blocks.map(blockId => ({
                    id: blockId,
                    name: blockPlaceEvents.find(event => event.data.id === blockId)?.data.name ?? 'unknown',
                    rotation: blocks.find(block => block.id === blockId)?.rotation ?? 0,
                    variant: blocks.find(block => block.id === blockId)?.variant
                }));
                return acc;
            }, {} as Record<string, Record<string, { id: string, name: string, rotation?: number | null, variant?: number | null }[]>>);

            return context.json({
                id: garden.id,
                name: garden.name,
                latitude: garden.farm.latitude,
                longitude: garden.farm.longitude,
                stacks,
                createdAt: garden.createdAt
            });
        })
    // See: https://datatracker.ietf.org/doc/html/rfc6902
    .patch(
        '/:gardenId/stacks',
        describeRoute({
            description: 'Update garden stacks via JSON Patch operations',
        }),
        zValidator(
            "param",
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator(
            "json",
            z.array(
                z.discriminatedUnion('op', [
                    // add requires value
                    z.object({
                        op: z.literal('add'),
                        path: z.string(),
                        // Array<string> or string
                        value: z.union([z.array(z.string()), z.string()])
                    }),
                    // remove doesn't need value or from
                    z.object({
                        op: z.literal('remove'),
                        path: z.string()
                    }),
                    // replace requires value
                    z.object({
                        op: z.literal('replace'),
                        path: z.string(),
                        value: z.union([z.array(z.string()), z.string()])
                    }),
                    // move requires from
                    z.object({
                        op: z.literal('move'),
                        path: z.string(),
                        from: z.string()
                    }),
                    // copy requires from
                    z.object({
                        op: z.literal('copy'),
                        path: z.string(),
                        from: z.string()
                    }),
                    // test requires value
                    z.object({
                        op: z.literal('test'),
                        path: z.string(),
                        value: z.union([z.array(z.string()), z.string()])
                    })
                ])
            )
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId);
            if (isNaN(gardenIdNumber)) {
                return context.newResponse('Invalid garden ID', { status: 400 });
            }

            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const operations = context.req.valid('json');
            if (operations.length === 0) {
                return context.json({ error: 'No operations provided' }, 400);
            }

            /**
             * Parses a path string into an object with x, y, and index properties.
             * Format: /{x}/{y}[/{index}]
             * @param path The path to parse
             * @example "/0/0/1" => { x: 0, y: 0, index: 1 }
             * @example "/0/0" => { x: 0, y: 0, index: undefined }
             * @returns An object with x, y, and index properties
             */
            function parsePath(path: string) {
                const pathParts = path.split('/');
                if (pathParts.length < 3 || pathParts.length > 4) {
                    throw new Error('Invalid path: ' + path);
                }

                const x = parseInt(pathParts[1], 10);
                const y = parseInt(pathParts[2], 10);
                if (Number.isNaN(x) || Number.isNaN(y)) {
                    throw new Error('Invalid path: ' + path);
                }

                let index: number | undefined;
                let append = false;
                if (pathParts.length === 4) {
                    if (pathParts[3] === '-') {
                        append = true;
                    } else {
                        index = parseInt(pathParts[3], 10);
                        if (Number.isNaN(index)) {
                            throw new Error('Invalid path: ' + path);
                        }
                    }
                }

                return { x, y, index, append };
            }

            async function getStack(path: string) {
                return await getGardenStack(gardenIdNumber, parsePath(path));
            }

            async function addStack(path: string, value: string | string[]) {
                const stackPosition = parsePath(path);

                // Create stack if doesn't exist
                const existing = await getGardenStack(gardenIdNumber, stackPosition);
                if (!existing) {
                    await createGardenStack(gardenIdNumber, stackPosition);
                }

                if (stackPosition.index === undefined) {
                    if (Array.isArray(value)) {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: stackPosition.append
                                ? [...existing?.blocks ?? [], ...value]
                                : value
                        });
                    } else {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: stackPosition.append
                                ? [...existing?.blocks ?? [], value]
                                : [value]
                        });
                    }
                } else {
                    if (!existing ||
                        (existing?.blocks.length ?? 0) < stackPosition.index ||
                        stackPosition.index < 0) {
                        return context.json({ error: `Index out of bounds: ${stackPosition.index} in collection of ${existing?.blocks.length ?? 0}` }, 400);
                    }

                    if (Array.isArray(value)) {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: [
                                ...existing.blocks.slice(0, stackPosition.index),
                                ...value,
                                ...existing.blocks.slice(stackPosition.index)
                            ]
                        });
                    } else {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: [
                                ...existing.blocks.slice(0, stackPosition.index),
                                value,
                                ...existing.blocks.slice(stackPosition.index)
                            ]
                        });
                    }
                }
            }

            async function removeStack(path: string) {
                const stackPosition = parsePath(path);
                if (stackPosition.index === undefined) {
                    await deleteGardenStack(gardenIdNumber, stackPosition);
                } else {
                    const stack = await getStack(path);
                    if (!stack) {
                        return context.json({ error: `Stack ${path} not found` }, 400);
                    }

                    stack.blocks.splice(stackPosition.index, 1);
                    await updateGardenStack(gardenIdNumber, {
                        x: stackPosition.x,
                        y: stackPosition.y,
                        blocks: stack.blocks
                    });
                }
            }

            for (const operation of operations) {
                if (operation.op === 'test') {
                    const { path, value } = operation;
                    const stack = await getStack(path);
                    if (!stack) {
                        return context.json({ error: `Stack ${path} not found` }, 400);
                    }

                    const stackPosition = parsePath(path);
                    if (stackPosition.index === undefined) {
                        if (!Array.isArray(value)) {
                            return context.json({ error: 'Test value must be an array' }, 400);
                        }

                        if (JSON.stringify(stack.blocks) !== JSON.stringify(value)) {
                            return context.json({ error: `Test failed: ${path} = ${JSON.stringify(value)}` }, 400);
                        }
                    } else {
                        if (Array.isArray(value)) {
                            return context.json({ error: 'Test value must be a string' }, 400);
                        }

                        if (stack.blocks[stackPosition.index] !== value) {
                            return context.json({ error: `Test failed: ${path} = ${JSON.stringify(value)}` }, 400);
                        }
                    }
                } else if (operation.op === 'add') {
                    const { path, value } = operation;
                    const resp = await addStack(path, value);
                    if (resp) {
                        return resp;
                    }
                } else if (operation.op === 'remove') {
                    const { path } = operation;
                    const resp = await removeStack(path);
                    if (resp) {
                        return resp;
                    }
                } else if (operation.op === 'replace') {
                    const { path, value } = operation;
                    const stackPosition = parsePath(path);

                    if (stackPosition.index === undefined) {
                        if (!Array.isArray(value)) {
                            return context.json({ error: 'Test value must be an array' }, 400);
                        }
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: value
                        });
                    } else {
                        if (Array.isArray(value)) {
                            return context.json({ error: 'Test value must be a string' }, 400);
                        }

                        const stack = await getStack(path);
                        if (!stack) {
                            return context.json({ error: `Stack ${path} not found` }, 400);
                        }

                        stack.blocks[stackPosition.index] = value;
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: stack.blocks
                        });
                    }
                } else if (operation.op === 'move') {
                    const { path, from } = operation;
                    const fromPosition = parsePath(from);
                    const fromStack = await getStack(from);
                    if (!fromStack) {
                        return context.json({ error: `Stack ${from} not found` }, 400);
                    }
                    const fromValue = fromPosition.index === undefined
                        ? fromStack.blocks
                        : fromStack.blocks[fromPosition.index];

                    let resp = await addStack(path, fromValue);
                    if (resp) {
                        return resp;
                    }
                    resp = await removeStack(from);
                    if (resp) {
                        return resp;
                    }
                } else if (operation.op === 'copy') {
                    const { path, from } = operation;
                    const fromStack = await getStack(from);
                    if (!fromStack) {
                        return context.json({ error: `Stack ${from} not found` }, 400);
                    }
                    const fromValue = fromStack.blocks;

                    const resp = await addStack(path, fromValue);
                    if (resp) {
                        return resp;
                    }
                } else {
                    return context.json({ error: 'Operation not implemented' }, 501);
                }
            }

            return context.json(null, 200);
        })
    .post(
        '/:gardenId/blocks',
        describeRoute({
            description: 'Place a block in a garden',
        }),
        zValidator(
            "param",
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator(
            "json",
            z.object({
                blockName: z.string(),
            })
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId);
            if (isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            // Check garden exists and is owned by user
            const { accountId } = context.get('authContext');

            const [garden, entities] = await Promise.all([
                getGarden(gardenIdNumber),
                getBlockData()
            ]);

            if (!garden || garden.accountId !== accountId) {
                return context.json({
                    error: 'Garden not found'
                }, 404);
            }

            const { blockName } = context.req.valid('json');

            // Retrieve block information (cost)
            const block = entities.find(block => block.information.name === blockName);
            if (!block) {
                return context.json({ error: 'Requested block not found' }, 400);
            }
            const cost = block.prices.sunflowers ?? 0;
            if (cost <= 0) {
                return context.json({ error: 'Requested block not for sale' }, 400);
            }

            // Spend sunflowers and create block in parallel
            const [, blockId] = await Promise.all([
                spendSunflowers(accountId, cost, 'block:' + block.information.name),
                createGardenBlock(gardenIdNumber, block.information.name)
            ]);

            return context.json({ id: blockId });
        })
    .put(
        '/:gardenId/blocks/:blockId',
        describeRoute({
            description: 'Update a block in a garden',
        }),
        zValidator(
            "param",
            z.object({
                gardenId: z.string(),
                blockId: z.string(),
            }),
        ),
        zValidator(
            "json",
            z.object({
                rotation: z.number().nullable().optional(),
                variant: z.number().nullable().optional(),
            })
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, blockId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId);
            if (isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            // Check garden exists and is owned by user
            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({
                    error: 'Garden not found'
                }, 404);
            }

            const { rotation, variant } = context.req.valid('json');

            await updateGardenBlock({
                id: blockId,
                rotation,
                variant
            });

            return context.json(null, 200);
        });

export default app;