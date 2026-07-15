import { isRaisedBedAbandoned } from '@gredice/js/raisedBeds';
import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import { and, eq } from 'drizzle-orm';
import type { EntityStandardized } from '../@types/EntityStandardized';
import { events, raisedBeds } from '../schema';
import { earnSunflowers } from './accountsRepo';
import { getEntityFormatted } from './entitiesRepo';
import { createEvent, knownEvents, knownEventTypes } from './eventsRepo';
import {
    getMinimumDiaryRescheduleDate,
    isReschedulableFieldPlantStatus,
    isReschedulableOperationStatus,
    startOfUtcDay,
} from './gardenDiaryRescheduleRepo';
import { deleteRaisedBedField, getRaisedBed } from './gardensRepo';
import { createNotification } from './notificationsRepo';
import { getOperationsByIds } from './operationsRepo';
import { getRaisedBedFieldsWithEvents } from './raisedBedFieldsRepo';
import {
    type ScheduleTaskTransaction,
    withOperationScheduleTaskTransaction,
    withPlantingScheduleTaskTransaction,
} from './scheduleTaskSubmissionsRepo';
import { getRaisedBedFieldSunflowerRefundAmount } from './shoppingCartRepo';

export type GardenDiaryCancelStatusCode = 400 | 404 | 409;

export class GardenDiaryCancelError extends Error {
    constructor(
        message: string,
        public readonly statusCode: GardenDiaryCancelStatusCode,
    ) {
        super(message);
        this.name = 'GardenDiaryCancelError';
    }
}

const defaultUserCancelReason = 'Korisnik je otkazao.';

export type GardenDiaryCancelDependencies = {
    createNotification: typeof createNotification;
    earnSunflowers: typeof earnSunflowers;
};

const defaultGardenDiaryCancelDependencies: GardenDiaryCancelDependencies = {
    createNotification,
    earnSunflowers,
};

function cancelDependencies(
    dependencies?: Partial<GardenDiaryCancelDependencies>,
): GardenDiaryCancelDependencies {
    return {
        ...defaultGardenDiaryCancelDependencies,
        ...dependencies,
    };
}

function normalizeRefundAmount(refundAmount: number) {
    if (!Number.isSafeInteger(refundAmount) || refundAmount < 0) {
        throw new Error(
            'Cancellation refund amount must be a non-negative safe integer.',
        );
    }
    return refundAmount;
}

type OperationTaskCancellationInput = {
    canceledBy: string;
    expectedEntityId: number;
    expectedTaskVersionEventId: number;
    notificationRequested: boolean;
    operationId: number;
    operatorNotificationRequested: boolean;
    reason: string;
    refundAmount: number;
};

type PlantingTaskCancellationInput = {
    canceledBy: string;
    expectedFieldId?: number;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    expectedPlantStatus?: string;
    expectedPlantStatusEventId?: number;
    fallbackRefundAmount: number;
    notificationRequested: boolean;
    positionIndex: number;
    raisedBedId: number;
    reason: string;
    refundEnabled: boolean;
};

function operationCancellationMetadata(
    event: { data: unknown; createdAt: Date; id: number },
    input: OperationTaskCancellationInput,
) {
    const data = event.data;
    if (
        !data ||
        typeof data !== 'object' ||
        !('canceledBy' in data) ||
        typeof data.canceledBy !== 'string' ||
        !('reason' in data) ||
        typeof data.reason !== 'string' ||
        !('expectedEntityId' in data) ||
        data.expectedEntityId !== input.expectedEntityId ||
        !('expectedTaskVersionEventId' in data) ||
        data.expectedTaskVersionEventId !== input.expectedTaskVersionEventId
    ) {
        return null;
    }

    return {
        canceledBy: data.canceledBy,
        canceledAt: event.createdAt,
        cancellationEventId: event.id,
        notificationRequested:
            'notificationRequested' in data &&
            typeof data.notificationRequested === 'boolean'
                ? data.notificationRequested
                : true,
        operatorNotificationRequested:
            'operatorNotificationRequested' in data &&
            typeof data.operatorNotificationRequested === 'boolean'
                ? data.operatorNotificationRequested
                : false,
        refundAmount:
            'refundAmount' in data &&
            typeof data.refundAmount === 'number' &&
            Number.isSafeInteger(data.refundAmount) &&
            data.refundAmount >= 0
                ? data.refundAmount
                : 0,
        reason: data.reason,
    };
}

