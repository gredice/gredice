import { gameBackgroundPaletteKeys } from '@gredice/js/gameBackground';
import {
    gardenPreviewContentType,
    gardenPreviewDefaultPhase,
    gardenPreviewHeight,
    gardenPreviewMaxSizeBytes,
    gardenPreviewPhaseHeader,
    gardenPreviewRendererVersion,
    gardenPreviewRendererVersionHeader,
    gardenPreviewSourceRevisionHeader,
    gardenPreviewWidth,
    isGardenPreviewPhase,
} from '@gredice/js/gardenPreviews';
import { detailedRaisedBedInspectionNotificationType } from '@gredice/js/notifications';
import { userAllowedPlantStatusTransitions } from '@gredice/js/plants';
import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDON_OPERATION_ENTITY_ID,
    RAISED_BED_OPERATION_ENTITY_TYPE_NAME,
} from '@gredice/js/raisedBeds';
import {
    isValidWoodenSignMessage,
    normalizeWoodenSignMessage,
    woodenSignMessageMaxGraphemesPerLine,
} from '@gredice/js/woodenSign';
import { notifyOperationUpdate } from '@gredice/notifications';
import { signalcoClient } from '@gredice/signalco';
import {
    AccountDeletionInProgressError,
    AccountNotFoundError,
    abandonRaisedBed,
    acquireGardenPreviewCaptureLease,
    CannotLikeOwnGardenError,
    cancelGardenDiaryOperation,
    cancelGardenDiaryRaisedBedField,
    cancelSelectedRaisedBedPlantingTaskForOwner,
    claimGardenPreviewBlobDeletion,
    clearSandboxField,
    completeGardenPreviewBlobDeletions,
    countAiRequestEventsSince,
    countRaisedBedsByAccount,
    createDefaultGardenForAccount,
    createEvent,
    createSandboxGarden,
    deleteSandboxGardenCompletely,
    GardenDiaryCancelError,
    GardenDiaryRescheduleError,
    type GardenPreviewBlobDeletionReason,
    type GardenPreviewImage,
    type GardenPreviewImages,
    getAccount,
    getAccountGardensMetadata,
    getAllEvents,
    getAppliedRaisedBedOperationsForGarden,
    getGarden,
    getGardenBlocks,
    getGardenLikeCounts,
    getGardenPreviews,
    getNotification,
    getOperationsByIds,
    getOperationsPage,
    getPreviousPlantStatusChangedAtForUpdate,
    getPublicGarden,
    getPublicGardens,
    getRaisedBed,
    getRaisedBedAiHistoryEntries,
    getRaisedBedDiaryEntries,
    getRaisedBedFieldDiaryEntries,
    getRaisedBedFieldsWithEvents,
    getRaisedBedIdsByAccount,
    getRaisedBedPlanting,
    getRaisedBedSensors,
    getRaisedBedsForGardens,
    getSandboxGardenDeletionCandidate,
    getUnreadNotificationsByType,
    getUnreadRaisedBedImageNotificationIdsForGarden,
    getUnreadRaisedBedNotificationsForGarden,
    getUserLikedGardenIds,
    isPlantStatusEffectiveDateAllowed,
    knownEvents,
    knownEventTypes,
    listGardenStructures,
    maxNotificationReadBatchSize,
    PublicGardenLikeTargetNotFoundError,
    queueGardenPreviewBlobDeletion,
    recordGardenPreviewBlobDeletionFailures,
    releaseGardenPreviewCaptureLease,
    replaceGardenPreview,
    rescheduleGardenDiaryOperation,
    rescheduleGardenDiaryRaisedBedField,
    rescheduleSelectedRaisedBedPlantingTaskForOwner,
    ScheduleTaskSubmissionError,
    setAllNotificationsRead,
    setGardenLike,
    sowSandboxField,
    toGardenPreviewImage,
    updateGarden,
    updateRaisedBed,
    withPlantingScheduleTaskTransaction,
} from '@gredice/storage';
import { del, put } from '@vercel/blob';
import { type Context, Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity, publicSecurity } from '../../../lib/docs/security';
import {
    isAppliedOperationCurrentForRaisedBedFields,
    serializeAppliedRaisedBedOperation,
} from '../../../lib/garden/appliedRaisedBedOperations';
import {
    buildDetailedRaisedBedInspectionReports,
    detailedInspectionOperationId,
} from '../../../lib/garden/detailedRaisedBedInspectionReports';
import {
    recycleGardenBlockForAccount,
    updateGardenBlockForAccount,
} from '../../../lib/garden/gardenBlockMutationService';
import {
    gardenBlockPurchaseBodySchema,
    gardenBlockPurchaseParamSchema,
} from '../../../lib/garden/gardenBlockPurchaseSchemas';
import { storeGardenBlockInGardenBoxForAccount } from '../../../lib/garden/gardenBoxBlockStorageService';
import { getGardenBuildingSystemAvailability } from '../../../lib/garden/gardenBuildingSystemServerFlag';
import {
    deleteRealGardenForAccount,
    parseGardenDeletionId,
} from '../../../lib/garden/gardenDeletionService';
import { serializeGardenOperationEvidence } from '../../../lib/garden/gardenOperationsSerialization';
import {
    canAccessGardenPreviewSource,
    createGardenPreviewSourceRevision,
    getGardenPreviewUploadDecision,
    readWebpDimensions,
} from '../../../lib/garden/gardenPreview';
import {
    getGardenPreviewBlobDeletionRetryAt,
    processGardenPreviewBlobDeletions,
} from '../../../lib/garden/gardenPreviewBlobDeletion';
import { patchGardenStacksForAccount } from '../../../lib/garden/gardenStacksPatchService';
import { serializeGardenStructures } from '../../../lib/garden/gardenStructureSerialization';
import {
    countPublicGardenActivePlants,
    serializePublicRaisedBedField,
    serializeRaisedBedPlantingsForGardenView,
} from '../../../lib/garden/publicGardenSerialization';
import {
    publicGardenVisitorClientAddress,
    publicGardenVisitorPresenceBodySchema,
    publicGardenVisitorRateLimitAllows,
    removePublicGardenVisitorPresence,
    updatePublicGardenVisitorPresence,
} from '../../../lib/garden/publicGardenVisitorPresence';
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
import { serializeRaisedBedGardenNotification } from '../../../lib/garden/raisedBedNotifications';
import { calculateRaisedBedsValidity } from '../../../lib/garden/raisedBedsService';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';
import { queryBooleanSchema } from '../../../lib/http/queryBoolean';
import { openAdventGiftBox } from '../../../lib/occasions/adventGiftBox';
import { getPostHogClient } from '../../../lib/posthog-server';
import gardenStructuresRoutes from './gardenStructuresRoutes';

const DEFAULT_TIMEZONE = 'Europe/Paris';

const gardenLikeBodySchema = z
    .object({
        liked: z.boolean(),
    })
    .strict();

const woodenSignMessageSchema = z
    .union([z.string(), z.null()])
    .refine(isValidWoodenSignMessage, {
        message: `Sign message must contain at most ${woodenSignMessageMaxGraphemesPerLine.toString()} characters per row across one or two rows and no control characters`,
    })
    .transform((message) =>
        message === null ? null : normalizeWoodenSignMessage(message),
    );

const updateGardenBlockBodySchema = z
    .object({
        rotation: z
            .number()
            .int()
            .min(-2_147_483_648)
            .max(2_147_483_647)
            .nullable()
            .optional(),
        variant: z
            .number()
            .int()
            .min(-2_147_483_648)
            .max(2_147_483_647)
            .nullable()
            .optional(),
        message: woodenSignMessageSchema.optional(),
    })
    .strict()
    .refine((body) => Object.keys(body).length > 0, {
        message: 'At least one block field is required',
    });

