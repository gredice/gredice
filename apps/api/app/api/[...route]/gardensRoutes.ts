import { userAllowedPlantStatusTransitions } from '@gredice/js/plants';
import { signalcoClient } from '@gredice/signalco';
import {
    countEventsSince,
    createDefaultGardenForAccount,
    createEvent,
    createGardenBlock,
    createGardenStack,
    deleteGardenStack,
    getAccount,
    getAccountGardens,
    getEvents,
    getGarden,
    getGardenBlocks,
    getGardenStack,
    getOperations,
    getRaisedBed,
    getRaisedBedDiaryEntries,
    getRaisedBedFieldDiaryEntries,
    getRaisedBedIdsByAccount,
    getRaisedBedSensors,
    knownEvents,
    knownEventTypes,
    spendSunflowers,
    deleteGardenBlock as storageDeleteGardenBlock,
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
import { publicSecurity } from '../../../lib/docs/security';
import { resolveGardenBlockPlacement } from '../../../lib/garden/blockPlacementService';
import { deleteGardenBlock } from '../../../lib/garden/gardenBlocksService';
import { synchronizeGardenStacksAndRaisedBeds } from '../../../lib/garden/gardenStacksSyncService';
import { purchaseGardenBlock } from '../../../lib/garden/purchaseGardenBlockService';
import {
    AI_ANALYSIS_DAILY_LIMIT,
    streamRaisedBedImageAnalysis,
    validateImageUrl,
} from '../../../lib/garden/raisedBedAiAnalysisService';
import { calculateRaisedBedsValidity } from '../../../lib/garden/raisedBedsService';
import {
    validateConnectedRaisedBedMove,
    validateRaisedBedPlacement,
    validateStackPlacement,
} from '../../../lib/garden/stacksPatchValidation';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { openAdventGiftBox } from '../../../lib/occasions/adventGiftBox';
import { getPostHogClient } from '../../../lib/posthog-server';

const DEFAULT_TIMEZONE = 'Europe/Paris';

async function countRecentRaisedBedAiAnalyses(accountId: string) {
    const accountBedIds = await getRaisedBedIdsByAccount(accountId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const raisedBedAggregateIds = accountBedIds.map((bedId) =>
        bedId.toString(),
    );
    const raisedBedFieldAggregateIds = accountBedIds.flatMap((bedId) =>
        Array.from(
            { length: 20 },
            (_, index) => `${bedId.toString()}|${index.toString()}`,
        ),
    );

    const [raisedBedCount, raisedBedFieldCount] = await Promise.all([
        countEventsSince(
            knownEventTypes.raisedBeds.aiAnalysis,
            since,
            raisedBedAggregateIds,
        ),
        countEventsSince(
            knownEventTypes.raisedBedFields.aiAnalysis,
            since,
            raisedBedFieldAggregateIds,
        ),
    ]);

    return raisedBedCount + raisedBedFieldCount;
}

async function trackGardenCreated(input: {
    accountId: string;
    gardenId: number;
    name?: string;
    userId: string;
}) {
    await (await getPostHogClient()).capture({
        distinctId: input.userId,
        event: 'garden_created',
        properties: {
            account_id: input.accountId,
            garden_id: input.gardenId,
            has_custom_name: Boolean(input.name?.trim()),
        },
    });
}

function isAppliedRaisedBedOperationStatus(status: string) {
    return status === 'completed' || status === 'pendingVerification';
}

function serializeAppliedRaisedBedOperation(
    operation: Awaited<ReturnType<typeof getOperations>>[number],
) {
    return {
        id: operation.id,
        entityId: operation.entityId,
        raisedBedFieldId: operation.raisedBedFieldId,
        status: operation.status,
        createdAt: operation.createdAt.toISOString(),
        completedAt: operation.completedAt?.toISOString() ?? null,
        scheduledDate: operation.scheduledDate?.toISOString() ?? null,
    };
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
            return context.json(
                gardens.map((garden) => ({
                    id: garden.id,
                    name: garden.name,
                    createdAt: garden.createdAt,
                })),
            );
        },
    )
    .post(
        '/',
        describeRoute({
            description: 'Create a new garden for current account',
        }),
        zValidator(
            'json',
            z.object({
                name: z.string().trim().min(1).optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const { name } = context.req.valid('json');
            const gardenId = await createDefaultGardenForAccount({
                accountId,
                name,
            });
            await trackGardenCreated({ accountId, gardenId, name, userId });
            return context.json({ id: gardenId }, 201);
        },
    )
    .post(
        '/',
        describeRoute({
            description: 'Create a new garden for current account',
        }),
        zValidator(
            'json',
            z.object({
                name: z.string().trim().min(1).optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const { name } = context.req.valid('json');
            const gardenId = await createDefaultGardenForAccount({
                accountId,
                name,
            });
            await trackGardenCreated({ accountId, gardenId, name, userId });
            return context.json({ id: gardenId }, 201);
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
            const [garden, /*blockPlaceEventsRaw,*/ blocks, operations] =
                await Promise.all([
                    getGarden(gardenIdNumber),
                    // getEvents(knownEventTypes.gardens.blockPlace, gardenId, 0, 10000),
                    getGardenBlocks(gardenIdNumber),
                    getOperations(accountId, gardenIdNumber),
                ]);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const blocksById = new Map(
                blocks.map((block) => [block.id, block]),
            );
            const blockNameById = new Map(
                blocks.map((block) => [block.id, block.name] as const),
            );
            const appliedOperationsByRaisedBedId = operations.reduce(
                (acc, operation) => {
                    if (
                        !operation.raisedBedId ||
                        !isAppliedRaisedBedOperationStatus(operation.status)
                    ) {
                        return acc;
                    }

                    const existing = acc.get(operation.raisedBedId) ?? [];
                    existing.push(
                        serializeAppliedRaisedBedOperation(operation),
                    );
                    acc.set(operation.raisedBedId, existing);
                    return acc;
                },
                new Map<
                    number,
                    ReturnType<typeof serializeAppliedRaisedBedOperation>[]
                >(),
            );

            // Stacks: group by x then by y
            const stacks = garden.stacks.reduce(
                (acc, stack) => {
                    if (!acc[stack.positionX]) {
                        acc[stack.positionX] = {};
                    }
                    acc[stack.positionX][stack.positionY] = stack.blocks
                        .map((blockId) => {
                            const block = blocksById.get(blockId);
                            if (!block) return null;

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

            return context.json({
                id: garden.id,
                name: garden.name,
                latitude: garden.farm.latitude,
                longitude: garden.farm.longitude,
                stacks,
                raisedBeds: (() => {
                    const validityMap = calculateRaisedBedsValidity(
                        garden.raisedBeds,
                        garden.stacks,
                        blockNameById,
                    );
                    return garden.raisedBeds.map((raisedBed) => ({
                        id: raisedBed.id,
                        name: raisedBed.name,
                        physicalId: raisedBed.physicalId,
                        blockId: raisedBed.blockId,
                        status: raisedBed.status,
                        orientation: raisedBed.orientation,
                        fields: raisedBed.fields,
                        appliedOperations:
                            appliedOperationsByRaisedBedId.get(raisedBed.id) ??
                            [],
                        createdAt: raisedBed.createdAt,
                        updatedAt: raisedBed.updatedAt,
                        isValid: validityMap.get(raisedBed.id) ?? false,
                    }));
                })(),
                createdAt: garden.createdAt,
            });
        },
    )
    .get(
        '/:gardenId/public',
        describeRoute({
            description: 'Get public garden information',
            security: publicSecurity,
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
            const blockNamesById = new Map(
                blockPlaceEvents.map((event) => [
                    event.data.id,
                    event.data.name,
                ]),
            );
            const blocksById = new Map(
                blocks.map((block) => [block.id, block]),
            );

            // Stacks: group by x then by y
            const stacks = garden.stacks.reduce(
                (acc, stack) => {
                    if (!acc[stack.positionX]) {
                        acc[stack.positionX] = {};
                    }
                    acc[stack.positionX][stack.positionY] = stack.blocks.map(
                        (blockId) => ({
                            id: blockId,
                            name: blockNamesById.get(blockId) ?? 'unknown',
                            rotation: blocksById.get(blockId)?.rotation ?? 0,
                            variant: blocksById.get(blockId)?.variant,
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

            const [gardenBlocks, blockData] = await Promise.all([
                getGardenBlocks(gardenIdNumber),
                getBlockData(),
            ]);
            const blockNameById = new Map(
                gardenBlocks.map((block) => [block.id, block.name]),
            );
            const blockDataByName = new Map(
                blockData.map((block) => [block.information.name, block]),
            );

            const validateStackPlacementForGarden = (blockIds: string[]) =>
                validateStackPlacement({
                    blockIds,
                    blockNameById,
                    blockDataByName,
                });

            const operations = context.req.valid('json');
            if (operations.length === 0) {
                return context.json({ error: 'No operations provided' }, 400);
            }
            const initialGardenState = garden;

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

            async function addStack(
                path: string,
                value: string | string[],
                options?: { skipRaisedBedPlacementValidation?: boolean },
            ) {
                const stackPosition = parsePath(path);

                console.debug(
                    `Adding stack at position x:${stackPosition.x} y:${stackPosition.y} index:${stackPosition.index} append:${stackPosition.append} with value:`,
                    value,
                );

                // Create stack if doesn't exist
                const existing = await getGardenStack(
                    gardenIdNumber,
                    stackPosition,
                );
                if (!existing) {
                    await createGardenStack(gardenIdNumber, stackPosition);
                }

                if (stackPosition.index === undefined) {
                    if (
                        typeof value === 'string' &&
                        !options?.skipRaisedBedPlacementValidation
                    ) {
                        const blockName = blockNameById.get(value);
                        if (blockName === 'Raised_Bed') {
                            const gardenState = await getGarden(gardenIdNumber);
                            if (!gardenState) {
                                return context.json(
                                    { error: 'Garden not found' },
                                    404,
                                );
                            }

                            const targetIndex = stackPosition.append
                                ? (existing?.blocks.length ?? 0)
                                : 0;
                            const placementValidation =
                                validateRaisedBedPlacement({
                                    stacks: gardenState.stacks,
                                    x: stackPosition.x,
                                    y: stackPosition.y,
                                    index: targetIndex,
                                    blockNameById,
                                });
                            if (!placementValidation.valid) {
                                return context.json(
                                    { error: placementValidation.error },
                                    400,
                                );
                            }
                        }
                    }

                    const nextBlocks = Array.isArray(value)
                        ? stackPosition.append
                            ? [...(existing?.blocks ?? []), ...value]
                            : value
                        : stackPosition.append
                          ? [...(existing?.blocks ?? []), value]
                          : [value];

                    const validation =
                        validateStackPlacementForGarden(nextBlocks);
                    if (!validation.valid) {
                        return context.json({ error: validation.error }, 400);
                    }

                    if (Array.isArray(value)) {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: nextBlocks,
                        });
                    } else {
                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: nextBlocks,
                        });
                    }
                } else {
                    if (
                        typeof value === 'string' &&
                        !options?.skipRaisedBedPlacementValidation
                    ) {
                        const blockName = blockNameById.get(value);
                        if (blockName === 'Raised_Bed') {
                            const gardenState = await getGarden(gardenIdNumber);
                            if (!gardenState) {
                                return context.json(
                                    { error: 'Garden not found' },
                                    404,
                                );
                            }

                            const placementValidation =
                                validateRaisedBedPlacement({
                                    stacks: gardenState.stacks,
                                    x: stackPosition.x,
                                    y: stackPosition.y,
                                    index: stackPosition.index,
                                    blockNameById,
                                });
                            if (!placementValidation.valid) {
                                return context.json(
                                    { error: placementValidation.error },
                                    400,
                                );
                            }
                        }
                    }

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
                        const nextBlocks = [
                            ...existing.blocks.slice(0, stackPosition.index),
                            ...value,
                            ...existing.blocks.slice(stackPosition.index),
                        ];

                        const validation =
                            validateStackPlacementForGarden(nextBlocks);
                        if (!validation.valid) {
                            return context.json(
                                { error: validation.error },
                                400,
                            );
                        }

                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: nextBlocks,
                        });
                    } else {
                        const nextBlocks = [
                            ...existing.blocks.slice(0, stackPosition.index),
                            value,
                            ...existing.blocks.slice(stackPosition.index),
                        ];

                        const validation =
                            validateStackPlacementForGarden(nextBlocks);
                        if (!validation.valid) {
                            return context.json(
                                { error: validation.error },
                                400,
                            );
                        }

                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: nextBlocks,
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

                        const validation =
                            validateStackPlacementForGarden(value);
                        if (!validation.valid) {
                            return context.json(
                                { error: validation.error },
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

                        const nextBlocks = stack.blocks.map((blockId, index) =>
                            index === stackPosition.index ? value : blockId,
                        );

                        const validation =
                            validateStackPlacementForGarden(nextBlocks);
                        if (!validation.valid) {
                            return context.json(
                                { error: validation.error },
                                400,
                            );
                        }

                        await updateGardenStack(gardenIdNumber, {
                            x: stackPosition.x,
                            y: stackPosition.y,
                            blocks: nextBlocks,
                        });
                    }
                } else if (operation.op === 'move') {
                    const { path, from } = operation;
                    const fromPosition = parsePath(from);
                    const fromStack = await getStack(from);
                    if (!fromStack) {
                        return context.json(
                            { error: `Stack from:${from} not found` },
                            400,
                        );
                    }
                    const fromValue =
                        fromPosition.index === undefined
                            ? fromStack.blocks
                            : fromStack.blocks[fromPosition.index];

                    if (typeof fromValue === 'string') {
                        const validation = validateConnectedRaisedBedMove({
                            stacks: initialGardenState.stacks,
                            fromPath: from,
                            toPath: path,
                            movedBlockId: fromValue,
                            blockNameById,
                            blockDataByName,
                            parsePath,
                        });
                        if (!validation.valid) {
                            return context.json(
                                { error: validation.error },
                                400,
                            );
                        }
                    }

                    let resp = await addStack(path, fromValue, {
                        skipRaisedBedPlacementValidation: true,
                    });
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
                            { error: `Stack from:${from} not found` },
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

            await synchronizeGardenStacksAndRaisedBeds(gardenIdNumber);

            return context.json(null, 200);
        },
    )
    .post(
        '/:gardenId/blocks/:blockId/open-gift-box',
        describeRoute({
            description: 'Open an advent gift box and receive a reward.',
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
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber) || gardenIdNumber <= 0) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const account = await getAccount(accountId);
            const timeZone = account?.timeZone ?? DEFAULT_TIMEZONE;

            const result = await openAdventGiftBox({
                accountId,
                gardenId: gardenIdNumber,
                blockId,
                timeZone,
            });

            if ('errorStatus' in result) {
                return context.json(
                    { error: result.errorMessage },
                    result.errorStatus as ContentfulStatusCode,
                );
            }

            await synchronizeGardenStacksAndRaisedBeds(gardenIdNumber);

            return context.json({ reward: result.reward }, 200);
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
                position: z
                    .object({
                        x: z.number().int(),
                        y: z.number().int(),
                    })
                    .optional(),
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

            const [garden, gardenBlocks, blockData] = await Promise.all([
                getGarden(gardenIdNumber),
                getGardenBlocks(gardenIdNumber),
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

            const { blockName, position } = context.req.valid('json');

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

            const blockNameById = new Map(
                gardenBlocks.map((block) => [block.id, block.name] as const),
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
                requestedPosition: position,
            });
            if (!placement.valid) {
                return context.json({ error: placement.error }, 400);
            }

            const { x, y, existingBlocks } = placement.placement;
            const hasTargetStack = garden.stacks.some(
                (stack) => stack.positionX === x && stack.positionY === y,
            );
            const purchaseResult = await purchaseGardenBlock({
                accountId,
                blockName,
                cost,
                dependencies: {
                    createGardenBlock,
                    createGardenStack,
                    deleteGardenBlock: storageDeleteGardenBlock,
                    spendSunflowers,
                    synchronizeGardenStacksAndRaisedBeds,
                    updateGardenStack,
                },
                gardenId: gardenIdNumber,
                hasTargetStack,
                placement: {
                    x,
                    y,
                    existingBlocks,
                },
            });
            if (!purchaseResult.ok) {
                return context.json(
                    { error: purchaseResult.error },
                    purchaseResult.status,
                );
            }

            return context.json({
                id: purchaseResult.blockId,
                position: purchaseResult.position,
            });
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

            await synchronizeGardenStacksAndRaisedBeds(gardenIdNumber);

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
            const [garden, blocks] = await Promise.all([
                getGarden(gardenIdNumber),
                getGardenBlocks(gardenIdNumber),
            ]);
            if (!garden || garden.accountId !== accountId) {
                return context.json(
                    {
                        error: 'Garden not found',
                    },
                    404,
                );
            }

            const blockNameById = new Map(
                blocks.map((block) => [block.id, block.name] as const),
            );
            const validityMap = calculateRaisedBedsValidity(
                garden.raisedBeds,
                garden.stacks,
                blockNameById,
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
            const [garden, blocks] = await Promise.all([
                getGarden(gardenIdNumber),
                getGardenBlocks(gardenIdNumber),
            ]);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }
            const raisedBed = garden.raisedBeds.find(
                (rb) => rb.id === raisedBedIdNumber,
            );
            if (!raisedBed) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }
            const blockNameById = new Map(
                blocks.map((block) => [block.id, block.name] as const),
            );
            const validityMap = calculateRaisedBedsValidity(
                garden.raisedBeds,
                garden.stacks,
                blockNameById,
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
    .post(
        '/:gardenId/raised-beds/:raisedBedId/analyze-image',
        describeRoute({
            description:
                'Analyze raised bed image with AI and save response to diary',
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
                imageUrl: z.url(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId } = context.req.valid('param');
            const { imageUrl } = context.req.valid('json');

            const urlError = validateImageUrl(imageUrl);
            if (urlError) {
                return context.json({ error: urlError }, 400);
            }

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

            const recentCount = await countRecentRaisedBedAiAnalyses(accountId);
            if (recentCount >= AI_ANALYSIS_DAILY_LIMIT) {
                return context.json(
                    {
                        error: `Daily AI analysis limit reached (${AI_ANALYSIS_DAILY_LIMIT.toString()}/day). Try again tomorrow.`,
                    },
                    429,
                );
            }

            if (!process.env.AI_GATEWAY_API_KEY) {
                return context.json(
                    { error: 'AI_GATEWAY_API_KEY is not configured' },
                    500,
                );
            }

            const result = await streamRaisedBedImageAnalysis(
                {
                    accountId,
                    gardenId: gardenIdNumber,
                    raisedBed,
                    imageUrl,
                },
                async (analysis) => {
                    await createEvent(
                        knownEvents.raisedBeds.aiAnalysisV1(
                            raisedBedIdNumber.toString(),
                            {
                                markdown: analysis.markdown,
                                imageUrl,
                                model: analysis.model,
                                analyzedAt: analysis.analyzedAt,
                                inputTokens: analysis.inputTokens,
                                outputTokens: analysis.outputTokens,
                                totalTokens: analysis.totalTokens,
                            },
                        ),
                    );
                },
            );

            return result.toTextStreamResponse();
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
                timestamp: z.string().datetime().optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const { status, timestamp } = context.req.valid('json');

            // Build reverse lookup: target status → allowed source statuses
            const allowedTargetStatuses = new Set([
                ...Object.values(userAllowedPlantStatusTransitions).flat(),
                'removed',
            ]);

            if (!allowedTargetStatuses.has(status)) {
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

            // Validate state transition for user-allowed statuses
            // Find allowed source states by looking up which current statuses can transition to the target
            const allowedFromStates = Object.entries(
                userAllowedPlantStatusTransitions,
            )
                .filter(([, targets]) => targets.includes(status))
                .map(([source]) => source);
            if (
                allowedFromStates.length > 0 &&
                (!field.plantStatus ||
                    !allowedFromStates.includes(field.plantStatus))
            ) {
                return context.json(
                    {
                        error: `Cannot change from '${field.plantStatus}' to '${status}'. Allowed source states: ${allowedFromStates.join(', ')}`,
                    },
                    400,
                );
            }

            // Validate timestamp if provided
            let createdAt: Date | undefined;
            if (timestamp) {
                createdAt = new Date(timestamp);
                if (Number.isNaN(createdAt.getTime())) {
                    return context.json({ error: 'Invalid timestamp' }, 400);
                }
            }

            // Call the storage function to create the event and update the plant status
            try {
                const event = knownEvents.raisedBedFields.plantUpdateV1(
                    `${raisedBedIdNumber.toString()}|${positionIndexNumber.toString()}`,
                    { status: status },
                );

                await createEvent({
                    ...event,
                    ...(createdAt && { createdAt }),
                });

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
    .post(
        '/:gardenId/raised-beds/:raisedBedId/fields/:positionIndex/analyze-image',
        describeRoute({
            description:
                'Analyze raised bed field image with AI and save response to diary',
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
                imageUrl: z.url(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const { imageUrl } = context.req.valid('json');

            // Validate image URL against allowed hosts
            const urlError = validateImageUrl(imageUrl);
            if (urlError) {
                return context.json({ error: urlError }, 400);
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

            const { accountId } = context.get('authContext');
            const raisedBed = await getRaisedBed(raisedBedIdNumber);
            if (
                !raisedBed ||
                raisedBed.gardenId !== gardenIdNumber ||
                raisedBed.accountId !== accountId
            ) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            const field = raisedBed.fields.find(
                (value) =>
                    value.positionIndex === positionIndexNumber &&
                    value.active &&
                    value.plantSortId,
            );
            if (!field) {
                return context.json(
                    {
                        error: 'Field not found or does not have an active plant',
                    },
                    404,
                );
            }

            const recentCount = await countRecentRaisedBedAiAnalyses(accountId);
            if (recentCount >= AI_ANALYSIS_DAILY_LIMIT) {
                return context.json(
                    {
                        error: `Daily AI analysis limit reached (${AI_ANALYSIS_DAILY_LIMIT.toString()}/day). Try again tomorrow.`,
                    },
                    429,
                );
            }

            if (!process.env.AI_GATEWAY_API_KEY) {
                return context.json(
                    { error: 'AI_GATEWAY_API_KEY is not configured' },
                    500,
                );
            }

            const result = await streamRaisedBedImageAnalysis(
                {
                    accountId,
                    gardenId: gardenIdNumber,
                    raisedBed,
                    positionIndex: positionIndexNumber,
                    imageUrl,
                },
                async (analysis) => {
                    await createEvent(
                        knownEvents.raisedBedFields.aiAnalysisV1(
                            `${raisedBedIdNumber.toString()}|${positionIndexNumber.toString()}`,
                            {
                                markdown: analysis.markdown,
                                imageUrl,
                                model: analysis.model,
                                analyzedAt: analysis.analyzedAt,
                                inputTokens: analysis.inputTokens,
                                outputTokens: analysis.outputTokens,
                                totalTokens: analysis.totalTokens,
                            },
                        ),
                    );
                },
            );

            return result.toTextStreamResponse();
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