function plantingCancellationMetadata(
    event: { data: unknown; createdAt: Date; id: number },
    input: PlantingTaskCancellationInput,
) {
    const data = event.data;
    if (
        !data ||
        typeof data !== 'object' ||
        !('canceledBy' in data) ||
        typeof data.canceledBy !== 'string' ||
        !('reason' in data) ||
        typeof data.reason !== 'string' ||
        !('expectedPlantCycleEventId' in data) ||
        data.expectedPlantCycleEventId !== input.expectedPlantCycleEventId ||
        !('expectedPlantCycleVersionEventId' in data) ||
        data.expectedPlantCycleVersionEventId !==
            input.expectedPlantCycleVersionEventId ||
        !('expectedPlantSortId' in data) ||
        data.expectedPlantSortId !== input.expectedPlantSortId
    ) {
        return null;
    }

    return {
        canceledBy: data.canceledBy,
        canceledAt: event.createdAt,
        cancellationEventId: event.id,
        notificationRequested:
            'notificationRequested' in data &&
            typeof data.notificationRequested === 'boolean'
                ? data.notificationRequested
                : true,
        refundAmount:
            'refundAmount' in data &&
            typeof data.refundAmount === 'number' &&
            Number.isSafeInteger(data.refundAmount) &&
            data.refundAmount >= 0
                ? data.refundAmount
                : 0,
        reason: data.reason,
    };
}

async function getCancellationEvent(
    transaction: ScheduleTaskTransaction,
    {
        aggregateId,
        eventId,
        eventType,
    }: { aggregateId: string; eventId: number; eventType: string },
) {
    return transaction.query.events.findFirst({
        where: and(
            eq(events.id, eventId),
            eq(events.aggregateId, aggregateId),
            eq(events.type, eventType),
        ),
    });
}

function assertScheduledDateCanCancel(
    scheduledDate: Date | undefined,
    referenceDate: Date,
) {
    if (!scheduledDate) {
        throw new GardenDiaryCancelError(
            'Only scheduled future items can be canceled.',
            409,
        );
    }

    if (
        startOfUtcDay(scheduledDate).getTime() <
        getMinimumDiaryRescheduleDate(referenceDate).getTime()
    ) {
        throw new GardenDiaryCancelError(
            'Items scheduled for today or earlier cannot be canceled.',
            409,
        );
    }
}

function calculateSunflowerRefund(price: number | undefined) {
    return typeof price === 'number' && price > 0
        ? Math.round(price * 1000)
        : 0;
}

async function operationBelongsToGarden({
    accountId,
    gardenId,
    operation,
    transaction,
}: {
    accountId: string;
    gardenId: number;
    operation: Awaited<ReturnType<typeof getOperationsByIds>>[number];
    transaction: ScheduleTaskTransaction;
}) {
    if (operation.accountId !== accountId) {
        return false;
    }

    if (operation.gardenId === gardenId && !operation.raisedBedId) {
        return true;
    }

    if (!operation.raisedBedId) {
        return operation.gardenId === gardenId;
    }

    const raisedBed = await transaction.query.raisedBeds.findFirst({
        columns: { accountId: true, gardenId: true },
        where: and(
            eq(raisedBeds.id, operation.raisedBedId),
            eq(raisedBeds.isDeleted, false),
        ),
    });
    return (
        Boolean(raisedBed) &&
        raisedBed?.accountId === accountId &&
        raisedBed.gardenId === gardenId
    );
}