const detailedInspectionReportsSeenBodySchema = z
    .object({
        notificationIds: z
            .array(z.string().min(1))
            .min(1)
            .max(maxNotificationReadBatchSize),
    })
    .strict();

const raisedBedNotificationDismissBodySchema = z
    .object({
        scope: z.enum(['selected', 'raised_bed_images']),
    })
    .strict();

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
    entityId: z.string().trim().min(1).max(100).optional(),
    sourcePosition: z.object({
        x: z.number().int(),
        z: z.number().int(),
    }),
    blockIndex: z.number().int().min(0),
});

const operationDiaryIdentityBodySchema = z.object({
    expectedEntityId: z.number().int().positive(),
    expectedTaskVersionEventId: z.number().int().nonnegative(),
});

const plantingDiaryIdentityBodySchema = z.object({
    expectedPlantCycleEventId: z.number().int().positive(),
    expectedPlantSortId: z.number().int().positive(),
});

const plantingDiaryAttemptIdentityBodySchema =
    plantingDiaryIdentityBodySchema.extend({
        expectedPlantCycleVersionEventId: z.number().int().positive(),
    });

const rescheduleOperationDiaryItemBodySchema =
    operationDiaryIdentityBodySchema.extend({
        scheduledDate: z.string().trim().min(1),
    });

const reschedulePlantingDiaryItemBodySchema =
    plantingDiaryAttemptIdentityBodySchema.extend({
        scheduledDate: z.string().trim().min(1),
    });

const selectedPlantingOwnerIdentityBodySchema = z
    .object({
        commandId: z.uuid(),
        expectedLifecycleVersionEventId: z.number().int().positive(),
        expectedPlantSortId: z.number().int().positive(),
    })
    .strict();

const rescheduleSelectedPlantingBodySchema =
    selectedPlantingOwnerIdentityBodySchema.extend({
        scheduledDate: z.string().trim().min(1),
        sowingLocation: z.enum(['direct', 'greenhouse']),
    });

const cancelSelectedPlantingBodySchema =
    selectedPlantingOwnerIdentityBodySchema.extend({
        effectiveAt: z.iso.datetime().optional(),
        reason: z.string().trim().min(1).max(2000),
    });

const gardenCameraVectorSchema = z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
]);

const gardenHomeCameraSchema = z
    .object({
        position: gardenCameraVectorSchema,
        target: gardenCameraVectorSchema,
        zoom: z.number().finite().min(50).max(500),
    })
    .strict();

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

function selectedPlantingOwnerErrorResponse(
    context: Context,
    error: ScheduleTaskSubmissionError,
) {
    switch (error.code) {
        case 'invalid_input':
            return context.json(
                { code: error.code, error: error.message },
                400,
            );
        case 'not_found':
        case 'not_authorized':
            return context.json(
                { code: 'not_found', error: 'Planting not found' },
                404,
            );
        case 'assignment_changed':
        case 'task_changed':
        case 'invalid_status':
        case 'submission_conflict':
            return context.json(
                { code: error.code, error: error.message },
                409,
            );
    }
}

async function selectedPlantingMatchesGardenRoute({
    accountId,
    gardenId,
    plantingId,
    raisedBedId,
}: {
    accountId: string;
    gardenId: number;
    plantingId: number;
    raisedBedId: number;
}) {
    const planting = await getRaisedBedPlanting(plantingId);
    if (
        planting?.configurationSource !== 'selected' ||
        planting.raisedBedId !== raisedBedId
    ) {
        return false;
    }
    const raisedBed = await getRaisedBed(raisedBedId);
    return Boolean(
        raisedBed &&
            raisedBed.accountId === accountId &&
            raisedBed.gardenId === gardenId,
    );
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
    const evidence = serializeGardenOperationEvidence(operation);

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
        operation.blockedAt
            ? {
                  status: 'blocked',
                  changedAt: operation.blockedAt.toISOString(),
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
        taskVersionEventId: operation.taskVersionEventId,
        raisedBedId: operation.raisedBedId,
        raisedBedFieldId: operation.raisedBedFieldId,
        status: timelineStatus,
        createdAt: operation.createdAt.toISOString(),
        scheduledDate: operation.scheduledDate?.toISOString() ?? null,
        scheduledAt: operation.scheduledAt?.toISOString() ?? null,
        completedAt: operation.completedAt?.toISOString() ?? null,
        verifiedAt: operation.verifiedAt?.toISOString() ?? null,
        canceledAt: operation.canceledAt?.toISOString() ?? null,
        cancellationReason: operation.cancelReason ?? null,
        blockedAt: operation.blockedAt?.toISOString() ?? null,
        blockReasonLabel: operation.blockReasonLabel ?? null,
        blockNote: operation.blockNote ?? null,
        blockImageUrls: operation.blockImageUrls ?? [],
        imageUrls: evidence.imageUrls,
        completionNotes: evidence.completionNotes,
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

async function loadDetailedRaisedBedInspectionReports({
    accountId,
    garden,
    userId,
}: {
    accountId: string;
    garden: NonNullable<Awaited<ReturnType<typeof getGarden>>>;
    userId: string;
}) {
    const notifications = await getUnreadNotificationsByType({
        accountId,
        gardenId: garden.id,
        type: detailedRaisedBedInspectionNotificationType,
        userId,
    });
    const operationIds = notifications.flatMap((notification) => {
        const operationId = detailedInspectionOperationId(
            notification.metadata,
        );
        return operationId === null ? [] : [operationId];
    });
    const operations = await getOperationsByIds(operationIds);

    return buildDetailedRaisedBedInspectionReports({
        accountId,
        gardenId: garden.id,
        notifications,
        operations,
        raisedBeds: garden.raisedBeds,
    });
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

function serializePublicGardenPreviewImage(
    previewImage: GardenPreviewImage | null,
) {
    if (!previewImage) {
        return null;
    }

    return {
        url: previewImage.url,
        width: previewImage.width,
        height: previewImage.height,
        capturedAt: previewImage.capturedAt,
    };
}

function serializePublicGardenPreviewImages(
    previewImages: GardenPreviewImages,
) {
    return {
        day: serializePublicGardenPreviewImage(previewImages.day),
        night: serializePublicGardenPreviewImage(previewImages.night),
    };
}

type GardenDetail = NonNullable<Awaited<ReturnType<typeof getGarden>>>;
type GardenBlocks = Awaited<ReturnType<typeof getGardenBlocks>>;
type GardenStructures = Awaited<ReturnType<typeof listGardenStructures>>;
type AppliedGardenOperations = Awaited<
    ReturnType<typeof getAppliedRaisedBedOperationsForGarden>
>;

function serializeGardenStacks(garden: GardenDetail, blocks: GardenBlocks) {
    const blocksById = new Map(blocks.map((block) => [block.id, block]));

    return garden.stacks.reduce(
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
                        message: block.message,
                        name: block.name,
                        rotation: block.rotation ?? 0,
                        variant: block.variant,
                    };
                })
                .filter(Boolean) as {
                id: string;
                message?: string | null;
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
                    message?: string | null;
                    name: string;
                    rotation?: number | null;
                    variant?: number | null;
                }[]
            >
        >,
    );
}

function createGardenOperationTargetMaps(garden: GardenDetail) {
    return {
        targetsByRaisedBedId: new Map(
            garden.raisedBeds.map((raisedBed) => [
                raisedBed.id,
                `Gredica: ${raisedBed.name}`,
            ]),
        ),
        targetsByRaisedBedFieldId: new Map(
            garden.raisedBeds.flatMap((raisedBed) =>
                raisedBed.fields.map((field) => [
                    field.id,
                    `Polje ${field.positionIndex + 1} • ${raisedBed.name}`,
                ]),
            ),
        ),
    };
}

