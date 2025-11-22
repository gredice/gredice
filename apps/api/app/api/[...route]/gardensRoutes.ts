import { signalcoClient } from '@gredice/signalco';
import {
    createEvent,
    createGardenBlock,
    createGardenStack,
    createRaisedBed,
    deleteGardenStack,
    getAccountGardens,
    getEvents,
    getGarden,
    getGardenBlocks,
    getGardenStack,
    getRaisedBed,
    getRaisedBedDiaryEntries,
    getRaisedBedFieldDiaryEntries,
    getRaisedBedSensors,
    knownEvents,
    knownEventTypes,
    spendSunflowers,
    updateGarden,
    updateGardenBlock,
    updateGardenStack,
    updateRaisedBed,
} from '@gredice/storage';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { getBlockData } from '../../../lib/blocks/blockDataService';
import { deleteGardenBlock } from '../../../lib/garden/gardenBlocksService';
import {
    calculateRaisedBedsValidity,
    updateRaisedBedsOrientation,
} from '../../../lib/garden/raisedBedsService';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

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
            return context.json(
                gardens.map((garden) => ({
                    id: garden.id,
                    name: garden.name,
                    createdAt: garden.createdAt,
                })),
            );
        },
    )
    .get(
        '/:gardenId',
        describeRoute({
            description: 'Get garden information',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const [garden, /*blockPlaceEventsRaw,*/ blocks] = await Promise.all(
                [
                    getGarden(gardenIdNumber),
                    // getEvents(knownEventTypes.gardens.blockPlace, gardenId, 0, 10000),
                    getGardenBlocks(gardenIdNumber),
                ],
            );
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            // TODO: Implement validation of block place events
            // const blockPlaceEvents = blockPlaceEventsRaw.map(event => ({
            //     ...event,
            //     data: event.data as { id: string, name: string }
            // }));

            // Stacks: group by x then by y
            const raisedBedsToCreate: string[] = [];
            const stacks = garden.stacks.reduce(
                (acc, stack) => {
                    if (!acc[stack.positionX]) {
                        acc[stack.positionX] = {};
                    }
                    acc[stack.positionX][stack.positionY] = stack.blocks
                        .map((blockId) => {
                            const block = blocks.find(
                                (block) => block.id === blockId,
                            );
                            // const blockPlaceEvent = blockPlaceEvents.find(event => event.data.id === blockId)?.data.name;
                            // if (!blockPlaceEvent) {
                            //     console.warn('Block place event not found', { blockId });
                            //     return null;
                            // }
                            if (!block) {
                                console.warn('Block not found', { blockId });
                                return null;
                            }

                            // Verify block has raised bed attached to it if it's type is raised bed
                            if (block.name === 'Raised_Bed') {
                                const assignedRaisedBed =
                                    garden.raisedBeds.find(
                                        (raisedBed) =>
                                            raisedBed.blockId === blockId,
                                    );
                                if (!assignedRaisedBed) {
                                    raisedBedsToCreate.push(blockId);
                                }
                            }

                            return {
                                id: blockId,
                                name: block?.name ?? 'unknown',
                                rotation: block?.rotation ?? 0,
                                variant: block?.variant,
                            };
                        })
                        .filter(Boolean) as {
                        id: string;
                        name: string;
                        rotation?: number | null;
                        variant?: number | null;
                    }[];
                    return acc;
                },
                {} as Record<
                    string,
                    Record<
                        string,
                        {
                            id: string;
                            name: string;
                            rotation?: number | null;
                            variant?: number | null;
                        }[]
                    >
                >,
            );

            // Create missing raised beds
            let freshGarden: NonNullable<
                Awaited<ReturnType<typeof getGarden>>
            > = garden;
            if (raisedBedsToCreate.length > 0) {
                for (const blockId of raisedBedsToCreate) {
                    await createRaisedBed({
                        blockId,
                        gardenId: garden.id,
                        accountId: garden.accountId,
                    });
                    console.info('Created missing raised bed', {
                        gardenId: garden.id,
                        blockId,
                    });
                }
                const refreshed = await getGarden(gardenIdNumber); // Refresh garden to include new raised beds
                if (!refreshed) {
                    throw new Error(
                        `Garden ${gardenIdNumber} not found after creating raised beds`,
                    );
                }
                freshGarden = refreshed;
            }

            return context.json({
                id: freshGarden.id,
                name: freshGarden.name,
                latitude: freshGarden.farm.latitude,
                longitude: freshGarden.farm.longitude,
                stacks,
                raisedBeds: (() => {
                    const validityMap = calculateRaisedBedsValidity(
                        freshGarden.raisedBeds,
                        freshGarden.stacks,
                    );
                    return freshGarden.raisedBeds.map((raisedBed) => ({
                        id: raisedBed.id,
                        name: raisedBed.name,
                        physicalId: raisedBed.physicalId,
                        blockId: raisedBed.blockId,
                        status: raisedBed.status,
                        orientation: raisedBed.orientation,
                        fields: raisedBed.fields,
                        createdAt: raisedBed.createdAt,
                        updatedAt: raisedBed.updatedAt,
                        isValid: validityMap.get(raisedBed.id) ?? false,
                    }));
                })(),
                createdAt: freshGarden.createdAt,
            });
        },
    )
    .get(
        '/:gardenId/public',
        describeRoute({
            description: 'Get public garden information',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            // TODO: Refactor to use a single function for public and non-public garden retrieval
            const [garden, blockPlaceEventsRaw, blocks] = await Promise.all([
                getGarden(gardenIdNumber),
                getEvents(
                    knownEventTypes.gardens.blockPlace,
                    [gardenId],
                    0,
                    10000,
                ),
                getGardenBlocks(gardenIdNumber),
            ]);
            if (!garden) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            // TODO: Check visibility

            const blockPlaceEvents = blockPlaceEventsRaw.map((event) => ({
                ...event,
                data: event.data as { id: string; name: string },
            }));

            // Stacks: group by x then by y
            const stacks = garden.stacks.reduce(
                (acc, stack) => {
                    if (!acc[stack.positionX]) {
                        acc[stack.positionX] = {};
                    }
                    acc[stack.positionX][stack.positionY] = stack.blocks.map(
                        (blockId) => ({
                            id: blockId,
                            name:
                                blockPlaceEvents.find(
                                    (event) => event.data.id === blockId,
                                )?.data.name ?? 'unknown',
                            rotation:
                                blocks.find((block) => block.id === blockId)
                                    ?.rotation ?? 0,
                            variant: blocks.find(
                                (block) => block.id === blockId,
                            )?.variant,
                        }),
                    );
                    return acc;
                },
                {} as Record<
                    string,
                    Record<
                        string,
                        {
                            id: string;
                            name: string;
                            rotation?: number | null;
                            variant?: number | null;
                        }[]
                    >
                >,
            );

            return context.json({
                id: garden.id,
                name: garden.name,
                latitude: garden.farm.latitude,
                longitude: garden.farm.longitude,
                stacks,
                createdAt: garden.createdAt,
            });
        },
    )
    .patch(
        '/:gardenId',
        describeRoute({
            description: 'Update garden information',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator(
            'json',
            z.object({
                name: z.string().min(1).optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const { name } = context.req.valid('json');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            // Update garden with provided fields
            const updateData: { id: number; name?: string } = {
                id: gardenIdNumber,
            };
            if (name !== undefined) {
                updateData.name = name.trim();
            }

            await updateGarden(updateData);

            return context.json({ success: true });
        },
    )
    // See: https://datatracker.ietf.org/doc/html/rfc6902
    .patch(
        '/:gardenId/stacks',
        describeRoute({
            description: 'Update garden stacks via JSON Patch operations',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator(
            'json',
            z.array(
                z.discriminatedUnion('op', [
                    // add requires value
                    z.object({
                        op: z.literal('add'),
                        path: z.string(),
                        // Array<string> or string
                        value: z.union([z.array(z.string()), z.string()]),
                    }),
                    // remove doesn't need value or from
                    z.object({
                        op: z.literal('remove'),
                        path: z.string(),
                    }),
                    // replace requires value
                    z.object({
                        op: z.literal('replace'),
                        path: z.string(),
                        value: z.union([z.array(z.string()), z.string()]),
                    }),
                    // move requires from
                    z.object({
                        op: z.literal('move'),
                        path: z.string(),
                        from: z.string(),
                    }),
                    // copy requires from
                    z.object({
                        op: z.literal('copy'),
                        path: z.string(),
                        from: z.string(),
                    }),
                    // test requires value
                    z.object({
                        op: z.literal('test'),
                        path: z.string(),
                        value: z.union([z.array(z.string()), z.string()]),
                    }),
                ]),
            ),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.newResponse('Invalid garden ID', {
                    status: 400,
                });
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
                    throw new Error(`Invalid path: ${path}`);
                }

                const x = parseInt(pathParts[1], 10);
                const y = parseInt(pathParts[2], 10);
                if (Number.isNaN(x) || Number.isNaN(y)) {
                    throw new Error(`Invalid path: ${path}`);
                }

                let index: number | undefined;
                let append = false;
                if (pathParts.length === 4) {
                    if (pathParts[3] === '-') {
                        append = true;
                    } else {
                        index = parseInt(pathParts[3], 10);
                        if (Number.isNaN(index)) {
                            throw new Error(`Invalid path: ${path}`);
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
                const existing = await getGardenStack(
                    gardenIdNumber,
                    stackPosition,
                );
                if (!existing) {
                    await createGardenStack(gardenIdNumber, stackPosition);
                }

                if (stackPosition.index === undefined) {
                    if (Array.isArray(value)) {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: stackPosition.append
                                ? [...(existing?.blocks ?? []), ...value]
                                : value,
                        });
                    } else {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: stackPosition.append
                                ? [...(existing?.blocks ?? []), value]
                                : [value],
                        });
                    }
                } else {
                    if (
                        !existing ||
                        (existing?.blocks.length ?? 0) < stackPosition.index ||
                        stackPosition.index < 0
                    ) {
                        return context.json(
                            {
                                error: `Index out of bounds: ${stackPosition.index} in collection of ${existing?.blocks.length ?? 0}`,
                            },
                            400,
                        );
                    }

                    if (Array.isArray(value)) {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: [
                                ...existing.blocks.slice(
                                    0,
                                    stackPosition.index,
                                ),
                                ...value,
                                ...existing.blocks.slice(stackPosition.index),
                            ],
                        });
                    } else {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: [
                                ...existing.blocks.slice(
                                    0,
                                    stackPosition.index,
                                ),
                                value,
                                ...existing.blocks.slice(stackPosition.index),
                            ],
                        });
                    }
                }
            }

            async function removeStack(path: string, permanent = false) {
                const stackPosition = parsePath(path);
                if (stackPosition.index === undefined) {
                    await deleteGardenStack(gardenIdNumber, stackPosition);
                } else {
                    const stack = await getStack(path);
                    if (!stack) {
                        return context.json(
                            { error: `Stack ${path} not found` },
                            400,
                        );
                    }

                    if (!permanent) {
                        stack.blocks.splice(stackPosition.index, 1);
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: stack.blocks,
                        });
                    } else {
                        const blockId = stack.blocks[stackPosition.index];
                        await deleteGardenBlock(
                            accountId,
                            gardenIdNumber,
                            blockId,
                        );
                    }
                }
            }

            for (const operation of operations) {
                if (operation.op === 'test') {
                    const { path, value } = operation;
                    const stack = await getStack(path);
                    if (!stack) {
                        return context.json(
                            { error: `Stack ${path} not found` },
                            400,
                        );
                    }

                    const stackPosition = parsePath(path);
                    if (stackPosition.index === undefined) {
                        if (!Array.isArray(value)) {
                            return context.json(
                                { error: 'Test value must be an array' },
                                400,
                            );
                        }

                        if (
                            JSON.stringify(stack.blocks) !==
                            JSON.stringify(value)
                        ) {
                            return context.json(
                                {
                                    error: `Test failed: ${path} = ${JSON.stringify(value)}`,
                                },
                                400,
                            );
                        }
                    } else {
                        if (Array.isArray(value)) {
                            return context.json(
                                { error: 'Test value must be a string' },
                                400,
                            );
                        }

                        if (stack.blocks[stackPosition.index] !== value) {
                            return context.json(
                                {
                                    error: `Test failed: ${path} = ${JSON.stringify(value)}`,
                                },
                                400,
                            );
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
                    const resp = await removeStack(path, true);
                    if (resp) {
                        return resp;
                    }
                } else if (operation.op === 'replace') {
                    const { path, value } = operation;
                    const stackPosition = parsePath(path);

                    if (stackPosition.index === undefined) {
                        if (!Array.isArray(value)) {
                            return context.json(
                                { error: 'Test value must be an array' },
                                400,
                            );
                        }
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: value,
                        });
                    } else {
                        if (Array.isArray(value)) {
                            return context.json(
                                { error: 'Test value must be a string' },
                                400,
                            );
                        }

                        const stack = await getStack(path);
                        if (!stack) {
                            return context.json(
                                { error: `Stack ${path} not found` },
                                400,
                            );
                        }

                        stack.blocks[stackPosition.index] = value;
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: stack.blocks,
                        });
                    }
                } else if (operation.op === 'move') {
                    const { path, from } = operation;
                    const fromPosition = parsePath(from);
                    const fromStack = await getStack(from);
                    if (!fromStack) {
                        return context.json(
                            { error: `Stack ${from} not found` },
                            400,
                        );
                    }
                    const fromValue =
                        fromPosition.index === undefined
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
                        return context.json(
                            { error: `Stack ${from} not found` },
                            400,
                        );
                    }
                    const fromValue = fromStack.blocks;

                    const resp = await addStack(path, fromValue);
                    if (resp) {
                        return resp;
                    }
                } else {
                    return context.json(
                        { error: 'Operation not implemented' },
                        501,
                    );
                }
            }

            // Update raised beds orientation after stack changes
            const updatedGarden = await getGarden(gardenIdNumber);
            if (updatedGarden) {
                await updateRaisedBedsOrientation(updatedGarden);
            }

            return context.json(null, 200);
        },
    )
    .post(
        '/:gardenId/blocks',
        describeRoute({
            description: 'Place a block in a garden',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator(
            'json',
            z.object({
                blockName: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            // Check garden exists and is owned by user
            const { accountId } = context.get('authContext');

            const [garden, blockData] = await Promise.all([
                getGarden(gardenIdNumber),
                getBlockData(),
            ]);

            if (!garden || garden.accountId !== accountId) {
                return context.json(
                    {
                        error: 'Garden not found',
                    },
                    404,
                );
            }

            const { blockName } = context.req.valid('json');

            // Retrieve block information (cost)
            const block = blockData.find(
                (block) => block.information?.name === blockName,
            );
            if (!block) {
                return context.json(
                    { error: 'Requested block not found' },
                    400,
                );
            }
            const cost = block.prices?.sunflowers ?? 0;
            if (cost <= 0) {
                return context.json(
                    { error: 'Requested block not for sale' },
                    400,
                );
            }

            // Spend sunflowers and create block in parallel
            const [, blockId] = await Promise.all([
                spendSunflowers(accountId, cost, `block:${blockName}`),
                createGardenBlock(gardenIdNumber, blockName),
            ]);

            return context.json({ id: blockId });
        },
    )
    .put(
        '/:gardenId/blocks/:blockId',
        describeRoute({
            description: 'Update a block in a garden',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                blockId: z.string(),
            }),
        ),
        zValidator(
            'json',
            z.object({
                rotation: z.number().nullable().optional(),
                variant: z.number().nullable().optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, blockId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            // Check garden exists and is owned by user
            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json(
                    {
                        error: 'Garden not found',
                    },
                    404,
                );
            }

            const { rotation, variant } = context.req.valid('json');

            await updateGardenBlock({
                id: blockId,
                rotation,
                variant,
            });

            return context.json(null, 200);
        },
    )
    .delete(
        '/:gardenId/blocks/:blockId',
        describeRoute({
            description: 'Delete a block in a garden.',
            summary:
                'Recycles the block by default and refunds the sunflowers.',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                blockId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, blockId } = context.req.valid('param');
            const { accountId } = context.get('authContext');
            const gardenIdNumber = parseInt(gardenId, 10) || 0;
            if (Number.isNaN(gardenIdNumber) || gardenIdNumber <= 0) {
                console.warn('Invalid garden ID', { gardenId });
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            console.info('Deleting block...', { gardenId, blockId });
            const result = await deleteGardenBlock(
                accountId,
                gardenIdNumber,
                blockId,
            );

            if (result?.errorStatus) {
                console.error('Error deleting block', {
                    gardenId,
                    blockId,
                    error: result.errorMessage,
                });
                return context.json(
                    { error: result.errorMessage },
                    result.errorStatus as ContentfulStatusCode,
                );
            }

            // Update raised beds orientation after stack changes
            const updatedGarden = await getGarden(gardenIdNumber);
            if (updatedGarden) {
                await updateRaisedBedsOrientation(updatedGarden);
            }

            return context.json(null, 200);
        },
    )
    .get(
        '/:gardenId/raised-beds',
        describeRoute({
            description: 'Get raised beds in a garden',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            // Check garden exists and is owned by user
            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json(
                    {
                        error: 'Garden not found',
                    },
                    404,
                );
            }

            const validityMap = calculateRaisedBedsValidity(
                garden.raisedBeds,
                garden.stacks,
            );
            return context.json(
                garden.raisedBeds.map((raisedBed) => ({
                    id: raisedBed.id,
                    blockId: raisedBed.blockId,
                    orientation: raisedBed.orientation,
                    createdAt: raisedBed.createdAt,
                    updatedAt: raisedBed.updatedAt,
                    isValid: validityMap.get(raisedBed.id) ?? false,
                })),
            );
        },
    )
    .get(
        '/:gardenId/raised-beds/:raisedBedId',
        describeRoute({
            description: 'Get raised bed information',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }
            const raisedBed = garden.raisedBeds.find(
                (rb) => rb.id === raisedBedIdNumber,
            );
            if (!raisedBed) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }
            const validityMap = calculateRaisedBedsValidity(
                garden.raisedBeds,
                garden.stacks,
            );

            return context.json({
                id: raisedBed.id,
                blockId: raisedBed.blockId,
                orientation: raisedBed.orientation,
                createdAt: raisedBed.createdAt,
                updatedAt: raisedBed.updatedAt,
                isValid: validityMap.get(raisedBed.id) ?? false,
            });
        },
    )
    .patch(
        '/:gardenId/raised-beds/:raisedBedId',
        describeRoute({
            description: 'Update a raised bed',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
            }),
        ),
        zValidator(
            'json',
            z.object({
                name: z.string().optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }

            await updateRaisedBed({
                id: raisedBedIdNumber,
                name: context.req.valid('json').name || undefined,
            });
        },
    )
    .get(
        '/:gardenId/raised-beds/:raisedBedId/diary-entries',
        describeRoute({
            description: 'Get diary entries for a raised bed',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const raisedBed = await getRaisedBed(raisedBedIdNumber);
            if (
                !raisedBed ||
                raisedBed.gardenId !== gardenIdNumber ||
                raisedBed.accountId !== accountId
            ) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            const diaryEntries =
                await getRaisedBedDiaryEntries(raisedBedIdNumber);
            return context.json(diaryEntries);
        },
    )
    .get(
        '/:gardenId/raised-beds/:raisedBedId/sensors',
        describeRoute({
            description: 'Get sensors for a raised bed',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const raisedBed = await getRaisedBed(raisedBedIdNumber);
            if (
                !raisedBed ||
                raisedBed.gardenId !== gardenIdNumber ||
                raisedBed.accountId !== accountId
            ) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            // Retrieve sensor for raised bed
            const sensors = await getRaisedBedSensors(raisedBedIdNumber);

            // Fetch sensor data from Signalco
            const data = await Promise.all(
                sensors.map((sensor) => {
                    if (!sensor.sensorSignalcoId) {
                        return null;
                    }
                    return signalcoClient().GET('/entity/{id}', {
                        params: { path: { id: sensor.sensorSignalcoId } },
                    });
                }),
            );

            return context.json(
                sensors.flatMap((sensor) => [
                    {
                        id: sensor.id,
                        status: sensor.status,
                        type: 'soil_moisture',
                        value:
                            data
                                .find(
                                    (d) =>
                                        d?.data?.id === sensor.sensorSignalcoId,
                                )
                                ?.data?.contacts?.find(
                                    (c) => c.contactName === 'soil_moisture',
                                )?.valueSerialized ?? null,
                        updatedAt:
                            data
                                .find(
                                    (d) =>
                                        d?.data?.id === sensor.sensorSignalcoId,
                                )
                                ?.data?.contacts?.find(
                                    (c) => c.contactName === 'soil_moisture',
                                )?.timeStamp ?? null,
                    },
                    {
                        id: sensor.id,
                        status: sensor.status,
                        type: 'soil_temperature',
                        value:
                            data
                                .find(
                                    (d) =>
                                        d?.data?.id === sensor.sensorSignalcoId,
                                )
                                ?.data?.contacts?.find(
                                    (c) => c.contactName === 'temperature',
                                )?.valueSerialized ?? null,
                        updatedAt:
                            data
                                .find(
                                    (d) =>
                                        d?.data?.id === sensor.sensorSignalcoId,
                                )
                                ?.data?.contacts?.find(
                                    (c) => c.contactName === 'temperature',
                                )?.timeStamp ?? null,
                    },
                ]),
            );
        },
    )
    .get(
        '/:gardenId/raised-beds/:raisedBedId/sensors/:sensorId/:type',
        describeRoute({
            description: 'Get a specific sensor for a raised bed',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
                sensorId: z.string(),
                type: z.string(),
            }),
        ),
        zValidator(
            'query',
            z.object({
                duration: z.string().optional().default('5'), // Default to 5 days
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, sensorId, type } =
                context.req.valid('param');
            const { duration } = context.req.valid('query');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const raisedBed = await getRaisedBed(raisedBedIdNumber);
            if (
                !raisedBed ||
                raisedBed.gardenId !== gardenIdNumber ||
                raisedBed.accountId !== accountId
            ) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            const sensors = await getRaisedBedSensors(raisedBedIdNumber);
            const sensorIdNumber = parseInt(sensorId, 10);
            const sensor = sensors.find((s) => s.id === sensorIdNumber);
            if (!sensor) {
                return context.json({ error: 'Sensor not found' }, 404);
            }

            // Fetch sensor data from Signalco
            const history = await signalcoClient().GET('/contact/history', {
                params: {
                    // @ts-expect-error Invalid type, but works
                    query: {
                        entityId: sensor.sensorSignalcoId,
                        channelName: 'zigbee2mqtt',
                        contactName:
                            type === 'soil_moisture'
                                ? 'soil_moisture'
                                : 'temperature',
                        duration: `${duration}.00:00`,
                    },
                },
            });

            return context.json({
                id: sensor.id,
                type,
                values: history.data?.values || [],
            });
        },
    )
    .patch(
        '/:gardenId/raised-beds/:raisedBedId/fields/:positionIndex',
        describeRoute({
            description: 'Update a plant in a raised bed field',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
                positionIndex: z.string(),
            }),
        ),
        zValidator(
            'json',
            z.object({
                status: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const { status } = context.req.valid('json');

            // For now, we only support 'remove' status update this way
            if (status !== 'removed') {
                return context.json({ error: 'Invalid status' }, 400);
            }

            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }

            const positionIndexNumber = parseInt(positionIndex, 10);
            if (Number.isNaN(positionIndexNumber) || positionIndexNumber < 0) {
                return context.json({ error: 'Invalid position index' }, 400);
            }

            // Verify the raised bed exists and belongs to the user
            const { accountId } = context.get('authContext');
            const raisedBed = await getRaisedBed(raisedBedIdNumber);
            if (
                !raisedBed ||
                raisedBed.gardenId !== gardenIdNumber ||
                raisedBed.accountId !== accountId
            ) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            // Find the field to validate it exists and can be updated
            const field = raisedBed.fields.find(
                (field) =>
                    field.positionIndex === positionIndexNumber && field.active,
            );
            if (!field) {
                return context.json(
                    { error: 'Field not found or not active' },
                    404,
                );
            }

            // For removal status, check if the plant can be removed (toBeRemoved should be true)
            if (status === 'removed' && !field.toBeRemoved) {
                return context.json(
                    {
                        error: 'Plant cannot be removed at this time. Only plants that are dead, harvested, or failed to sprout can be removed.',
                    },
                    400,
                );
            }

            // Call the storage function to create the event and update the plant status
            try {
                await createEvent(
                    knownEvents.raisedBedFields.plantUpdateV1(
                        `${raisedBedIdNumber.toString()}|${positionIndexNumber.toString()}`,
                        { status: status },
                    ),
                );

                return context.json({ success: true }, 200);
            } catch (error) {
                console.error('Error updating field plant status:', error);
                return context.json(
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : 'Failed to update plant status',
                    },
                    500,
                );
            }
        },
    )
    .get(
        '/:gardenId/raised-beds/:raisedBedId/fields/:positionIndex/diary-entries',
        describeRoute({
            description: 'Get diary entries for a raised bed field',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
                positionIndex: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }
            const positionIndexNumber = parseInt(positionIndex, 10);
            if (Number.isNaN(positionIndexNumber) || positionIndexNumber < 0) {
                return context.json({ error: 'Invalid position index' }, 400);
            }

            const { accountId } = context.get('authContext');
            const raisedBed = await getRaisedBed(raisedBedIdNumber);
            if (
                !raisedBed ||
                raisedBed.gardenId !== gardenIdNumber ||
                raisedBed.accountId !== accountId
            ) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            const diaryEntries = await getRaisedBedFieldDiaryEntries(
                raisedBedIdNumber,
                positionIndexNumber,
            );
            return context.json(diaryEntries);
        },
    );

export default app;