async function getDiaryRaisedBed(
    raisedBedId: number,
    transaction: ScheduleTaskTransaction,
) {
    const raisedBed = await transaction.query.raisedBeds.findFirst({
        where: and(
            eq(raisedBeds.id, raisedBedId),
            eq(raisedBeds.isDeleted, false),
        ),
    });
    if (!raisedBed) {
        return null;
    }

    return {
        ...raisedBed,
        fields: await getRaisedBedFieldsWithEvents(raisedBedId, transaction),
    };
}

function buildRaisedBedNotificationLink(
    raisedBedName: string | null | undefined,
    positionIndex: number | null | undefined,
) {
    if (!raisedBedName) {
        return undefined;
    }

    return getRaisedBedCloseupUrl(
        raisedBedName,
        typeof positionIndex === 'number' ? { positionIndex } : undefined,
    );
}

type OperationCancellationErrors = {
    changed: () => Error;
    notFound: () => Error;
    terminal: () => Error;
};

async function cancelOperationTaskAtomically(
    input: OperationTaskCancellationInput,
    {
        errors,
        expectedStatus,
        validateAccess,
        validateCurrent,
    }: {
        errors: OperationCancellationErrors;
        expectedStatus?: string;
        validateAccess?: (
            operation: Awaited<ReturnType<typeof getOperationsByIds>>[number],
            transaction: ScheduleTaskTransaction,
        ) => Promise<void>;
        validateCurrent?: (
            operation: Awaited<ReturnType<typeof getOperationsByIds>>[number],
            transaction: ScheduleTaskTransaction,
        ) => Promise<void>;
    },
    transaction?: ScheduleTaskTransaction,
    dependencies?: Partial<GardenDiaryCancelDependencies>,
) {
    const effects = cancelDependencies(dependencies);
    const refundAmount = normalizeRefundAmount(input.refundAmount);

    return withOperationScheduleTaskTransaction(
        input.operationId,
        async (transaction) => {
            const [currentOperation] = await getOperationsByIds(
                [input.operationId],
                transaction,
            );
            if (!currentOperation) {
                throw errors.notFound();
            }
            await validateAccess?.(currentOperation, transaction);

            if (currentOperation.status === 'canceled') {
                const cancellationEvent = await getCancellationEvent(
                    transaction,
                    {
                        aggregateId: input.operationId.toString(),
                        eventId: currentOperation.taskVersionEventId,
                        eventType: knownEventTypes.operations.cancel,
                    },
                );
                const metadata = cancellationEvent
                    ? operationCancellationMetadata(cancellationEvent, input)
                    : null;
                if (!metadata) {
                    throw errors.changed();
                }
                return {
                    ...metadata,
                    created: false,
                    operation: currentOperation,
                };
            }

            if (
                currentOperation.entityId !== input.expectedEntityId ||
                currentOperation.taskVersionEventId !==
                    input.expectedTaskVersionEventId ||
                (expectedStatus !== undefined &&
                    currentOperation.status !== expectedStatus)
            ) {
                throw errors.changed();
            }
            if (!isReschedulableOperationStatus(currentOperation.status)) {
                throw errors.terminal();
            }
            await validateCurrent?.(currentOperation, transaction);

            const cancellationEvent = await createEvent(
                knownEvents.operations.canceledV1(
                    input.operationId.toString(),
                    {
                        canceledBy: input.canceledBy,
                        expectedEntityId: input.expectedEntityId,
                        expectedTaskVersionEventId:
                            input.expectedTaskVersionEventId,
                        notificationRequested: input.notificationRequested,
                        operatorNotificationRequested:
                            input.operatorNotificationRequested,
                        reason: input.reason,
                        refundAmount,
                    },
                ),
                transaction,
            );

            if (refundAmount > 0) {
                if (!currentOperation.accountId) {
                    throw new Error(
                        'Cannot refund an operation without an account.',
                    );
                }
                await effects.earnSunflowers(
                    currentOperation.accountId,
                    refundAmount,
                    `refund:operation:${input.operationId.toString()}`,
                    transaction,
                );
            }

            return {
                canceledBy: input.canceledBy,
                canceledAt: cancellationEvent.createdAt,
                cancellationEventId: cancellationEvent.id,
                created: true,
                notificationRequested: input.notificationRequested,
                operation: currentOperation,
                operatorNotificationRequested:
                    input.operatorNotificationRequested,
                reason: input.reason,
                refundAmount,
            };
        },
        transaction,
    );
}