async function serializeGardenDetails(
    garden: GardenDetail,
    blocks: GardenBlocks,
    operations: AppliedGardenOperations,
    structures: GardenStructures,
    options: { publicView?: boolean } = {},
) {
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
            existing.push(serializeAppliedRaisedBedOperation(operation));
            acc.set(operation.raisedBedId, existing);
            return acc;
        },
        new Map<
            number,
            ReturnType<typeof serializeAppliedRaisedBedOperation>[]
        >(),
    );
    const validityMap = calculateRaisedBedsValidity(
        garden.raisedBeds,
        garden.stacks,
        blockNameById,
    );
    const serializedStructures = serializeGardenStructures(structures, {
        publicView: options.publicView,
        onInvalid: ({ code, structureId }) => {
            console.error('Skipped invalid garden structure serialization', {
                code,
                gardenId: garden.id,
                structureId,
            });
        },
    });

    return {
        id: garden.id,
        name: garden.name,
        isSandbox: garden.isSandbox,
        isPublic: garden.isPublic,
        backgroundPalette: garden.backgroundPalette,
        homeCamera: garden.homeCamera ?? null,
        previewImage: garden.previewImage,
        previewImages: garden.previewImages,
        farmId: garden.farmId,
        latitude: garden.farm.latitude,
        longitude: garden.farm.longitude,
        stacks: serializeGardenStacks(garden, blocks),
        structures: serializedStructures,
        raisedBeds: garden.raisedBeds.map((raisedBed) => ({
            id: raisedBed.id,
            name: raisedBed.name,
            physicalId: raisedBed.physicalId,
            blockId: raisedBed.blockId,
            status: raisedBed.status,
            weedState: raisedBed.weedState,
            abandonReason: abandonReasonByRaisedBedId.get(raisedBed.id) ?? null,
            orientation: raisedBed.orientation,
            fields: options.publicView
                ? raisedBed.fields.map(serializePublicRaisedBedField)
                : raisedBed.fields,
            ...serializeRaisedBedPlantingsForGardenView(
                raisedBed.plantings,
                options,
            ),
            appliedOperations:
                appliedOperationsByRaisedBedId.get(raisedBed.id) ?? [],
            createdAt: raisedBed.createdAt,
            updatedAt: raisedBed.updatedAt,
            isValid: validityMap.get(raisedBed.id) ?? false,
        })),
        createdAt: garden.createdAt,
        updatedAt: garden.updatedAt,
    };
}

const gardenPreviewRevisionPattern = /^[a-f0-9]{64}$/;
const gardenPreviewCacheMaxAgeSeconds = 365 * 24 * 60 * 60;
const gardenPreviewCaptureLeaseDurationMs = 60_000;
const gardenPreviewBlobDeletionClaimDurationMs = 60_000;

async function getAuthorizedGardenPreviewSource(
    gardenId: number,
    {
        accountId,
        role,
    }: {
        accountId: string;
        role: string;
    },
) {
    const garden = await getGarden(gardenId);
    if (
        !garden ||
        !canAccessGardenPreviewSource({
            gardenAccountId: garden.accountId,
            gardenIsPublic: garden.isPublic,
            requestAccountId: accountId,
            requestRole: role,
        })
    ) {
        return null;
    }

    const [blocks, operations, structures] = await Promise.all([
        getGardenBlocks(gardenId),
        getAppliedRaisedBedOperationsForGarden(garden.accountId, gardenId),
        listGardenStructures(gardenId),
    ]);

    const details = await serializeGardenDetails(
        garden,
        blocks,
        operations,
        structures,
    );
    return {
        details,
        garden,
        sourceRevision: createGardenPreviewSourceRevision(details),
    };
}

async function deleteGardenPreviewBlob({
    gardenId,
    imageUrl,
    pathname,
    reason,
}: {
    gardenId: number;
    imageUrl: string;
    pathname: string;
    reason: GardenPreviewBlobDeletionReason;
}) {
    const claimId = globalThis.crypto.randomUUID();
    const attemptedAt = new Date();

    try {
        await queueGardenPreviewBlobDeletion({ imageUrl, pathname, reason });
        const deletion = await claimGardenPreviewBlobDeletion({
            claimId,
            expiresAt: new Date(
                attemptedAt.getTime() +
                    gardenPreviewBlobDeletionClaimDurationMs,
            ),
            now: attemptedAt,
            pathname,
        });
        if (!deletion) {
            return;
        }

        const result = await processGardenPreviewBlobDeletions({
            concurrency: 1,
            deleteBlob: async (url) => del(url),
            deletions: [deletion],
        });
        if (result.completedIds.length > 0) {
            const completed = await completeGardenPreviewBlobDeletions({
                claimId,
                ids: result.completedIds,
            });
            if (completed !== result.completedIds.length) {
                throw new Error(
                    'Garden preview Blob deletion completion claim was lost',
                );
            }
        }
        if (result.failures.length > 0) {
            const failed = await recordGardenPreviewBlobDeletionFailures({
                attemptedAt,
                claimId,
                failures: result.failures.map((failure) => ({
                    ...failure,
                    retryAt: getGardenPreviewBlobDeletionRetryAt({
                        attempts: deletion.attempts,
                        now: attemptedAt,
                    }),
                })),
            });
            if (failed !== result.failures.length) {
                throw new Error(
                    'Garden preview Blob deletion failure claim was lost',
                );
            }
        }
    } catch (error) {
        console.error('Failed to delete garden preview blob', {
            error,
            gardenId,
            imageUrl,
            pathname,
            reason,
        });
    }
}

async function deleteGardenPreviewBlobs({
    gardenId,
    previews,
    reason,
}: {
    gardenId: number;
    previews: Awaited<ReturnType<typeof getGardenPreviews>>;
    reason: GardenPreviewBlobDeletionReason;
}) {
    for (const preview of previews) {
        await deleteGardenPreviewBlob({
            gardenId,
            imageUrl: preview.imageUrl,
            pathname: preview.pathname,
            reason,
        });
    }
}

async function getGardenQueuedTasks(garden: GardenDetail) {
    const operationsPage = await getOperationsPage({
        accountId: garden.accountId,
        gardenId: garden.id,
        includeCompleted: false,
        limit: 50,
    });
    const { targetsByRaisedBedFieldId, targetsByRaisedBedId } =
        createGardenOperationTargetMaps(garden);

    return operationsPage.items.map((operation) =>
        serializeGardenOperation(
            operation,
            targetsByRaisedBedFieldId,
            targetsByRaisedBedId,
        ),
    );
}

