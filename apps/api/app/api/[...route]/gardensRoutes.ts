import { Hono } from 'hono';
import { createGardenBlock, createGardenStack, deleteGardenStack, getAccountGardens, getEntitiesFormatted, getGarden, getGardenStack, spendSunflowers, updateGardenStack } from '@gredice/storage';
import { validator as zValidator } from "hono-openapi/zod";
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { describeRoute } from 'hono-openapi';
import { authValidator, AuthVariables } from '../../../lib/hono/authValidator';

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
                return context.newResponse('Invalid garden ID', { status: 400 });
            }

            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.notFound();
            }

            // Stacks: group by x then by y
            const stacks: Record<string, Record<string, string[]>> = garden.stacks.reduce((acc, stack) => {
                if (!acc[stack.positionX]) {
                    acc[stack.positionX] = {};
                }
                acc[stack.positionX][stack.positionY] = stack.blocks;
                return acc;
            }, {} as Record<string, Record<string, string[]>>);

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
                return context.notFound();
            }

            const operations = context.req.valid('json');
            if (operations.length === 0) {
                return context.newResponse('No operations provided', { status: 400 });
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
                if (pathParts.length === 4) {
                    index = parseInt(pathParts[3], 10);
                    if (Number.isNaN(index)) {
                        throw new Error('Invalid path: ' + path);
                    }
                }

                return { x, y, index };
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
                    if (!Array.isArray(value)) {
                        return context.newResponse('Value must be an array', { status: 400 });
                    }
                    if (value.length > 0) {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: value
                        });
                    }
                } else {
                    if (Array.isArray(value) || typeof value !== 'string') {
                        return context.newResponse('Value must be a string', { status: 400 });
                    }

                    await updateGardenStack(gardenIdNumber, {
                        x: stackPosition.x,
                        y: stackPosition.y,
                        blocks: [value]
                    });
                }
            }

            async function removeStack(path: string) {
                const stackPosition = parsePath(path);
                if (stackPosition.index === undefined) {
                    await deleteGardenStack(gardenIdNumber, stackPosition);
                } else {
                    const stack = await getStack(path);
                    if (!stack) {
                        return context.newResponse(`Stack ${path} not found`, { status: 400 });
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
                        return context.newResponse(`Stack ${path} not found`, { status: 400 });
                    }

                    const stackPosition = parsePath(path);
                    if (stackPosition.index === undefined) {
                        if (!Array.isArray(value)) {
                            return context.newResponse('Test value must be an array', { status: 400 });
                        }

                        if (JSON.stringify(stack.blocks) !== JSON.stringify(value)) {
                            return context.newResponse(`Test failed: ${path} = ${JSON.stringify(value)}`, { status: 400 });
                        }
                    } else {
                        if (Array.isArray(value)) {
                            return context.newResponse('Test value must be a string', { status: 400 });
                        }

                        if (stack.blocks[stackPosition.index] !== value) {
                            return context.newResponse(`Test failed: ${path} = ${JSON.stringify(value)}`, { status: 400 });
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
                            return context.newResponse('Test value must be an array', { status: 400 });
                        }
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: value
                        });
                    } else {
                        if (Array.isArray(value) || typeof value !== 'string') {
                            return context.newResponse('Test value must be a string', { status: 400 });
                        }

                        const stack = await getStack(path);
                        if (!stack) {
                            return context.newResponse(`Stack ${path} not found`, { status: 400 });
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
                        return context.newResponse(`Stack ${from} not found`, { status: 400 });
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
                        return context.newResponse(`Stack ${from} not found`, { status: 400 });
                    }
                    const fromValue = fromStack.blocks;

                    const resp = await addStack(path, fromValue);
                    if (resp) {
                        return resp;
                    }
                } else {
                    return context.newResponse('Operation not implemented', { status: 501 });
                }
            }

            return context.newResponse(null, { status: 200 });
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
                return context.newResponse('Invalid garden ID', { status: 400 });
            }

            // Check garden exists and is owned by user
            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.notFound();
            }

            // Retrieve block information (cost)
            const entities = await getEntitiesFormatted('block') as BlockData[];
            const block = entities.find(block => block.id === 'block');
            if (!block) {
                return context.newResponse('Requested block not found', { status: 400 });
            }
            const cost = block.prices.sunflowers ?? 0;
            if (cost <= 0) {
                return context.newResponse('Requested block not for sale', { status: 400 });
            }

            // Spend sunflowers
            await spendSunflowers(accountId, cost, 'block:' + block.information.name);

            // Create block
            const blockId = randomUUID();
            await createGardenBlock(gardenIdNumber, blockId, block.information.name);

            return context.json({ id: blockId });
        });

export default app;