export async function cancelOperationTaskWithRefund(
    input: OperationTaskCancellationInput & { expectedStatus: string },
    transaction?: ScheduleTaskTransaction,
    dependencies?: Partial<GardenDiaryCancelDependencies>,
) {
    return cancelOperationTaskAtomically(
        input,
        {
            errors: {
                changed: () =>
                    new Error(
                        'Radnja se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
                    ),
                notFound: () =>
                    new Error(
                        `Operation with ID ${input.operationId.toString()} not found.`,
                    ),
                terminal: () =>
                    new Error('Dovršena radnja ne može se otkazati.'),
            },
            expectedStatus: input.expectedStatus,
        },
        transaction,
        dependencies,
    );
}

type PlantingCancellationErrors = {
    changed: () => Error;
    fieldNotFound: () => Error;
    raisedBedNotFound: () => Error;
    terminal: () => Error;
};

async function cancelPlantingTaskAtomically(
    input: PlantingTaskCancellationInput,
    {
        errors,
        validateAccess,
        validateCurrent,
    }: {
        errors: PlantingCancellationErrors;
        validateAccess?: (
            raisedBed: NonNullable<
                Awaited<ReturnType<typeof getDiaryRaisedBed>>
            >,
            transaction: ScheduleTaskTransaction,
        ) => Promise<void>;
        validateCurrent?: (
            raisedBed: NonNullable<
                Awaited<ReturnType<typeof getDiaryRaisedBed>>
            >,
            field: NonNullable<
                Awaited<ReturnType<typeof getDiaryRaisedBed>>
            >['fields'][number],
            transaction: ScheduleTaskTransaction,
        ) => Promise<void>;
    },
    transaction?: ScheduleTaskTransaction,
    dependencies?: Partial<GardenDiaryCancelDependencies>,
) {
    const effects = cancelDependencies(dependencies);
    const fallbackRefundAmount = normalizeRefundAmount(
        input.fallbackRefundAmount,
    );
    const aggregateId = `${input.raisedBedId.toString()}|${input.positionIndex.toString()}`;

    return withPlantingScheduleTaskTransaction(
        input.raisedBedId,
        input.positionIndex,
        async (transaction) => {
            const currentRaisedBed = await getDiaryRaisedBed(
                input.raisedBedId,
                transaction,
            );
            if (!currentRaisedBed) {
                throw errors.raisedBedNotFound();
            }
            await validateAccess?.(currentRaisedBed, transaction);

            const fieldAtPosition = currentRaisedBed.fields.find(
                (candidate) => candidate.positionIndex === input.positionIndex,
            );
            const canceledPlantCycle = fieldAtPosition?.plantCycles.find(
                (cycle) =>
                    cycle.plantPlaceEventId === input.expectedPlantCycleEventId,
            );
            if (canceledPlantCycle && !canceledPlantCycle.active) {
                const cancellationEvent = await getCancellationEvent(
                    transaction,
                    {
                        aggregateId,
                        eventId: canceledPlantCycle.endedEventId,
                        eventType: knownEventTypes.raisedBedFields.delete,
                    },
                );
                const metadata = cancellationEvent
                    ? plantingCancellationMetadata(cancellationEvent, input)
                    : null;
                if (metadata) {
                    return {
                        ...metadata,
                        created: false,
                        field: fieldAtPosition,
                        plantCycle: canceledPlantCycle,
                        plantSortId: input.expectedPlantSortId,
                        raisedBed: currentRaisedBed,
                    };
                }
            }

            const currentField = currentRaisedBed.fields.find(
                (candidate) =>
                    candidate.positionIndex === input.positionIndex &&
                    candidate.active,
            );
            const activePlantCycle = currentField?.plantCycles.find(
                (cycle) => cycle.active,
            );
            if (!currentField?.plantSortId || !activePlantCycle) {
                throw errors.fieldNotFound();
            }
            if (
                (input.expectedFieldId !== undefined &&
                    currentField.id !== input.expectedFieldId) ||
                currentField.plantSortId !== input.expectedPlantSortId ||
                activePlantCycle.plantPlaceEventId !==
                    input.expectedPlantCycleEventId ||
                activePlantCycle.endedEventId !==
                    input.expectedPlantCycleVersionEventId ||
                (input.expectedPlantStatus !== undefined &&
                    currentField.plantStatus !== input.expectedPlantStatus) ||
                (input.expectedPlantStatusEventId !== undefined &&
                    currentField.plantStatusEventId !==
                        input.expectedPlantStatusEventId)
            ) {
                throw errors.changed();
            }
            if (!isReschedulableFieldPlantStatus(currentField.plantStatus)) {
                throw errors.terminal();
            }
            await validateCurrent?.(
                currentRaisedBed,
                currentField,
                transaction,
            );

            const refundAccountId = currentRaisedBed.accountId;
            const refundAmount =
                input.refundEnabled && refundAccountId
                    ? await getRaisedBedFieldSunflowerRefundAmount({
                          accountId: refundAccountId,
                          db: transaction,
                          fallbackAmount: fallbackRefundAmount,
                          plantCycleStartedAt: activePlantCycle.startedAt,
                          positionIndex: input.positionIndex,
                          purchase: activePlantCycle.purchase,
                          raisedBedId: input.raisedBedId,
                      })
                    : 0;
            normalizeRefundAmount(refundAmount);

            const cancellationEvent = await createEvent(
                knownEvents.raisedBedFields.deletedV1(aggregateId, {
                    canceledBy: input.canceledBy,
                    expectedPlantCycleEventId: input.expectedPlantCycleEventId,
                    expectedPlantCycleVersionEventId:
                        input.expectedPlantCycleVersionEventId,
                    expectedPlantSortId: input.expectedPlantSortId,
                    notificationRequested: input.notificationRequested,
                    reason: input.reason,
                    refundAmount,
                }),
                transaction,
            );

            if (refundAmount > 0) {
                if (!refundAccountId) {
                    throw new Error(
                        'Cannot refund a planting without an account.',
                    );
                }
                await effects.earnSunflowers(
                    refundAccountId,
                    refundAmount,
                    `refund:raisedBedField:${input.raisedBedId.toString()}:${input.positionIndex.toString()}:${input.expectedPlantCycleEventId.toString()}`,
                    transaction,
                );
            }
            await deleteRaisedBedField(input.raisedBedId, input.positionIndex, {
                preserveHistory: true,
                db: transaction,
            });

            return {
                canceledBy: input.canceledBy,
                canceledAt: cancellationEvent.createdAt,
                cancellationEventId: cancellationEvent.id,
                created: true,
                field: currentField,
                notificationRequested: input.notificationRequested,
                plantCycle: activePlantCycle,
                plantSortId: currentField.plantSortId,
                raisedBed: currentRaisedBed,
                reason: input.reason,
                refundAmount,
            };
        },
        transaction,
    );
}