const app = new Hono<{ Variables: AuthVariables }>()
    .route('/:gardenId/structures', gardenStructuresRoutes)
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
                    isPublic: garden.isPublic,
                    backgroundPalette: garden.backgroundPalette,
                    homeCamera: garden.homeCamera ?? null,
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
        '/public',
        describeRoute({
            description: 'Get public gardens visible on the public website',
            security: publicSecurity,
        }),
        async (context) => {
            const publicGardens = await getPublicGardens();
            const publicGardenIds = publicGardens.map((garden) => garden.id);
            const raisedBedsByGardenId =
                await getRaisedBedsForGardens(publicGardenIds);
            const likeCounts = await getGardenLikeCounts(publicGardenIds);

            return context.json({
                items: publicGardens.map((garden) => {
                    const raisedBeds =
                        raisedBedsByGardenId.get(garden.id) ?? [];

                    return {
                        id: garden.id,
                        name: garden.name,
                        isSandbox: garden.isSandbox,
                        owner: garden.owner,
                        backgroundPalette: garden.backgroundPalette,
                        homeCamera: garden.homeCamera ?? null,
                        previewImage: serializePublicGardenPreviewImage(
                            garden.previewImage,
                        ),
                        previewImages: serializePublicGardenPreviewImages(
                            garden.previewImages,
                        ),
                        activePlantCount:
                            countPublicGardenActivePlants(raisedBeds),
                        likeCount: likeCounts.get(garden.id) ?? 0,
                        createdAt: garden.createdAt,
                        updatedAt: garden.updatedAt,
                    };
                }),
            });
        },
    )
    .get(
        '/likes',
        describeRoute({
            description:
                'List visible gardens liked by the current authenticated user.',
            security: authSecurity,
        }),
        authValidator(['user', 'admin']),
        async (context) => {
            const { userId } = context.get('authContext');
            const likedGardenIds = await getUserLikedGardenIds({ userId });

            return context.json(
                {
                    gardenIds: Array.from(likedGardenIds),
                },
                200,
            );
        },
    )
    .put(
        '/:gardenId/like',
        describeRoute({
            description:
                'Set the like state for a visible garden for the current authenticated user.',
            security: authSecurity,
        }),
        authValidator(['user', 'admin']),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator('json', gardenLikeBodySchema),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { liked } = context.req.valid('json');
            const { user, userId } = context.get('authContext');

            try {
                return context.json(
                    await setGardenLike({
                        accountIds: user.accountIds,
                        gardenId: gardenIdNumber,
                        liked,
                        userId,
                    }),
                    200,
                );
            } catch (error) {
                if (error instanceof PublicGardenLikeTargetNotFoundError) {
                    return context.json({ error: error.message }, 404);
                }

                if (error instanceof CannotLikeOwnGardenError) {
                    return context.json({ error: error.message }, 403);
                }

                throw error;
            }
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
    .get(
        '/:gardenId/raised-bed-notifications',
        describeRoute({
            description:
                'Get up to 500 unread raised-bed notifications for the current user in an owned garden, ordered by visual suitability, priority, and recency.',
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
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId, userId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const notifications =
                await getUnreadRaisedBedNotificationsForGarden({
                    accountId,
                    gardenId: gardenIdNumber,
                    userId,
                });

            return context.json(
                {
                    notifications: notifications.map(
                        serializeRaisedBedGardenNotification,
                    ),
                },
                200,
            );
        },
    )
    .put(
        '/:gardenId/raised-bed-notifications/:notificationId/dismiss',
        describeRoute({
            description:
                'Dismiss one unread raised-bed notification, or every unread image notification for the same raised bed, for the current user in an owned garden.',
            security: authSecurity,
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                notificationId: z.string().min(1),
            }),
        ),
        zValidator('json', raisedBedNotificationDismissBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, notificationId } = context.req.valid('param');
            const { scope } = context.req.valid('json');
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId, userId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const notification = await getNotification(notificationId);
            if (
                !notification ||
                notification.accountId !== accountId ||
                (notification.userId !== null &&
                    notification.userId !== userId) ||
                notification.gardenId !== gardenIdNumber ||
                notification.raisedBedId === null ||
                notification.type ===
                    detailedRaisedBedInspectionNotificationType
            ) {
                return context.json(
                    { error: 'Raised-bed notification not found' },
                    404,
                );
            }

            const dismissedNotificationIds: string[] = [];
            const dismissBatch = async (notificationIds: string[]) => {
                await setAllNotificationsRead(
                    accountId,
                    userId,
                    notificationIds,
                    true,
                    'game_raised_bed_bubble',
                );
                dismissedNotificationIds.push(...notificationIds);
                return notificationIds.length;
            };

            if (
                scope === 'raised_bed_images' &&
                notification.imageUrl?.trim()
            ) {
                while (true) {
                    const notificationIds =
                        await getUnreadRaisedBedImageNotificationIdsForGarden({
                            accountId,
                            gardenId: gardenIdNumber,
                            limit: maxNotificationReadBatchSize,
                            raisedBedId: notification.raisedBedId,
                            userId,
                        });
                    if (notificationIds.length === 0) {
                        break;
                    }

                    const dismissedCount = await dismissBatch(notificationIds);
                    if (
                        dismissedCount === 0 ||
                        notificationIds.length < maxNotificationReadBatchSize
                    ) {
                        break;
                    }
                }
            } else {
                await dismissBatch([notification.id]);
            }

            return context.json(
                {
                    dismissedNotificationIds: [
                        ...new Set(dismissedNotificationIds),
                    ],
                },
                200,
            );
        },
    )
    .get(
        '/:gardenId/detailed-inspection-reports',
        describeRoute({
            description:
                'Get unread detailed raised bed inspection reports for the current account and garden.',
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
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId, userId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const reports = await loadDetailedRaisedBedInspectionReports({
                accountId,
                garden,
                userId,
            });
            return context.json({ reports }, 200);
        },
    )
    .post(
        '/:gardenId/detailed-inspection-reports/seen',
        describeRoute({
            description:
                'Dismiss detailed raised bed inspection reports after the current user views the farmer notes.',
            security: authSecurity,
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator('json', detailedInspectionReportsSeenBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const { notificationIds } = context.req.valid('json');
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId, userId } = context.get('authContext');
            const garden = await getGarden(gardenIdNumber);
            if (!garden || garden.accountId !== accountId) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const reports = await loadDetailedRaisedBedInspectionReports({
                accountId,
                garden,
                userId,
            });
            const unreadReportIds = new Set(
                reports.map((report) => report.notificationId),
            );
            const dismissedNotificationIds = [
                ...new Set(notificationIds),
            ].filter((notificationId) => unreadReportIds.has(notificationId));

            if (dismissedNotificationIds.length > 0) {
                await setAllNotificationsRead(
                    accountId,
                    userId,
                    dismissedNotificationIds,
                    true,
                    'game_detailed_inspection_farmer',
                );
            }

            return context.json({ dismissedNotificationIds }, 200);
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
        zValidator('json', rescheduleOperationDiaryItemBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, operationId } = context.req.valid('param');
            const {
                expectedEntityId,
                expectedTaskVersionEventId,
                scheduledDate,
            } = context.req.valid('json');
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
                    expectedEntityId,
                    expectedTaskVersionEventId,
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
        zValidator('json', operationDiaryIdentityBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, operationId } = context.req.valid('param');
            const { expectedEntityId, expectedTaskVersionEventId } =
                context.req.valid('json');
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
                    expectedEntityId,
                    expectedTaskVersionEventId,
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
    .put(
        '/:gardenId/preview',
        describeRoute({
            description:
                'Upload a current day or night 3D preview for a public garden. Owners may capture their own public gardens; administrators may backfill any public garden.',
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
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const sourceRevision = context.req
                .header(gardenPreviewSourceRevisionHeader)
                ?.trim();
            if (
                !sourceRevision ||
                !gardenPreviewRevisionPattern.test(sourceRevision)
            ) {
                return context.json(
                    { error: 'Invalid garden preview source revision' },
                    400,
                );
            }

            const rendererVersion = context.req
                .header(gardenPreviewRendererVersionHeader)
                ?.trim();
            if (rendererVersion !== gardenPreviewRendererVersion) {
                return context.json(
                    { error: 'Unsupported garden preview renderer version' },
                    409,
                );
            }

            const requestedPhase = context.req
                .header(gardenPreviewPhaseHeader)
                ?.trim();
            const phase = requestedPhase ?? gardenPreviewDefaultPhase;
            if (!isGardenPreviewPhase(phase)) {
                return context.json(
                    { error: 'Invalid garden preview phase' },
                    400,
                );
            }

            const contentType = context.req
                .header('Content-Type')
                ?.split(';', 1)[0]
                ?.trim()
                .toLowerCase();
            if (contentType !== gardenPreviewContentType) {
                return context.json(
                    { error: 'Garden preview must be a WebP image' },
                    415,
                );
            }

            const contentLengthHeader = context.req.header('Content-Length');
            if (contentLengthHeader) {
                const contentLength = Number.parseInt(contentLengthHeader, 10);
                if (
                    !Number.isFinite(contentLength) ||
                    contentLength < 1 ||
                    contentLength > gardenPreviewMaxSizeBytes
                ) {
                    return context.json(
                        { error: 'Garden preview is too large' },
                        413,
                    );
                }
            }

            const { accountId, user } = context.get('authContext');
            const source = await getAuthorizedGardenPreviewSource(
                gardenIdNumber,
                { accountId, role: user.role },
            );
            if (!source) {
                return context.json({ error: 'Garden not found' }, 404);
            }
            if (!source.garden.isPublic) {
                return context.json(
                    {
                        error: 'Garden must be public before uploading a preview',
                    },
                    409,
                );
            }
            if (source.sourceRevision !== sourceRevision) {
                return context.json(
                    {
                        error: 'Garden changed before preview upload',
                        previewSourceRevision: source.sourceRevision,
                    },
                    409,
                );
            }

            const currentPreview = source.garden.previewImages[phase];
            const uploadDecision = getGardenPreviewUploadDecision({
                currentPreview,
                height: gardenPreviewHeight,
                rendererVersion,
                sourceRevision,
                width: gardenPreviewWidth,
            });
            if (uploadDecision.status === 'unchanged') {
                return context.json(
                    { phase, previewImage: uploadDecision.preview },
                    200,
                );
            }
            if (uploadDecision.status === 'rate-limited') {
                context.header(
                    'Retry-After',
                    uploadDecision.retryAfterSeconds.toString(),
                );
                return context.json(
                    { error: 'Garden preview was updated too recently' },
                    429,
                );
            }

            const imageBytes = new Uint8Array(
                await context.req.raw.arrayBuffer(),
            );
            if (
                imageBytes.byteLength < 1 ||
                imageBytes.byteLength > gardenPreviewMaxSizeBytes
            ) {
                return context.json(
                    { error: 'Garden preview is too large' },
                    413,
                );
            }

            const dimensions = readWebpDimensions(imageBytes);
            if (
                !dimensions ||
                dimensions.width !== gardenPreviewWidth ||
                dimensions.height !== gardenPreviewHeight
            ) {
                return context.json(
                    {
                        error: `Garden preview must be ${gardenPreviewWidth.toString()}x${gardenPreviewHeight.toString()} WebP`,
                    },
                    422,
                );
            }

            const captureRequestId = globalThis.crypto.randomUUID();
            let lease: Awaited<
                ReturnType<typeof acquireGardenPreviewCaptureLease>
            >;
            try {
                const now = new Date();
                lease = await acquireGardenPreviewCaptureLease({
                    expiresAt: new Date(
                        now.getTime() + gardenPreviewCaptureLeaseDurationMs,
                    ),
                    gardenId: gardenIdNumber,
                    leaseId: captureRequestId,
                    now,
                });
            } catch (error) {
                console.error(
                    'Failed to acquire garden preview capture lease',
                    {
                        error,
                        gardenId: gardenIdNumber,
                    },
                );
                return context.json(
                    { error: 'Failed to reserve garden preview capture' },
                    503,
                );
            }
            if (!lease) {
                context.header('Retry-After', '5');
                return context.json(
                    { error: 'Garden preview capture is already in progress' },
                    429,
                );
            }

            try {
                const leasedSource = await getAuthorizedGardenPreviewSource(
                    gardenIdNumber,
                    { accountId, role: user.role },
                );
                if (
                    !leasedSource?.garden.isPublic ||
                    leasedSource.sourceRevision !== sourceRevision
                ) {
                    return context.json(
                        {
                            error: 'Garden changed before preview upload',
                            previewSourceRevision:
                                leasedSource?.sourceRevision ?? null,
                        },
                        409,
                    );
                }

                const leasedUploadDecision = getGardenPreviewUploadDecision({
                    currentPreview: leasedSource.garden.previewImages[phase],
                    height: gardenPreviewHeight,
                    rendererVersion,
                    sourceRevision,
                    width: gardenPreviewWidth,
                });
                if (leasedUploadDecision.status === 'unchanged') {
                    return context.json(
                        { phase, previewImage: leasedUploadDecision.preview },
                        200,
                    );
                }
                if (leasedUploadDecision.status === 'rate-limited') {
                    context.header(
                        'Retry-After',
                        leasedUploadDecision.retryAfterSeconds.toString(),
                    );
                    return context.json(
                        { error: 'Garden preview was updated too recently' },
                        429,
                    );
                }

                const captureRequestedAt = new Date();
                const pathname = `garden-previews/${gardenIdNumber.toString()}/${phase}/${captureRequestId}.webp`;
                let uploadedPreview: Awaited<ReturnType<typeof put>>;

                try {
                    uploadedPreview = await put(
                        pathname,
                        Buffer.from(imageBytes),
                        {
                            access: 'public',
                            addRandomSuffix: false,
                            allowOverwrite: false,
                            cacheControlMaxAge: gardenPreviewCacheMaxAgeSeconds,
                            contentType: gardenPreviewContentType,
                            maximumSizeInBytes: gardenPreviewMaxSizeBytes,
                        },
                    );
                } catch (error) {
                    console.error('Failed to upload garden preview blob', {
                        error,
                        gardenId: gardenIdNumber,
                    });
                    return context.json(
                        { error: 'Failed to upload garden preview' },
                        502,
                    );
                }

                const latestSource = await getAuthorizedGardenPreviewSource(
                    gardenIdNumber,
                    { accountId, role: user.role },
                );
                if (
                    !latestSource?.garden.isPublic ||
                    latestSource.sourceRevision !== sourceRevision
                ) {
                    await deleteGardenPreviewBlob({
                        gardenId: gardenIdNumber,
                        imageUrl: uploadedPreview.url,
                        pathname: uploadedPreview.pathname,
                        reason: 'orphaned',
                    });
                    return context.json(
                        {
                            error: 'Garden changed during preview upload',
                            previewSourceRevision:
                                latestSource?.sourceRevision ?? null,
                        },
                        409,
                    );
                }

                let replacement: Awaited<
                    ReturnType<typeof replaceGardenPreview>
                >;
                try {
                    replacement = await replaceGardenPreview({
                        gardenId: gardenIdNumber,
                        captureRequestId,
                        imageUrl: uploadedPreview.url,
                        pathname: uploadedPreview.pathname,
                        contentType: gardenPreviewContentType,
                        byteSize: imageBytes.byteLength,
                        width: dimensions.width,
                        height: dimensions.height,
                        sourceRevision,
                        rendererVersion,
                        phase,
                        captureRequestedAt,
                        capturedAt: new Date(),
                    });
                } catch (error) {
                    await deleteGardenPreviewBlob({
                        gardenId: gardenIdNumber,
                        imageUrl: uploadedPreview.url,
                        pathname: uploadedPreview.pathname,
                        reason: 'orphaned',
                    });
                    console.error('Failed to persist garden preview', {
                        error,
                        gardenId: gardenIdNumber,
                    });
                    return context.json(
                        { error: 'Failed to save garden preview' },
                        500,
                    );
                }

                if (replacement.status === 'rejected') {
                    await deleteGardenPreviewBlob({
                        gardenId: gardenIdNumber,
                        imageUrl: uploadedPreview.url,
                        pathname: uploadedPreview.pathname,
                        reason: 'orphaned',
                    });
                    return context.json(
                        { error: 'A newer garden preview already exists' },
                        409,
                    );
                }

                if (
                    replacement.previousPreview &&
                    replacement.previousPreview.imageUrl !== uploadedPreview.url
                ) {
                    await deleteGardenPreviewBlob({
                        gardenId: gardenIdNumber,
                        imageUrl: replacement.previousPreview.imageUrl,
                        pathname: replacement.previousPreview.pathname,
                        reason: 'preview_replaced',
                    });
                }

                return context.json(
                    {
                        phase,
                        previewImage: toGardenPreviewImage(replacement.preview),
                    },
                    201,
                );
            } finally {
                try {
                    await releaseGardenPreviewCaptureLease({
                        gardenId: gardenIdNumber,
                        leaseId: captureRequestId,
                    });
                } catch (error) {
                    console.error(
                        'Failed to release garden preview capture lease',
                        { error, gardenId: gardenIdNumber },
                    );
                }
            }
        },
    )
    .get(
        '/:gardenId',
        describeRoute({
            description:
                'Get garden information for its owner, or for an administrator backfilling a public garden preview.',
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
            if (!Number.isInteger(gardenIdNumber) || gardenIdNumber < 1) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId, user } = context.get('authContext');
            const source = await getAuthorizedGardenPreviewSource(
                gardenIdNumber,
                { accountId, role: user.role },
            );
            if (!source) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            return context.json({
                ...source.details,
                // The managed Garden flag controls discovery, but mutation
                // authority remains fail-closed in this API deployment.
                gardenBuildingSystem: getGardenBuildingSystemAvailability(
                    source.garden.isSandbox,
                ),
                previewSourceRevision: source.sourceRevision,
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
            if (!Number.isInteger(gardenIdNumber) || gardenIdNumber < 1) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const [garden, blocks] = await Promise.all([
                getPublicGarden(gardenIdNumber),
                getGardenBlocks(gardenIdNumber),
            ]);
            if (!garden) {
                return context.json({ error: 'Garden not found' }, 404);
            }

            const [operations, queuedTasks, structures] = await Promise.all([
                getAppliedRaisedBedOperationsForGarden(
                    garden.accountId,
                    gardenIdNumber,
                ),
                getGardenQueuedTasks(garden),
                listGardenStructures(gardenIdNumber),
            ]);
            const gardenDetails = await serializeGardenDetails(
                garden,
                blocks,
                operations,
                structures,
                { publicView: true },
            );
            const {
                previewImage: ownerPreviewImage,
                previewImages: ownerPreviewImages,
                ...publicGardenDetails
            } = gardenDetails;
            const likeCounts = await getGardenLikeCounts([garden.id]);

            return context.json({
                ...publicGardenDetails,
                previewImage:
                    serializePublicGardenPreviewImage(ownerPreviewImage),
                previewImages:
                    serializePublicGardenPreviewImages(ownerPreviewImages),
                likeCount: likeCounts.get(garden.id) ?? 0,
                queuedTasks,
            });
        },
    )
    .post(
        '/:gardenId/public/visitors',
        describeRoute({
            description:
                'Publish an anonymous visitor position and read other live visitors',
            security: publicSecurity,
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
            }),
        ),
        zValidator('json', publicGardenVisitorPresenceBodySchema),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (!Number.isInteger(gardenIdNumber) || gardenIdNumber < 1) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const withinRateLimit = await publicGardenVisitorRateLimitAllows(
                publicGardenVisitorClientAddress(context.req.raw.headers),
            );
            if (!withinRateLimit) {
                context.header('Retry-After', '1');
                return context.json(
                    { error: 'Too many visitor presence requests' },
                    429,
                );
            }

            const body = context.req.valid('json');
            if (body.action === 'leave') {
                const result = await removePublicGardenVisitorPresence({
                    gardenId: gardenIdNumber,
                    visitorCapability: body.visitorCapability,
                    visitorId: body.visitorId,
                });
                if (result.status === 'unauthorized') {
                    return context.json(
                        { error: 'Invalid visitor capability' },
                        403,
                    );
                }
                return context.json({
                    live: result.status === 'removed',
                    visitors: [],
                });
            }

            const result = await updatePublicGardenVisitorPresence({
                gardenId: gardenIdNumber,
                presence: body,
            });
            if (result.status === 'unauthorized') {
                return context.json(
                    { error: 'Invalid visitor capability' },
                    403,
                );
            }
            if (result.status === 'unavailable') {
                return context.json({ live: false, visitors: [] });
            }
            return context.json({
                live: result.live,
                visitorCapability: result.visitorCapability,
                visitors: result.visitors,
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
                homeCamera: gardenHomeCameraSchema.nullable().optional(),
                isPublic: z.boolean().optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId } = context.req.valid('param');
            const { backgroundPalette, homeCamera, isPublic, name } =
                context.req.valid('json');
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
            const updateData: Parameters<typeof updateGarden>[0] = {
                id: gardenIdNumber,
            };
            if (name !== undefined) {
                updateData.name = name.trim();
            }
            if (backgroundPalette !== undefined) {
                updateData.backgroundPalette = backgroundPalette;
            }
            if (homeCamera !== undefined) {
                updateData.homeCamera = homeCamera;
            }
            if (isPublic !== undefined) {
                updateData.isPublic = isPublic;
            }

            const existingPreviews =
                isPublic === false
                    ? await getGardenPreviews(gardenIdNumber)
                    : [];
            await updateGarden(updateData);
            await deleteGardenPreviewBlobs({
                gardenId: gardenIdNumber,
                previews: existingPreviews,
                reason: 'garden_unpublished',
            });

            return context.json({ success: true });
        },
    )
    .delete(
        '/:gardenId',
        describeRoute({
            description:
                'Delete a garden accessible to the current user. Sandbox gardens are deleted completely, including related blocks, raised beds, notifications, operations, cart rows, transactions, and events. Real gardens are soft-deleted only when they have no active raised beds or structures. Large sandbox deletions may return 202 and should be retried until complete.',
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
            const gardenIdNumber = parseGardenDeletionId(gardenId);
            if (gardenIdNumber === null) {
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
            const existingPreviews = await getGardenPreviews(gardenIdNumber);

            if (!garden.isSandbox) {
                const result = await deleteRealGardenForAccount({
                    accountId: garden.accountId,
                    gardenId: gardenIdNumber,
                });
                if (!result.ok) {
                    return context.json(
                        {
                            code: result.code,
                            error: result.error,
                            ...(result.activeRaisedBedCount === undefined
                                ? {}
                                : {
                                      activeRaisedBedCount:
                                          result.activeRaisedBedCount,
                                  }),
                            ...(result.activeStructureCount === undefined
                                ? {}
                                : {
                                      activeStructureCount:
                                          result.activeStructureCount,
                                  }),
                        },
                        result.status,
                    );
                }

                if (result.deleted) {
                    await deleteGardenPreviewBlobs({
                        gardenId: gardenIdNumber,
                        previews: existingPreviews,
                        reason: 'garden_deleted',
                    });
                }

                return context.json(
                    {
                        success: true,
                        complete: true,
                        deletedRows: result.deleted ? 1 : 0,
                    },
                    200,
                );
            }

            try {
                const result = await deleteSandboxGardenCompletely(
                    gardenIdNumber,
                    { accountId: garden.accountId },
                );
                await deleteGardenPreviewBlobs({
                    gardenId: gardenIdNumber,
                    previews: existingPreviews,
                    reason: 'garden_deleted',
                });

                return context.json(
                    { success: true, ...result },
                    result.complete ? 200 : 202,
                );
            } catch (error) {
                if (error instanceof AccountDeletionInProgressError) {
                    return context.json({ error: error.message }, 409);
                }
                if (error instanceof AccountNotFoundError) {
                    return context.json({ error: 'Garden not found' }, 404);
                }
                throw error;
            }
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
            z
                .array(
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
                )
                .max(256),
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
            const operations = context.req.valid('json');
            const result = await patchGardenStacksForAccount({
                accountId,
                gardenId: gardenIdNumber,
                operations,
            });
            if (!result.ok) {
                return context.json({ error: result.error }, result.status);
            }

            return context.json(null, 200);
        },
    )
    .post(
        '/:gardenId/blocks/:blockId/store-in-garden-box',
        describeRoute({
            description:
                'Atomically move a garden block into garden-box inventory with deterministic exact replay from the source block identity.',
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
            const { blockIndex, entityId, gardenBoxBlockId, sourcePosition } =
                context.req.valid('json');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber) || gardenIdNumber <= 0) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            try {
                const result = await storeGardenBlockInGardenBoxForAccount({
                    accountId,
                    blockId,
                    blockIndex,
                    entityId,
                    gardenBoxBlockId,
                    gardenId: gardenIdNumber,
                    sourcePosition,
                });
                if (!result.ok) {
                    return context.json(
                        { code: result.code, error: result.error },
                        result.status,
                    );
                }

                return context.json({
                    gardenBoxBlockId: result.gardenBoxBlockId,
                    item: result.item,
                });
            } catch (error) {
                console.error('Failed to store block in garden box', {
                    accountId,
                    blockId,
                    gardenBoxBlockId,
                    gardenId: gardenIdNumber,
                    error,
                });
                return context.json(
                    { error: 'Failed to store block in garden box' },
                    500,
                );
            }
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

            if (!result.ok) {
                return context.json(
                    { code: result.code, error: result.error },
                    result.status,
                );
            }

            return context.json({ reward: result.reward }, 200);
        },
    )
    .post(
        '/:gardenId/blocks',
        describeRoute({
            description:
                'Purchase and atomically place a block in a garden for the current user. Exact retries with the same client-supplied operation ID replay the saved result; legacy requests without one receive a new server-generated ID per request.',
            security: authSecurity,
            tags: ['Gardens'],
        }),
        zValidator('param', gardenBlockPurchaseParamSchema),
        zValidator('json', gardenBlockPurchaseBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId: gardenIdNumber } = context.req.valid('param');

            const { accountId } = context.get('authContext');
            const {
                blockName,
                expectedExistingBlocks,
                operationId,
                position,
                variant,
            } = context.req.valid('json');
            const purchaseResult = await purchaseGardenBlock({
                accountId,
                blockName,
                expectedExistingBlocks,
                gardenId: gardenIdNumber,
                operationId:
                    operationId ??
                    `legacy-block-purchase-${globalThis.crypto.randomUUID()}`,
                position,
                variant,
            });
            if (!purchaseResult.ok) {
                return context.json(
                    {
                        code: purchaseResult.code,
                        error: purchaseResult.error,
                    },
                    purchaseResult.status,
                );
            }

            return context.json({
                id: purchaseResult.blockId,
                position: purchaseResult.position,
                variant: purchaseResult.variant,
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
        zValidator('json', updateGardenBlockBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, blockId } = context.req.valid('param');
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber)) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const body = context.req.valid('json');
            const result = await updateGardenBlockForAccount({
                accountId,
                blockId,
                gardenId: gardenIdNumber,
                ...body,
            });
            if (!result.ok) {
                return context.json({ error: result.error }, result.status);
            }

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
            const gardenIdNumber = parseInt(gardenId, 10);
            if (Number.isNaN(gardenIdNumber) || gardenIdNumber <= 0) {
                return context.json({ error: 'Invalid garden ID' }, 400);
            }

            const { accountId } = context.get('authContext');
            const result = await recycleGardenBlockForAccount({
                accountId,
                blockId,
                gardenId: gardenIdNumber,
            });
            if (!result.ok) {
                return context.json({ error: result.error }, result.status);
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
            if (raisedBed.status !== 'active') {
                return context.json(
                    { error: 'Only active raised beds can be abandoned' },
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

            const diaryEntries = await getRaisedBedDiaryEntries(
                raisedBedIdNumber,
                { includeUnverifiedOperationEvidence: false },
            );
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
        '/:gardenId/raised-beds/:raisedBedId/plantings/:plantingId/reschedule',
        describeRoute({
            description:
                'Reschedule one selected Advanced Sowing planting for the current garden owner',
            security: authSecurity,
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                plantingId: z.string(),
                raisedBedId: z.string(),
            }),
        ),
        zValidator('json', rescheduleSelectedPlantingBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, plantingId, raisedBedId } =
                context.req.valid('param');
            const {
                commandId,
                expectedLifecycleVersionEventId,
                expectedPlantSortId,
                scheduledDate,
                sowingLocation,
            } = context.req.valid('json');
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            const plantingIdNumber = Number.parseInt(plantingId, 10);
            const raisedBedIdNumber = Number.parseInt(raisedBedId, 10);
            if (
                !Number.isSafeInteger(gardenIdNumber) ||
                gardenIdNumber <= 0 ||
                !Number.isSafeInteger(plantingIdNumber) ||
                plantingIdNumber <= 0 ||
                !Number.isSafeInteger(raisedBedIdNumber) ||
                raisedBedIdNumber <= 0
            ) {
                return context.json({ error: 'Invalid planting target' }, 400);
            }

            const { accountId, userId } = context.get('authContext');
            try {
                if (
                    !(await selectedPlantingMatchesGardenRoute({
                        accountId,
                        gardenId: gardenIdNumber,
                        plantingId: plantingIdNumber,
                        raisedBedId: raisedBedIdNumber,
                    }))
                ) {
                    return context.json({ error: 'Planting not found' }, 404);
                }
                const result =
                    await rescheduleSelectedRaisedBedPlantingTaskForOwner({
                        commandId,
                        expectedLifecycleVersionEventId,
                        expectedPlantSortId,
                        kind: 'selected',
                        owner: { accountId, userId },
                        plantingId: plantingIdNumber,
                        scheduledDate,
                        sowingLocation,
                    });
                return context.json(
                    {
                        created: result.created,
                        scheduledDate: result.task.scheduledDate,
                        sowingLocation: result.task.sowingLocation,
                        status: result.task.status,
                    },
                    200,
                );
            } catch (error) {
                if (error instanceof ScheduleTaskSubmissionError) {
                    return selectedPlantingOwnerErrorResponse(context, error);
                }
                console.error('Failed to reschedule selected planting', {
                    accountId,
                    error,
                    gardenId: gardenIdNumber,
                    plantingId: plantingIdNumber,
                    raisedBedId: raisedBedIdNumber,
                });
                return context.json(
                    { error: 'Failed to reschedule planting' },
                    500,
                );
            }
        },
    )
    .post(
        '/:gardenId/raised-beds/:raisedBedId/plantings/:plantingId/cancel',
        describeRoute({
            description:
                'Cancel one future selected Advanced Sowing planting for the current garden owner',
            security: authSecurity,
        }),
        zValidator(
            'param',
            z.object({
                gardenId: z.string(),
                plantingId: z.string(),
                raisedBedId: z.string(),
            }),
        ),
        zValidator('json', cancelSelectedPlantingBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, plantingId, raisedBedId } =
                context.req.valid('param');
            const {
                commandId,
                effectiveAt,
                expectedLifecycleVersionEventId,
                expectedPlantSortId,
                reason,
            } = context.req.valid('json');
            const gardenIdNumber = Number.parseInt(gardenId, 10);
            const plantingIdNumber = Number.parseInt(plantingId, 10);
            const raisedBedIdNumber = Number.parseInt(raisedBedId, 10);
            if (
                !Number.isSafeInteger(gardenIdNumber) ||
                gardenIdNumber <= 0 ||
                !Number.isSafeInteger(plantingIdNumber) ||
                plantingIdNumber <= 0 ||
                !Number.isSafeInteger(raisedBedIdNumber) ||
                raisedBedIdNumber <= 0
            ) {
                return context.json({ error: 'Invalid planting target' }, 400);
            }

            const { accountId, userId } = context.get('authContext');
            try {
                if (
                    !(await selectedPlantingMatchesGardenRoute({
                        accountId,
                        gardenId: gardenIdNumber,
                        plantingId: plantingIdNumber,
                        raisedBedId: raisedBedIdNumber,
                    }))
                ) {
                    return context.json({ error: 'Planting not found' }, 404);
                }
                const result =
                    await cancelSelectedRaisedBedPlantingTaskForOwner({
                        commandId,
                        ...(effectiveAt ? { effectiveAt } : {}),
                        expectedLifecycleVersionEventId,
                        expectedPlantSortId,
                        kind: 'selected',
                        owner: { accountId, userId },
                        plantingId: plantingIdNumber,
                        reason,
                    });
                return context.json(
                    {
                        created: result.created,
                        isActive: result.isActive,
                        lifecycleStatus: result.lifecycleStatus,
                        refundAmount:
                            result.task.cancellation?.refundSunflowerAmount ??
                            0,
                        status: result.task.status,
                    },
                    200,
                );
            } catch (error) {
                if (error instanceof ScheduleTaskSubmissionError) {
                    return selectedPlantingOwnerErrorResponse(context, error);
                }
                console.error('Failed to cancel selected planting', {
                    accountId,
                    error,
                    gardenId: gardenIdNumber,
                    plantingId: plantingIdNumber,
                    raisedBedId: raisedBedIdNumber,
                });
                return context.json(
                    { error: 'Failed to cancel planting' },
                    500,
                );
            }
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
        zValidator('json', reschedulePlantingDiaryItemBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const {
                expectedPlantCycleEventId,
                expectedPlantCycleVersionEventId,
                expectedPlantSortId,
                scheduledDate,
            } = context.req.valid('json');
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
                    expectedPlantCycleEventId,
                    expectedPlantCycleVersionEventId,
                    expectedPlantSortId,
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
        zValidator('json', plantingDiaryAttemptIdentityBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const {
                expectedPlantCycleEventId,
                expectedPlantCycleVersionEventId,
                expectedPlantSortId,
            } = context.req.valid('json');
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
                    expectedPlantCycleEventId,
                    expectedPlantCycleVersionEventId,
                    expectedPlantSortId,
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
            plantingDiaryAttemptIdentityBodySchema.extend({
                status: z.string(),
                timestamp: z.string().datetime().optional(),
            }),
        ),
        authValidator(['user', 'admin']),
        async (context) => {
            const { gardenId, raisedBedId, positionIndex } =
                context.req.valid('param');
            const {
                expectedPlantCycleEventId,
                expectedPlantCycleVersionEventId,
                expectedPlantSortId,
                status,
                timestamp,
            } = context.req.valid('json');

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

            const { accountId } = context.get('authContext');
            const allowedFromStates = Object.entries(
                userAllowedPlantStatusTransitions,
            )
                .filter(([, targets]) => targets.includes(status))
                .map(([source]) => source);
            let createdAt: Date | undefined;
            if (timestamp) {
                createdAt = new Date(timestamp);
                if (Number.isNaN(createdAt.getTime())) {
                    return context.json({ error: 'Invalid timestamp' }, 400);
                }
            }

            try {
                return await withPlantingScheduleTaskTransaction(
                    raisedBedIdNumber,
                    positionIndexNumber,
                    async (transaction) => {
                        const raisedBed =
                            await transaction.query.raisedBeds.findFirst({
                                where: (table, { and, eq }) =>
                                    and(
                                        eq(table.id, raisedBedIdNumber),
                                        eq(table.isDeleted, false),
                                    ),
                            });
                        if (
                            !raisedBed ||
                            raisedBed.gardenId !== gardenIdNumber ||
                            raisedBed.accountId !== accountId
                        ) {
                            return context.json(
                                { error: 'Raised bed not found' },
                                404,
                            );
                        }
                        if (isRaisedBedAbandoned(raisedBed.status)) {
                            return context.json(
                                { error: 'Raised bed is abandoned' },
                                409,
                            );
                        }

                        const field = (
                            await getRaisedBedFieldsWithEvents(
                                raisedBedIdNumber,
                                transaction,
                            )
                        ).find(
                            (candidate) =>
                                candidate.positionIndex ===
                                    positionIndexNumber && candidate.active,
                        );
                        if (!field) {
                            return context.json(
                                { error: 'Field not found or not active' },
                                404,
                            );
                        }
                        const activePlantCycle = field.plantCycles.find(
                            (plantCycle) => plantCycle.active,
                        );
                        if (
                            activePlantCycle?.plantPlaceEventId !==
                                expectedPlantCycleEventId ||
                            activePlantCycle?.endedEventId !==
                                expectedPlantCycleVersionEventId ||
                            field.plantSortId !== expectedPlantSortId
                        ) {
                            return context.json(
                                {
                                    error: 'Planting changed. Refresh the garden and try again.',
                                },
                                409,
                            );
                        }
                        if (status === 'removed' && !field.toBeRemoved) {
                            return context.json(
                                {
                                    error: 'Plant cannot be removed at this time. Only plants that are dead, harvested, or failed to sprout can be removed.',
                                },
                                400,
                            );
                        }
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
                        if (activePlantCycle) {
                            const currentDate = new Date();
                            if (
                                !isPlantStatusEffectiveDateAllowed({
                                    currentDate,
                                    effectiveDate: createdAt ?? currentDate,
                                    plantCycleStartedAt:
                                        activePlantCycle.startedAt,
                                    previousStatusChangedAt:
                                        getPreviousPlantStatusChangedAtForUpdate(
                                            {
                                                currentStatus:
                                                    field.plantStatus,
                                                latestStatusChangedAt:
                                                    field.plantStatusChangedAt,
                                                nextStatus: status,
                                                statusChanges:
                                                    activePlantCycle.statusChanges,
                                            },
                                        ),
                                })
                            ) {
                                return context.json(
                                    {
                                        error: 'Timestamp must be between the latest field lifecycle date and today',
                                    },
                                    400,
                                );
                            }
                        }

                        await createEvent(
                            knownEvents.raisedBedFields.plantUpdateV1(
                                `${raisedBedIdNumber.toString()}|${positionIndexNumber.toString()}`,
                                {
                                    status,
                                    ...(createdAt
                                        ? {
                                              effectiveDate:
                                                  createdAt.toISOString(),
                                          }
                                        : {}),
                                },
                            ),
                            transaction,
                        );

                        return context.json({ success: true }, 200);
                    },
                );
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
                { includeUnverifiedOperationEvidence: false },
            );
            return context.json(diaryEntries);
        },
    );

export default app;
