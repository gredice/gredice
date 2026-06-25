import { gameBackgroundPaletteKeys } from '@gredice/js/gameBackground';
import { userAllowedPlantStatusTransitions } from '@gredice/js/plants';
import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDON_OPERATION_ENTITY_ID,
    RAISED_BED_OPERATION_ENTITY_TYPE_NAME,
} from '@gredice/js/raisedBeds';
import { notifyOperationUpdate } from '@gredice/notifications';
import { signalcoClient } from '@gredice/signalco';
import {
    abandonRaisedBed,
    addGardenBoxInventoryItem,
    buildRaisedBedFieldPlantUpdatePayload,
    cancelGardenDiaryOperation,
    cancelGardenDiaryRaisedBedField,
    clearSandboxField,
    countAiRequestEventsSince,
    countRaisedBedsByAccount,
    createDefaultGardenForAccount,
    createEvent,
    createGardenBlock,
    createGardenStack,
    createSandboxGarden,
    deleteGardenStack,
    deleteSandboxGardenCompletely,
    type EntityStandardized,
    GardenBoxInventoryLimitError,
    GardenDiaryCancelError,
    GardenDiaryRescheduleError,
    getAccount,
    getAccountGardensMetadata,
    getAllEvents,
    getAppliedRaisedBedOperationsForGarden,
    getEntitiesFormatted,
    getGarden,
    getGardenBlocks,
    getGardenStack,
    getGardenStackForUpdate,
    getGardenVisitState,
    getOperationsPage,
    getRaisedBed,
    getRaisedBedAiHistoryEntries,
    getRaisedBedDiaryEntries,
    getRaisedBedFieldDiaryEntries,
    getRaisedBedIdsByAccount,
    getRaisedBedSensors,
    getSandboxGardenDeletionCandidate,
    knownEvents,
    knownEventTypes,
    markGardenVisitSummarySeen,
    rescheduleGardenDiaryOperation,
    rescheduleGardenDiaryRaisedBedField,
    sowSandboxField,
    spendSunflowers,
    storage,
    deleteGardenBlock as storageDeleteGardenBlock,
    updateGarden,
    updateGardenBlock,
    updateGardenStack,
    updateRaisedBed,
    upsertGardenOpenedAt,
} from '@gredice/storage';
import { type Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { getBlockData } from '../../../lib/blocks/blockDataService';
import { authSecurity, publicSecurity } from '../../../lib/docs/security';
import {
    isAppliedOperationCurrentForRaisedBedFields,
    serializeAppliedRaisedBedOperation,
} from '../../../lib/garden/appliedRaisedBedOperations';
import { resolveGardenBlockPlacement } from '../../../lib/garden/blockPlacementService';
import { deleteGardenBlock } from '../../../lib/garden/gardenBlocksService';
import { synchronizeGardenStacksAndRaisedBeds } from '../../../lib/garden/gardenStacksSyncService';
import {
    generateGardenVisitSummaryFacts,
    hashGardenVisitSummaryFacts,
} from '../../../lib/garden/gardenVisitSummaryService';
import { isBlockPurchaseAvailableNow } from '../../../lib/garden/nightOnlyBlockPurchases';
import { purchaseGardenBlock } from '../../../lib/garden/purchaseGardenBlockService';
import {
    AI_REQUEST_QUOTAS,
    AI_REQUEST_WEEKLY_LIMIT_PER_ACTIVE_RAISED_BED,
    type AiRequestKind,
    getRaisedBedImageAnalysisWeeklyLimit,
    normalizeAnalysisReferenceDate,
    RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND,
    streamRaisedBedImageAnalysis,
    validateImageUrls,
} from '../../../lib/garden/raisedBedAiAnalysisService';
import { calculateRaisedBedsValidity } from '../../../lib/garden/raisedBedsService';
import {
    validateConnectedRaisedBedMove,
    validateRaisedBedPlacement,
    validateSpanningBlockMove,
    validateStackPlacement,
} from '../../../lib/garden/stacksPatchValidation';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { queryBooleanSchema } from '../../../lib/http/queryBoolean';
import { openAdventGiftBox } from '../../../lib/occasions/adventGiftBox';
import { getPostHogClient } from '../../../lib/posthog-server';

const DEFAULT_TIMEZONE = 'Europe/Paris';

const analyzeImageBodySchema = z
    .object({
        imageUrl: z.url().optional(),
        imageUrls: z.array(z.url()).min(1).optional(),
        referenceDate: z.iso.datetime().optional(),
    })
    .refine((body) => Boolean(body.imageUrl || body.imageUrls?.length), {
        message: 'At least one image URL is required',
    });

type AnalyzeImageBody = z.infer<typeof analyzeImageBodySchema>;

const storeBlockInGardenBoxBodySchema = z.object({
    gardenBoxBlockId: z.string().trim().min(1).max(128),
    sourcePosition: z.object({
        x: z.number().int(),
        z: z.number().int(),
    }),
    blockIndex: z.number().int().min(0),
});

const rescheduleDiaryItemBodySchema = z.object({
    scheduledDate: z.string().trim().min(1),
});

const visitSummarySeenBodySchema = z.object({
    factsHash: z.string().trim().min(1).max(128).nullable().optional(),
});

function normalizeAnalysisImageUrls(body: AnalyzeImageBody) {
    const imageUrls = body.imageUrls?.length
        ? body.imageUrls
        : body.imageUrl
          ? [body.imageUrl]
          : [];

    return Array.from(new Set(imageUrls));
}

function getAnalysisReferenceDate(body: AnalyzeImageBody) {
    return normalizeAnalysisReferenceDate(body.referenceDate);
}

function diaryRescheduleErrorResponse(
    context: Context,
    error: GardenDiaryRescheduleError,
) {
    switch (error.statusCode) {
        case 400:
            return context.json({ error: error.message }, 400);
        case 404:
            return context.json({ error: error.message }, 404);
        case 409:
            return context.json({ error: error.message }, 409);
    }
}

function diaryCancelErrorResponse(
    context: Context,
    error: GardenDiaryCancelError,
) {
    switch (error.statusCode) {
        case 400:
            return context.json({ error: error.message }, 400);
        case 404:
            return context.json({ error: error.message }, 404);
        case 409:
            return context.json({ error: error.message }, 409);
    }
}

const aiTextStreamResponseInit = {
    headers: {
        'Cache-Control': 'no-cache, no-transform',
        'Content-Encoding': 'none',
        Connection: 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
    },
} satisfies ResponseInit;

async function countRecentAiRequests(
    accountId: string,
    requestKind: AiRequestKind,
) {
    const quota = AI_REQUEST_QUOTAS[requestKind];
    const since = new Date(Date.now() - quota.windowMs);

    switch (requestKind) {
        case RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND:
            return countRecentRaisedBedImageAnalyses(accountId, since);
    }

    const unreachable: never = requestKind;
    throw new Error(`Unsupported AI request kind: ${unreachable}`);
}

async function getAiRequestQuotaUsage(
    accountId: string,
    requestKind: AiRequestKind,
) {
    const quota = AI_REQUEST_QUOTAS[requestKind];
    const [used, limitDetails] = await Promise.all([
        countRecentAiRequests(accountId, requestKind),
        getAiRequestQuotaLimit(accountId, requestKind),
    ]);

    return {
        ...quota,
        ...limitDetails,
        used,
        remaining: Math.max(0, limitDetails.limit - used),
    };
}

async function getAiRequestQuotaLimit(
    accountId: string,
    requestKind: AiRequestKind,
) {
    switch (requestKind) {
        case RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND: {
            const activeRaisedBedCount = await countRaisedBedsByAccount(
                accountId,
                { status: 'active' },
            );

            return {
                activeRaisedBedCount,
                limit: getRaisedBedImageAnalysisWeeklyLimit(
                    activeRaisedBedCount,
                ),
                limitPerActiveRaisedBed:
                    AI_REQUEST_WEEKLY_LIMIT_PER_ACTIVE_RAISED_BED,
            };
        }
    }

    const unreachable: never = requestKind;
    throw new Error(`Unsupported AI request kind: ${unreachable}`);
}

type AiRequestQuotaUsage = Awaited<ReturnType<typeof getAiRequestQuotaUsage>>;

function formatAiQuotaExceededError(aiQuota: AiRequestQuotaUsage) {
    if (aiQuota.activeRaisedBedCount === 0) {
        return 'AI savjeti dostupni su za aktivne gredice. Aktivirajte gredicu pa pokušajte ponovno.';
    }

    return `Iskoristili ste tjedni limit AI savjeta (${aiQuota.used.toString()}/${aiQuota.limit.toString()}). Za svaku aktivnu gredicu dostupno je ${aiQuota.limitPerActiveRaisedBed.toString()} savjeta tjedno. Pokušajte ponovno kasnije.`;
}

async function countRecentRaisedBedImageAnalyses(
    accountId: string,
    since: Date,
) {
    const accountBedIds = await getRaisedBedIdsByAccount(accountId);
    const raisedBedAggregateIds = accountBedIds.map((bedId) =>
        bedId.toString(),
    );
    const raisedBedFieldAggregateIds = accountBedIds.flatMap((bedId) =>
        Array.from(
            { length: 20 },
            (_, index) => `${bedId.toString()}|${index.toString()}`,
        ),
    );

    return countAiRequestEventsSince({
        type: knownEventTypes.accounts.aiRequest,
        legacyType: [
            knownEventTypes.raisedBeds.aiAnalysis,
            knownEventTypes.raisedBedFields.aiAnalysis,
        ],
        since,
        accountId,
        requestKind: RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND,
        legacyAggregateIds: [
            ...raisedBedAggregateIds,
            ...raisedBedFieldAggregateIds,
        ],
    });
}

async function recordAiRequest(accountId: string, requestKind: AiRequestKind) {
    await createEvent(
        knownEvents.accounts.aiRequestV1(accountId, {
            accountId,
            aiRequestKind: requestKind,
            requestedAt: new Date().toISOString(),
        }),
    );
}

async function trackGardenCreated(input: {
    accountId: string;
    gardenId: number;
    name?: string;
    userId: string;
    isSandbox?: boolean;
}) {
    await (await getPostHogClient()).capture({
        distinctId: input.userId,
        event: 'garden_created',
        properties: {
            account_id: input.accountId,
            garden_id: input.gardenId,
            has_custom_name: Boolean(input.name?.trim()),
            is_sandbox: Boolean(input.isSandbox),
        },
    });
}

function isAppliedRaisedBedOperationStatus(status: string) {
    return status === 'completed' || status === 'pendingVerification';
}

function serializeGardenOperation(
    operation: Awaited<ReturnType<typeof getOperationsPage>>['items'][number],
    targetsByRaisedBedFieldId: Map<number, string>,
    targetsByRaisedBedId: Map<number, string>,
) {
    const hasAssignedUser = (operation.assignedUserIds?.length ?? 0) > 0;
    const isAssigned = operation.status === 'planned' && hasAssignedUser;
    const isConfirmed = isAssigned && operation.isAccepted;
    const timelineStatus = isConfirmed
        ? 'confirmed'
        : isAssigned
          ? 'assigned'
          : operation.status;

    const statusHistory = [
        {
            status: 'new',
            changedAt: operation.createdAt.toISOString(),
        },
        operation.scheduledDate
            ? {
                  status: 'planned',
                  changedAt:
                      operation.scheduledAt?.toISOString() ??
                      operation.scheduledDate.toISOString(),
              }
            : null,
        isAssigned
            ? {
                  status: 'assigned',
                  changedAt:
                      operation.assignedAt?.toISOString() ??
                      operation.scheduledAt?.toISOString() ??
                      operation.createdAt.toISOString(),
              }
            : null,
        isConfirmed
            ? {
                  status: 'confirmed',
                  changedAt:
                      operation.assignedAt?.toISOString() ??
                      operation.scheduledAt?.toISOString() ??
                      operation.createdAt.toISOString(),
              }
            : null,
        operation.completedAt
            ? {
                  status: 'pendingVerification',
                  changedAt: operation.completedAt.toISOString(),
              }
            : null,
        operation.verifiedAt
            ? {
                  status: 'completed',
                  changedAt: operation.verifiedAt.toISOString(),
              }
            : null,
        operation.canceledAt
            ? {
                  status: 'canceled',
                  changedAt: operation.canceledAt.toISOString(),
              }
            : null,
    ].filter(Boolean);

    return {
        id: operation.id,
        entityId: operation.entityId,
        raisedBedId: operation.raisedBedId,
        raisedBedFieldId: operation.raisedBedFieldId,
        status: timelineStatus,
        createdAt: operation.createdAt.toISOString(),
        scheduledDate: operation.scheduledDate?.toISOString() ?? null,
        scheduledAt: operation.scheduledAt?.toISOString() ?? null,
        completedAt: operation.completedAt?.toISOString() ?? null,
        verifiedAt: operation.verifiedAt?.toISOString() ?? null,
        canceledAt: operation.canceledAt?.toISOString() ?? null,
        imageUrls: operation.imageUrls ?? [],
        completionNotes: operation.completionNotes ?? null,
        targetLabel:
            (operation.raisedBedFieldId
                ? targetsByRaisedBedFieldId.get(operation.raisedBedFieldId)
                : null) ??
            (operation.raisedBedId
                ? targetsByRaisedBedId.get(operation.raisedBedId)
                : null) ??
            'Vrt',
        statusHistory,
    };
}

function serializeGardenVisitState(
    state: Awaited<ReturnType<typeof getGardenVisitState>>,
) {
    if (!state) {
        return null;
    }

    return {
        userId: state.userId,
        accountId: state.accountId,
        gardenId: state.gardenId,
        lastOpenedAt: state.lastOpenedAt?.toISOString() ?? null,
        lastSummarySeenAt: state.lastSummarySeenAt?.toISOString() ?? null,
        lastSummaryFactsHash: state.lastSummaryFactsHash ?? null,
        createdAt: state.createdAt.toISOString(),
        updatedAt: state.updatedAt.toISOString(),
    };
}

function serializeGardenVisitSummaryWindow(input: {
    firstVisit: boolean;
    since: Date | null;
    until: Date;
}) {
    return {
        firstVisit: input.firstVisit,
        since: input.since?.toISOString() ?? null,
        until: input.until.toISOString(),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getAbandonReason(data: unknown) {
    if (!isRecord(data) || typeof data.reason !== 'string') {
        return null;
    }

    return data.reason;
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
            const gardens = await getAccountGardensMetadata(accountId);
            return context.json(
                gardens.map((garden) => ({
                    id: garden.id,
                    name: garden.name,
                    isSandbox: garden.isSandbox,
                    backgroundPalette: garden.backgroundPalette,
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
                isSandbox: z.boolean().optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { accountId, userId } = context.get('authContext');
            const { name, isSandbox } = context.req.valid('json');
            const gardenId = isSandbox
                ? await createSandboxGarden({ accountId, name })
                : await createDefaultGardenForAccount({ accountId, name });
            await trackGardenCreated({
                accountId,
                gardenId,
                name,
                userId,
                isSandbox,
            });
            return context.json({ id: gardenId }, 201);
        },
    )
    .get(
        '/:gardenId/operations',
        describeRoute({
            description:
                'Get garden operations for timeline and history with cursor pagination and optional raised bed or field filters',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator(
            'query',
            z.object({
                cursor: z.coerce.number().int().min(0).optional(),
                limit: z.coerce.number().int().min(1).max(50).optional(),
                includeCompleted: queryBooleanSchema.optional(),
                raisedBedId: z.coerce.number().int().min(1).optional(),
                raisedBedFieldId: z.coerce.number().int().min(1).optional(),
                positionIndex: z.coerce.number().int().min(0).optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const {
                cursor,
                limit,
                includeCompleted,
                raisedBedId,
                raisedBedFieldId,
                positionIndex,
            } = context.req.valid('query');
            const gardenIdNumber = Number.parseInt(gardenId, 10);

            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);

            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const scopedRaisedBed = raisedBedId
                ? garden.raisedBeds.find(
                      (raisedBed) => raisedBed.id === raisedBedId,
                  )
                : undefined;

            if (raisedBedId && !scopedRaisedBed) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            if (positionIndex !== undefined && !raisedBedId) {
                return context.json(
                    { error: 'raisedBedId is required with positionIndex' },
                    400,
                );
            }

            const positionFieldIds =
                scopedRaisedBed && positionIndex !== undefined
                    ? scopedRaisedBed.fields
                          .filter(
                              (field) => field.positionIndex === positionIndex,
                          )
                          .map((field) => field.id)
                    : undefined;
            const raisedBedFieldIds = raisedBedFieldId
                ? [raisedBedFieldId]
                : positionFieldIds;

            if (
                positionIndex !== undefined &&
                raisedBedFieldIds?.length === 0
            ) {
                return context.json({
                    items: [],
                    nextCursor: null,
                    total: 0,
                });
            }

            const operationsPage = await getOperationsPage({
                accountId,
                gardenId: gardenIdNumber,
                raisedBedId,
                raisedBedFieldIds,
                cursor,
                limit,
                includeCompleted,
            });

            const targetsByRaisedBedId = new Map(
                garden.raisedBeds.map((raisedBed) => [
                    raisedBed.id,
                    `Gredica: ${raisedBed.name}`,
                ]),
            );
            const targetsByRaisedBedFieldId = new Map(
                garden.raisedBeds.flatMap((raisedBed) =>
                    raisedBed.fields.map((field) => [
                        field.id,
                        `Polje ${field.positionIndex + 1} • ${raisedBed.name}`,
                    ]),
                ),
            );

            return context.json({
                items: operationsPage.items.map((operation) =>
                    serializeGardenOperation(
                        operation,
                        targetsByRaisedBedFieldId,
                        targetsByRaisedBedId,
                    ),
                ),
                nextCursor: operationsPage.nextCursor,
                total: operationsPage.total,
            });
        },
    )
    .post(
        '/:gardenId/operations/:operationId/reschedule',
        describeRoute({
            description:
                'Reschedule a planned in-game diary operation for the current user',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                operationId: z.string(),
            }),
        ),
        zValidator('json', rescheduleDiaryItemBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, operationId } = context.req.valid('param');
            const { scheduledDate } = context.req.valid('json');
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            const operationIdNumber = Number.parseInt(operationId, 10);

            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            if (Number.isNaN(operationIdNumber)) {
                return context.json({ error: 'Invalid operation ID' }, 400);
            }

            const { accountId } = context.get('authContext');

            try {
                const result = await rescheduleGardenDiaryOperation({
                    accountId,
                    gardenId: gardenIdNumber,
                    operationId: operationIdNumber,
                    scheduledDate,
                });

                await notifyOperationUpdate(operationIdNumber, 'rescheduled', {
                    scheduledDate: result.scheduledDate.toISOString(),
                });

                return context.json(
                    { scheduledDate: result.scheduledDate.toISOString() },
                    200,
                );
            } catch (error) {
                if (error instanceof GardenDiaryRescheduleError) {
                    return diaryRescheduleErrorResponse(context, error);
                }

                console.error('Failed to reschedule diary operation', {
                    accountId,
                    error,
                    gardenId: gardenIdNumber,
                    operationId: operationIdNumber,
                    scheduledDate,
                });
                return context.json(
                    { error: 'Failed to reschedule operation' },
                    500,
                );
            }
        },
    )
    .post(
        '/:gardenId/operations/:operationId/cancel',
        describeRoute({
            description:
                'Cancel a planned in-game diary operation for the current user and refund sunflowers',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                operationId: z.string(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, operationId } = context.req.valid('param');
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            const operationIdNumber = Number.parseInt(operationId, 10);

            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            if (Number.isNaN(operationIdNumber)) {
                return context.json({ error: 'Invalid operation ID' }, 400);
            }

            const { accountId, userId } = context.get('authContext');

            try {
                const result = await cancelGardenDiaryOperation({
                    accountId,
                    canceledBy: userId,
                    gardenId: gardenIdNumber,
                    operationId: operationIdNumber,
                });

                await notifyOperationUpdate(operationIdNumber, 'canceled', {
                    canceledBy: userId,
                    reason: result.reason,
                });

                return context.json({ refundAmount: result.refundAmount }, 200);
            } catch (error) {
                if (error instanceof GardenDiaryCancelError) {
                    return diaryCancelErrorResponse(context, error);
                }

                console.error('Failed to cancel diary operation', {
                    accountId,
                    error,
                    gardenId: gardenIdNumber,
                    operationId: operationIdNumber,
                    userId,
                });
                return context.json(
                    { error: 'Failed to cancel operation' },
                    500,
                );
            }
        },
    )
    .get(
        '/:gardenId/visit-state',
        describeRoute({
            description:
                'Get the current user garden visit marker without advancing it.',
            security: authSecurity,
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

            const { accountId, userId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const state = await getGardenVisitState({
                userId,
                accountId,
                gardenId: gardenIdNumber,
            });

            return context.json({ state: serializeGardenVisitState(state) });
        },
    )
    .get(
        '/:gardenId/visit-summary',
        describeRoute({
            description:
                'Generate reliable current-user garden facts since the previous visit marker.',
            security: authSecurity,
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

            const { accountId, userId } = context.get('authContext');
            const [garden, visitState] = await Promise.all([
                getGarden(gardenIdNumber),
                getGardenVisitState({
                    userId,
                    accountId,
                    gardenId: gardenIdNumber,
                }),
            ]);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const until = new Date();
            const since = visitState?.lastOpenedAt ?? null;
            const window = serializeGardenVisitSummaryWindow({
                firstVisit: !since,
                since,
                until,
            });

            if (!since) {
                return context.json({
                    window,
                    facts: [],
                    factsHash: null,
                    state: serializeGardenVisitState(visitState),
                });
            }

            const [operations, plantSorts] = await Promise.all([
                getAppliedRaisedBedOperationsForGarden(
                    accountId,
                    gardenIdNumber,
                ),
                getEntitiesFormatted<EntityStandardized>('plantSort'),
            ]);
            const facts = generateGardenVisitSummaryFacts({
                garden,
                operations,
                plantSorts,
                window: { since, until },
            });

            return context.json({
                window,
                facts,
                factsHash: hashGardenVisitSummaryFacts(facts),
                state: serializeGardenVisitState(visitState),
            });
        },
    )
    .post(
        '/:gardenId/visit-state/opened',
        describeRoute({
            description:
                'Advance the current user garden opened marker after the opening flow is complete.',
            security: authSecurity,
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

            const { accountId, userId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const state = await upsertGardenOpenedAt({
                userId,
                accountId,
                gardenId: gardenIdNumber,
            });

            return context.json({ state: serializeGardenVisitState(state) });
        },
    )
    .post(
        '/:gardenId/visit-summary/seen',
        describeRoute({
            description:
                'Mark the current user garden visit summary as seen and advance the visit marker.',
            security: authSecurity,
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator('json', visitSummarySeenBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const { factsHash } = context.req.valid('json');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId, userId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const state = await markGardenVisitSummarySeen({
                userId,
                accountId,
                gardenId: gardenIdNumber,
                factsHash,
            });

            return context.json({ state: serializeGardenVisitState(state) });
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
                    getGardenBlocks(gardenIdNumber),
                    getAppliedRaisedBedOperationsForGarden(
                        accountId,
                        gardenIdNumber,
                    ),
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
            const raisedBedsById = new Map(
                garden.raisedBeds.map((raisedBed) => [raisedBed.id, raisedBed]),
            );
            const abandonedRaisedBedAggregateIds = garden.raisedBeds
                .filter((raisedBed) => isRaisedBedAbandoned(raisedBed.status))
                .map((raisedBed) => raisedBed.id.toString());
            const raisedBedAbandonEvents =
                abandonedRaisedBedAggregateIds.length > 0
                    ? await getAllEvents(
                          knownEventTypes.raisedBeds.abandon,
                          abandonedRaisedBedAggregateIds,
                      )
                    : [];
            const abandonReasonByRaisedBedId = raisedBedAbandonEvents.reduce(
                (acc, event) => {
                    const raisedBedId = Number(event.aggregateId);
                    if (!Number.isInteger(raisedBedId)) {
                        return acc;
                    }

                    acc.set(raisedBedId, getAbandonReason(event.data));
                    return acc;
                },
                new Map<number, string | null>(),
            );
            const appliedOperationsByRaisedBedId = operations.reduce(
                (acc, operation) => {
                    if (
                        !operation.raisedBedId ||
                        !isAppliedRaisedBedOperationStatus(operation.status)
                    ) {
                        return acc;
                    }

                    const raisedBed = raisedBedsById.get(operation.raisedBedId);
                    if (
                        !raisedBed ||
                        !isAppliedOperationCurrentForRaisedBedFields(
                            operation,
                            raisedBed.fields,
                        )
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
                isSandbox: garden.isSandbox,
                backgroundPalette: garden.backgroundPalette,
                farmId: garden.farmId,
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
                        weedState: raisedBed.weedState,
                        abandonReason:
                            abandonReasonByRaisedBedId.get(raisedBed.id) ??
                            null,
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
                getAllEvents(knownEventTypes.gardens.blockPlace, [gardenId]),
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
            security: authSecurity,
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
                backgroundPalette: z.enum(gameBackgroundPaletteKeys).optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const { backgroundPalette, name } = context.req.valid('json');
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
            const updateData: {
                backgroundPalette?: string;
                id: number;
                name?: string;
            } = {
                id: gardenIdNumber,
            };
            if (name !== undefined) {
                updateData.name = name.trim();
            }
            if (backgroundPalette !== undefined) {
                updateData.backgroundPalette = backgroundPalette;
            }

            await updateGarden(updateData);

            return context.json({ success: true });
        },
    )
    .delete(
        '/:gardenId',
        describeRoute({
            description:
                'Delete a sandbox garden accessible to the current user, including related blocks, raised beds, notifications, operations, cart rows, transactions, and events. Real gardens cannot be deleted from this endpoint. Large deletions may return 202 and should be retried until complete.',
            security: authSecurity,
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

            const { user } = context.get('authContext');
            const garden =
                await getSandboxGardenDeletionCandidate(gardenIdNumber);
            if (!garden) {
                return context.json(
                    { success: true, complete: true, deletedRows: 0 },
                    200,
                );
            }
            if (!user.accountIds.includes(garden.accountId)) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            if (!garden.isSandbox) {
                return context.json(
                    { error: 'Only sandbox gardens can be deleted' },
                    400,
                );
            }

            const result = await deleteSandboxGardenCompletely(gardenIdNumber);

            return context.json(
                { success: true, ...result },
                result.complete ? 200 : 202,
            );
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
            const blockRotationById = new Map(
                gardenBlocks.map((block) => [block.id, block.rotation]),
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
                        const spanValidation = validateSpanningBlockMove({
                            stacks: initialGardenState.stacks,
                            fromPath: from,
                            toPath: path,
                            movedBlockId: fromValue,
                            blockNameById,
                            blockDataByName,
                            blockRotationById,
                            parsePath,
                        });
                        if (!spanValidation.valid) {
                            return context.json(
                                { error: spanValidation.error },
                                400,
                            );
                        }

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
        '/:gardenId/blocks/:blockId/store-in-garden-box',
        describeRoute({
            description:
                'Move a garden block into a garden box inventory for the current user.',
            security: authSecurity,
            tags: ['Gardens'],
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                blockId: z.string(),
            }),
        ),
        zValidator('json', storeBlockInGardenBoxBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, blockId } = context.req.valid('param');
            const { blockIndex, gardenBoxBlockId, sourcePosition } =
                context.req.valid('json');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber) || gardenIdNumber <= 0) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const [gardenBlocks, sourceStack, blockData] = await Promise.all([
                getGardenBlocks(gardenIdNumber),
                getGardenStack(gardenIdNumber, {
                    x: sourcePosition.x,
                    y: sourcePosition.z,
                }),
                getBlockData(),
            ]);

            if (!sourceStack) {
                return context.json({ error: 'Source stack not found' }, 400);
            }

            if (sourceStack.blocks[blockIndex] !== blockId) {
                return context.json(
                    { error: 'Source block no longer matches the garden' },
                    409,
                );
            }

            const block = gardenBlocks.find(
                (candidate) => candidate.id === blockId,
            );
            if (!block) {
                return context.json({ error: 'Block not found' }, 404);
            }

            const gardenBox = gardenBlocks.find(
                (candidate) => candidate.id === gardenBoxBlockId,
            );
            if (gardenBox?.name !== 'GardenBox') {
                return context.json({ error: 'Garden box not found' }, 404);
            }

            const gardenBoxStack = garden.stacks.find(
                (stack) =>
                    !stack.isDeleted && stack.blocks.includes(gardenBoxBlockId),
            );
            if (!gardenBoxStack) {
                return context.json(
                    { error: 'Garden box is not placed in this garden' },
                    400,
                );
            }

            if (block.id === gardenBoxBlockId || block.name === 'GardenBox') {
                return context.json(
                    { error: 'Garden boxes cannot be stored in garden boxes' },
                    400,
                );
            }

            if (block.name === 'Raised_Bed') {
                return context.json(
                    { error: 'Raised beds cannot be stored in garden boxes' },
                    400,
                );
            }

            const inventoryBlock = blockData.find(
                (candidate) => candidate.information?.name === block.name,
            );
            if (!inventoryBlock) {
                return context.json(
                    { error: 'Block directory data not found' },
                    404,
                );
            }
            const inventoryEntityId = inventoryBlock.id.toString();
            let result:
                | { ok: true }
                | { ok: false; error: string; status: ContentfulStatusCode };
            try {
                result = await storage().transaction(async (tx) => {
                    const currentSourceStack = await getGardenStackForUpdate(
                        gardenIdNumber,
                        {
                            x: sourcePosition.x,
                            y: sourcePosition.z,
                        },
                        tx,
                    );
                    if (
                        !currentSourceStack ||
                        currentSourceStack.blocks[blockIndex] !== blockId
                    ) {
                        return {
                            ok: false,
                            error: 'Source block no longer matches the garden',
                            status: 409,
                        } as const;
                    }

                    const nextSourceBlocks = currentSourceStack.blocks.filter(
                        (_sourceBlockId, index) => index !== blockIndex,
                    );
                    await updateGardenStack(
                        gardenIdNumber,
                        {
                            x: sourcePosition.x,
                            y: sourcePosition.z,
                            blocks: nextSourceBlocks,
                        },
                        tx,
                    );
                    await storageDeleteGardenBlock(
                        gardenIdNumber,
                        block.id,
                        tx,
                    );
                    await addGardenBoxInventoryItem(
                        accountId,
                        gardenIdNumber,
                        gardenBoxBlockId,
                        {
                            entityTypeName: 'block',
                            entityId: inventoryEntityId,
                            amount: 1,
                            source: 'gardenBox:drop',
                        },
                        tx,
                    );
                    return { ok: true } as const;
                });
            } catch (error) {
                if (error instanceof GardenBoxInventoryLimitError) {
                    return context.json({ error: error.message }, 400);
                }

                throw error;
            }
            if (!result.ok) {
                return context.json({ error: result.error }, result.status);
            }

            return context.json({
                gardenBoxBlockId,
                item: {
                    entityTypeName: 'block',
                    entityId: inventoryEntityId,
                    amount: 1,
                },
            });
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
                expectedExistingBlocks: z.array(z.string()).optional(),
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

            const { blockName, expectedExistingBlocks, position } =
                context.req.valid('json');

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
            // Sandbox ("play") gardens build for free: no cost, no inventory,
            // no night-only restriction and nothing is debited.
            if (!garden.isSandbox) {
                if (cost <= 0) {
                    return context.json(
                        { error: 'Requested block not for sale' },
                        400,
                    );
                }

                if (
                    !isBlockPurchaseAvailableNow({
                        block,
                        location: {
                            lat: garden.farm?.latitude,
                            lon: garden.farm?.longitude,
                        },
                    })
                ) {
                    return context.json(
                        {
                            error: 'Ovaj blok moguće je kupiti samo noću.',
                        },
                        400,
                    );
                }
            }

            const blockNameById = new Map(
                gardenBlocks.map((block) => [block.id, block.name] as const),
            );
            const blockRotationById = new Map(
                gardenBlocks.map((block) => [block.id, block.rotation]),
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
                blockRotationById,
                blockDataByName,
                requestedPosition: position,
            });
            if (!placement.valid) {
                return context.json({ error: placement.error }, 400);
            }

            const { x, y, existingBlocks } = placement.placement;
            if (
                expectedExistingBlocks &&
                (expectedExistingBlocks.length !== existingBlocks.length ||
                    expectedExistingBlocks.some(
                        (blockId, index) => blockId !== existingBlocks[index],
                    ))
            ) {
                return context.json(
                    {
                        error: 'Invalid block placement: stack changed while placing block',
                    },
                    409,
                );
            }

            const hasTargetStack = garden.stacks.some(
                (stack) => stack.positionX === x && stack.positionY === y,
            );
            const purchaseResult = await purchaseGardenBlock({
                accountId,
                blockName,
                cost: garden.isSandbox ? 0 : cost,
                dependencies: {
                    createGardenBlock,
                    createGardenStack,
                    deleteGardenBlock: storageDeleteGardenBlock,
                    spendSunflowers: garden.isSandbox
                        ? async () => undefined
                        : spendSunflowers,
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
                'Recycles the block by default and refunds the sunflowers outside sandbox gardens.',
            security: authSecurity,
            tags: ['Gardens'],
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
    .post(
        '/:gardenId/raised-beds/:raisedBedId/abandon',
        describeRoute({
            description:
                'Mark a raised bed as abandoned and queue the abandonment operation.',
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
            const [garden, raisedBed] = await Promise.all([
                getGarden(gardenIdNumber),
                getRaisedBed(raisedBedIdNumber),
            ]);
            if (
                !garden ||
                garden.accountId !== accountId ||
                !raisedBed ||
                raisedBed.accountId !== accountId ||
                raisedBed.gardenId !== gardenIdNumber
            ) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }
            if (isRaisedBedAbandoned(raisedBed.status)) {
                return context.json(
                    { error: 'Raised bed is already abandoned' },
                    409,
                );
            }

            const operationId = await abandonRaisedBed({
                accountId,
                gardenId: gardenIdNumber,
                operationEntityId: RAISED_BED_ABANDON_OPERATION_ENTITY_ID,
                operationEntityTypeName: RAISED_BED_OPERATION_ENTITY_TYPE_NAME,
                raisedBedId: raisedBedIdNumber,
                reason: 'user',
            });

            return context.json({ id: operationId }, 201);
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
        '/:gardenId/raised-beds/:raisedBedId/ai-history',
        describeRoute({
            description:
                'Get the combined AI analysis history for a raised bed and all of its fields',
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

            const entries =
                await getRaisedBedAiHistoryEntries(raisedBedIdNumber);
            return context.json(entries);
        },
    )
    .post(
        '/:gardenId/raised-beds/:raisedBedId/analyze-image',
        describeRoute({
            description:
                'Stream AI analysis for raised bed images and save the final response to diary',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
            }),
        ),
        zValidator('json', analyzeImageBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId } = context.req.valid('param');
            const body = context.req.valid('json');
            const imageUrls = normalizeAnalysisImageUrls(body);
            const referenceDate = getAnalysisReferenceDate(body);
            const firstImageUrl = imageUrls[0];
            if (!firstImageUrl) {
                return context.json({ error: 'Image URL is required' }, 400);
            }

            const urlError = validateImageUrls(imageUrls);
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

            const aiQuota = await getAiRequestQuotaUsage(
                accountId,
                RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND,
            );
            if (aiQuota.used >= aiQuota.limit) {
                return context.json(
                    {
                        code: 'ai_quota_exceeded',
                        error: formatAiQuotaExceededError(aiQuota),
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

            await recordAiRequest(
                accountId,
                RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND,
            );

            const result = await streamRaisedBedImageAnalysis(
                {
                    accountId,
                    gardenId: gardenIdNumber,
                    raisedBed,
                    imageUrls,
                    referenceDate,
                },
                async (analysis) => {
                    await createEvent(
                        knownEvents.raisedBeds.aiAnalysisV1(
                            raisedBedIdNumber.toString(),
                            {
                                markdown: analysis.markdown,
                                imageUrl: firstImageUrl,
                                imageUrls,
                                model: analysis.model,
                                analyzedAt: analysis.analyzedAt,
                                referenceDate:
                                    referenceDate?.toISOString() ?? undefined,
                                accountId,
                                aiRequestKind:
                                    RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND,
                                inputTokens: analysis.inputTokens,
                                outputTokens: analysis.outputTokens,
                                totalTokens: analysis.totalTokens,
                            },
                        ),
                    );
                },
            );

            return result.toTextStreamResponse(aiTextStreamResponseInit);
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
    .post(
        '/:gardenId/raised-beds/:raisedBedId/fields/:positionIndex/reschedule',
        describeRoute({
            description:
                'Reschedule a planned in-game diary raised-bed field sowing for the current user',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
                positionIndex: z.string(),
            }),
        ),
        zValidator('json', rescheduleDiaryItemBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const { scheduledDate } = context.req.valid('json');
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            const raisedBedIdNumber = Number.parseInt(raisedBedId, 10);
            const positionIndexNumber = Number.parseInt(positionIndex, 10);

            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }
            if (Number.isNaN(positionIndexNumber) || positionIndexNumber < 0) {
                return context.json({ error: 'Invalid position index' }, 400);
            }

            const { accountId } = context.get('authContext');

            try {
                const result = await rescheduleGardenDiaryRaisedBedField({
                    accountId,
                    gardenId: gardenIdNumber,
                    raisedBedId: raisedBedIdNumber,
                    positionIndex: positionIndexNumber,
                    scheduledDate,
                });

                return context.json(
                    { scheduledDate: result.scheduledDate.toISOString() },
                    200,
                );
            } catch (error) {
                if (error instanceof GardenDiaryRescheduleError) {
                    return diaryRescheduleErrorResponse(context, error);
                }

                console.error('Failed to reschedule diary raised bed field', {
                    accountId,
                    error,
                    gardenId: gardenIdNumber,
                    positionIndex: positionIndexNumber,
                    raisedBedId: raisedBedIdNumber,
                    scheduledDate,
                });
                return context.json(
                    { error: 'Failed to reschedule raised bed field' },
                    500,
                );
            }
        },
    )
    .post(
        '/:gardenId/raised-beds/:raisedBedId/fields/:positionIndex/cancel',
        describeRoute({
            description:
                'Cancel a planned in-game diary raised-bed field sowing for the current user and refund sunflowers',
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
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            const raisedBedIdNumber = Number.parseInt(raisedBedId, 10);
            const positionIndexNumber = Number.parseInt(positionIndex, 10);

            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }
            if (Number.isNaN(raisedBedIdNumber)) {
                return context.json({ error: 'Invalid raised bed ID' }, 400);
            }
            if (Number.isNaN(positionIndexNumber) || positionIndexNumber < 0) {
                return context.json({ error: 'Invalid position index' }, 400);
            }

            const { accountId, userId } = context.get('authContext');

            try {
                const result = await cancelGardenDiaryRaisedBedField({
                    accountId,
                    canceledBy: userId,
                    gardenId: gardenIdNumber,
                    raisedBedId: raisedBedIdNumber,
                    positionIndex: positionIndexNumber,
                });

                return context.json({ refundAmount: result.refundAmount }, 200);
            } catch (error) {
                if (error instanceof GardenDiaryCancelError) {
                    return diaryCancelErrorResponse(context, error);
                }

                console.error('Failed to cancel diary raised bed field', {
                    accountId,
                    error,
                    gardenId: gardenIdNumber,
                    positionIndex: positionIndexNumber,
                    raisedBedId: raisedBedIdNumber,
                    userId,
                });
                return context.json(
                    { error: 'Failed to cancel raised bed field' },
                    500,
                );
            }
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
            if (isRaisedBedAbandoned(raisedBed.status)) {
                return context.json({ error: 'Raised bed is abandoned' }, 409);
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
                const activePlantCycle = field.plantCycles.find(
                    (plantCycle) => plantCycle.active,
                );
                if (activePlantCycle && createdAt < activePlantCycle.endedAt) {
                    return context.json(
                        {
                            error: 'Timestamp cannot be earlier than the latest field lifecycle event',
                        },
                        400,
                    );
                }
            }

            // Call the storage function to create the event and update the plant status
            try {
                const event = knownEvents.raisedBedFields.plantUpdateV1(
                    `${raisedBedIdNumber.toString()}|${positionIndexNumber.toString()}`,
                    buildRaisedBedFieldPlantUpdatePayload(
                        status,
                        field.assignedUserIds,
                    ),
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
        '/:gardenId/raised-beds/:raisedBedId/fields/:positionIndex/sandbox-plant',
        describeRoute({
            description:
                'Plant a sort into a sandbox raised bed field at a chosen age',
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
                plantSortId: z.number().int().positive(),
                // How old the plant should render, in days (0 = freshly sown).
                ageDays: z.number().int().min(0).max(3650).default(0),
                status: z.string().optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const { plantSortId, ageDays, status } = context.req.valid('json');

            const gardenIdNumber = parseInt(gardenId, 10);
            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            const positionIndexNumber = parseInt(positionIndex, 10);
            if (
                Number.isNaN(gardenIdNumber) ||
                Number.isNaN(raisedBedIdNumber) ||
                Number.isNaN(positionIndexNumber) ||
                positionIndexNumber < 0
            ) {
                return context.json({ error: 'Invalid parameters' }, 400);
            }

            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }
            if (!garden.isSandbox) {
                return context.json(
                    { error: 'Garden is not a sandbox garden' },
                    400,
                );
            }

            const raisedBed = await getRaisedBed(raisedBedIdNumber);
            if (!raisedBed || raisedBed.gardenId !== gardenIdNumber) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            const sowDate = new Date();
            sowDate.setDate(sowDate.getDate() - ageDays);

            await sowSandboxField({
                raisedBedId: raisedBedIdNumber,
                positionIndex: positionIndexNumber,
                plantSortId,
                sowDate,
                status,
            });

            return context.json({ success: true }, 200);
        },
    )
    .delete(
        '/:gardenId/raised-beds/:raisedBedId/fields/:positionIndex',
        describeRoute({
            description: 'Clear a sandbox raised bed field',
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
            const raisedBedIdNumber = parseInt(raisedBedId, 10);
            const positionIndexNumber = parseInt(positionIndex, 10);
            if (
                Number.isNaN(gardenIdNumber) ||
                Number.isNaN(raisedBedIdNumber) ||
                Number.isNaN(positionIndexNumber) ||
                positionIndexNumber < 0
            ) {
                return context.json({ error: 'Invalid parameters' }, 400);
            }

            const { accountId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }
            if (!garden.isSandbox) {
                return context.json(
                    { error: 'Garden is not a sandbox garden' },
                    400,
                );
            }

            const raisedBed = await getRaisedBed(raisedBedIdNumber);
            if (!raisedBed || raisedBed.gardenId !== gardenIdNumber) {
                return context.json({ error: 'Raised bed not found' }, 404);
            }

            await clearSandboxField(raisedBedIdNumber, positionIndexNumber);
            return context.json({ success: true }, 200);
        },
    )
    .post(
        '/:gardenId/raised-beds/:raisedBedId/fields/:positionIndex/analyze-image',
        describeRoute({
            description:
                'Stream AI analysis for raised bed field images and save the final response to diary',
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                raisedBedId: z.string(),
                positionIndex: z.string(),
            }),
        ),
        zValidator('json', analyzeImageBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const body = context.req.valid('json');
            const imageUrls = normalizeAnalysisImageUrls(body);
            const referenceDate = getAnalysisReferenceDate(body);
            const firstImageUrl = imageUrls[0];
            if (!firstImageUrl) {
                return context.json({ error: 'Image URL is required' }, 400);
            }

            // Validate image URLs against allowed hosts
            const urlError = validateImageUrls(imageUrls);
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

            const aiQuota = await getAiRequestQuotaUsage(
                accountId,
                RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND,
            );
            if (aiQuota.used >= aiQuota.limit) {
                return context.json(
                    {
                        code: 'ai_quota_exceeded',
                        error: formatAiQuotaExceededError(aiQuota),
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

            await recordAiRequest(
                accountId,
                RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND,
            );

            const result = await streamRaisedBedImageAnalysis(
                {
                    accountId,
                    gardenId: gardenIdNumber,
                    raisedBed,
                    positionIndex: positionIndexNumber,
                    imageUrls,
                    referenceDate,
                },
                async (analysis) => {
                    await createEvent(
                        knownEvents.raisedBedFields.aiAnalysisV1(
                            `${raisedBedIdNumber.toString()}|${positionIndexNumber.toString()}`,
                            {
                                markdown: analysis.markdown,
                                imageUrl: firstImageUrl,
                                imageUrls,
                                model: analysis.model,
                                analyzedAt: analysis.analyzedAt,
                                referenceDate:
                                    referenceDate?.toISOString() ?? undefined,
                                accountId,
                                aiRequestKind:
                                    RAISED_BED_IMAGE_ANALYSIS_REQUEST_KIND,
                                inputTokens: analysis.inputTokens,
                                outputTokens: analysis.outputTokens,
                                totalTokens: analysis.totalTokens,
                            },
                        ),
                    );
                },
            );

            return result.toTextStreamResponse(aiTextStreamResponseInit);
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