export async function cancelPlantingTaskWithRefund(
    input: PlantingTaskCancellationInput,
    transaction?: ScheduleTaskTransaction,
    dependencies?: Partial<GardenDiaryCancelDependencies>,
) {
    return cancelPlantingTaskAtomically(
        input,
        {
            errors: {
                changed: () =>
                    new Error(
                        'Sijanje se u međuvremenu promijenilo. Osvježi stranicu i pokušaj ponovno.',
                    ),
                fieldNotFound: () =>
                    new Error(
                        `Field with position ${input.positionIndex.toString()} not found in raised bed ${input.raisedBedId.toString()}.`,
                    ),
                raisedBedNotFound: () =>
                    new Error(
                        `Raised bed with ID ${input.raisedBedId.toString()} not found.`,
                    ),
                terminal: () =>
                    new Error('Dovršeno sijanje ne može se otkazati.'),
            },
        },
        transaction,
        dependencies,
    );
}

export async function cancelGardenDiaryOperation(
    {
        accountId,
        canceledBy,
        expectedEntityId,
        expectedTaskVersionEventId,
        gardenId,
        operationId,
        reason = defaultUserCancelReason,
        referenceDate = new Date(),
    }: {
        accountId: string;
        canceledBy: string;
        expectedEntityId: number;
        expectedTaskVersionEventId: number;
        gardenId: number;
        operationId: number;
        reason?: string;
        referenceDate?: Date;
    },
    transaction?: ScheduleTaskTransaction,
    dependencies?: Partial<GardenDiaryCancelDependencies>,
) {
    const [expectedOperation] = await getOperationsByIds([operationId]);
    const operationData =
        await getEntityFormatted<EntityStandardized>(expectedEntityId);
    const result = await cancelOperationTaskAtomically(
        {
            canceledBy,
            expectedEntityId,
            expectedTaskVersionEventId,
            notificationRequested: true,
            operationId,
            operatorNotificationRequested: false,
            reason,
            refundAmount: calculateSunflowerRefund(
                operationData?.prices?.perOperation,
            ),
        },
        {
            errors: {
                changed: () =>
                    new GardenDiaryCancelError(
                        'Operation changed while it was being canceled.',
                        409,
                    ),
                notFound: () =>
                    new GardenDiaryCancelError('Operation not found.', 404),
                terminal: () =>
                    new GardenDiaryCancelError(
                        'Completed or canceled operations cannot be canceled.',
                        409,
                    ),
            },
            expectedStatus: expectedOperation?.status,
            validateAccess: async (operation, transaction) => {
                if (
                    !(await operationBelongsToGarden({
                        accountId,
                        gardenId,
                        operation,
                        transaction,
                    }))
                ) {
                    throw new GardenDiaryCancelError(
                        'Operation not found.',
                        404,
                    );
                }
            },
            validateCurrent: async (operation) => {
                assertScheduledDateCanCancel(
                    operation.scheduledDate,
                    referenceDate,
                );
            },
        },
        transaction,
        dependencies,
    );
    const operation = result.operation;
    const operationLabel =
        operationData?.information?.label ??
        operationData?.information?.name ??
        `Radnja #${operationId.toString()}`;
    let content = `Radnja **${operationLabel}** je otkazana.`;
    let linkUrl: string | undefined;

    if (operation.raisedBedId) {
        const raisedBed = await getRaisedBed(operation.raisedBedId);
        if (raisedBed) {
            const positionIndex = operation.raisedBedFieldId
                ? raisedBed.fields.find(
                      (field) => field.id === operation.raisedBedFieldId,
                  )?.positionIndex
                : null;

            if (typeof positionIndex === 'number') {
                content = `Radnja **${operationLabel}** na gredici **${raisedBed.name}** za polje **${positionIndex + 1}** je otkazana.`;
            } else {
                content = `Radnja **${operationLabel}** na gredici **${raisedBed.name}** je otkazana.`;
            }

            linkUrl = buildRaisedBedNotificationLink(
                raisedBed.name,
                positionIndex,
            );
        }
    }

    if (result.refundAmount > 0) {
        content += `\nSredstva su ti vraćena u iznosu od ${result.refundAmount} 🌻.`;
    }

    if (result.notificationRequested) {
        await cancelDependencies(dependencies).createNotification(
            {
                accountId,
                gardenId: operation.gardenId ?? gardenId,
                raisedBedId: operation.raisedBedId,
                header: 'Radnja je otkazana',
                content,
                linkUrl,
                timestamp: result.canceledAt,
            },
            {
                idempotencyKey: `garden-diary:operation-canceled:${result.cancellationEventId.toString()}`,
            },
        );
    }

    return {
        operationId,
        refundAmount: result.refundAmount,
        reason: result.reason,
    };
}

export async function cancelGardenDiaryRaisedBedField(
    {
        accountId,
        canceledBy,
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        gardenId,
        positionIndex,
        raisedBedId,
        reason = defaultUserCancelReason,
        referenceDate = new Date(),
    }: {
        accountId: string;
        canceledBy: string;
        expectedPlantCycleEventId: number;
        expectedPlantCycleVersionEventId: number;
        expectedPlantSortId: number;
        gardenId: number;
        positionIndex: number;
        raisedBedId: number;
        reason?: string;
        referenceDate?: Date;
    },
    transaction?: ScheduleTaskTransaction,
    dependencies?: Partial<GardenDiaryCancelDependencies>,
) {
    const expectedRaisedBed = await getRaisedBed(raisedBedId);
    const expectedField = expectedRaisedBed?.fields.find(
        (candidate) =>
            candidate.positionIndex === positionIndex && candidate.active,
    );
    const plantSortData =
        await getEntityFormatted<EntityStandardized>(expectedPlantSortId);
    const result = await cancelPlantingTaskAtomically(
        {
            canceledBy,
            expectedFieldId: expectedField?.id,
            expectedPlantCycleEventId,
            expectedPlantCycleVersionEventId,
            expectedPlantSortId,
            expectedPlantStatus: expectedField?.plantStatus,
            expectedPlantStatusEventId: expectedField?.plantStatusEventId,
            fallbackRefundAmount: calculateSunflowerRefund(
                plantSortData?.prices?.perPlant ??
                    plantSortData?.information?.plant?.prices?.perPlant,
            ),
            notificationRequested: true,
            positionIndex,
            raisedBedId,
            reason,
            refundEnabled: true,
        },
        {
            errors: {
                changed: () =>
                    new GardenDiaryCancelError(
                        'Plant field changed while it was being canceled.',
                        409,
                    ),
                fieldNotFound: () =>
                    new GardenDiaryCancelError('Plant field not found.', 404),
                raisedBedNotFound: () =>
                    new GardenDiaryCancelError('Raised bed not found.', 404),
                terminal: () =>
                    new GardenDiaryCancelError(
                        'Only unfinished plant fields can be canceled.',
                        409,
                    ),
            },
            validateAccess: async (raisedBed) => {
                if (
                    raisedBed.accountId !== accountId ||
                    raisedBed.gardenId !== gardenId
                ) {
                    throw new GardenDiaryCancelError(
                        'Raised bed not found.',
                        404,
                    );
                }
            },
            validateCurrent: async (raisedBed, field) => {
                if (isRaisedBedAbandoned(raisedBed.status)) {
                    throw new GardenDiaryCancelError(
                        'Raised bed is abandoned.',
                        409,
                    );
                }
                assertScheduledDateCanCancel(
                    field.plantScheduledDate,
                    referenceDate,
                );
            },
        },
        transaction,
        dependencies,
    );
    const { plantSortId, raisedBed } = result;
    const plantName =
        plantSortData?.information?.name ?? `Biljka #${plantSortId}`;
    let content = `Sijanje biljke **${plantName}** na gredici **${raisedBed.name}** za polje **${positionIndex + 1}** je otkazano.`;

    if (result.refundAmount > 0) {
        content += `\nSredstva su ti vraćena u iznosu od ${result.refundAmount} 🌻.`;
    }

    if (result.notificationRequested) {
        await cancelDependencies(dependencies).createNotification(
            {
                accountId,
                gardenId,
                raisedBedId,
                header: 'Sijanje je otkazano',
                content,
                linkUrl: buildRaisedBedNotificationLink(
                    raisedBed.name,
                    positionIndex,
                ),
                timestamp: result.canceledAt,
            },
            {
                idempotencyKey: `garden-diary:planting-canceled:${result.cancellationEventId.toString()}`,
            },
        );
    }

    return {
        canceledBy: result.canceledBy,
        positionIndex,
        raisedBedId,
        refundAmount: result.refundAmount,
        reason: result.reason,
    };
}
