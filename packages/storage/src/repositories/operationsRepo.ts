import {
    and,
    asc,
    count,
    desc,
    eq,
    exists,
    gte,
    inArray,
    isNotNull,
    isNull,
    lte,
    or,
    sql,
} from 'drizzle-orm';
import {
    bustScheduleCache,
    cacheScheduleRead,
    scheduleCacheKeys,
    scheduleCacheTtls,
} from '../cache/scheduleCache';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    events,
    farms,
    farmUsers,
    gardens,
    type InsertOperation,
    operations,
    raisedBedFields,
    raisedBedPlantingFields,
    raisedBedPlantings,
    raisedBeds,
    type SelectOperation,
    users,
} from '../schema';
import { storage } from '../storage';
import { enqueueCheckoutOperationScheduledNotification } from './checkoutNotificationOutboxRepo';
import {
    createEvent,
    getAllEvents,
    getEvents,
    knownEvents,
    knownEventTypes,
} from './events';
import { normalizeAssignedUserIds } from './events/normalizeAssignedUserIds';
import { scheduleTaskBlockDetailsFromEvent } from './events/scheduleTaskBlock';
import type {
    CheckoutOperationCreatedPayload,
    OperationEventsAnyPayload,
} from './events/types';

export type OperationStatus =
    | 'new'
    | 'planned'
    | 'pendingVerification'
    | 'completed'
    | 'blocked'
    | 'failed'
    | 'canceled';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

const checkoutOperationLockTails = new Map<string, Promise<void>>();
// checkout.operation.created was introduced at this source cutover. When an
// environment has mappings, its earliest actual event is the stronger boundary.
const CHECKOUT_OPERATION_PROVENANCE_INTRODUCED_AT_MS = Date.parse(
    '2026-08-03T16:16:01.000Z',
);

export class CheckoutOperationConflictError extends Error {
    override name = 'CheckoutOperationConflictError';
}

export const SELECTED_PLANTING_PLANT_OPERATION_CONFLICT_MESSAGE =
    'Radnju za pojedinu biljku nije moguće planirati na polju s naprednom sjetvom. Odaberi radnju za cijelo polje ili gredicu.';

export type OperationTargetConflictErrorCode = 'selected_planting_conflict';

export class OperationTargetConflictError extends Error {
    override readonly name = 'OperationTargetConflictError';

    constructor(
        readonly code: OperationTargetConflictErrorCode,
        message = SELECTED_PLANTING_PLANT_OPERATION_CONFLICT_MESSAGE,
    ) {
        super(message);
    }
}

async function withCheckoutOperationInProcessLock<T>(
    key: string,
    callback: () => Promise<T>,
) {
    const previous = checkoutOperationLockTails.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    checkoutOperationLockTails.set(key, tail);

    await previous;
    try {
        return await callback();
    } finally {
        release();
        if (checkoutOperationLockTails.get(key) === tail) {
            checkoutOperationLockTails.delete(key);
        }
    }
}

function isPgliteTestDatabase() {
    return (
        process.env.TEST_ENV === '1' &&
        process.env.GREDICE_TEST_DB_PROVIDER === 'pglite'
    );
}

type OperationsFilter = {
    from?: Date;
    to?: Date;
    completedFrom?: Date;
    completedTo?: Date;
    status?: OperationStatus | OperationStatus[];
};

export type OperationAssignedUser = {
    id: string;
    userName: string;
    displayName: string | null;
    avatarUrl: string | null;
};

export type OperationAssignableFarmUser = OperationAssignedUser & {
    farmId: number;
};

type GetOperationsInput = {
    accountId: string;
    gardenId?: number;
    raisedBedId?: number;
    raisedBedFieldIds?: number[];
};

function operationGardenIdExpression() {
    return sql<number>`coalesce(${operations.gardenId}, ${raisedBeds.gardenId})`;
}

function operationFarmIdExpression() {
    return sql<number>`coalesce(${operations.farmId}, ${gardens.farmId})`;
}

function operationLocationIntegrityWhere() {
    return and(
        or(
            isNull(operations.raisedBedId),
            and(
                eq(raisedBeds.isDeleted, false),
                or(
                    isNull(operations.gardenId),
                    eq(operations.gardenId, raisedBeds.gardenId),
                ),
            ),
        ),
        or(
            and(isNull(operations.gardenId), isNull(operations.raisedBedId)),
            and(
                eq(gardens.isDeleted, false),
                or(
                    isNull(operations.farmId),
                    eq(operations.farmId, gardens.farmId),
                ),
            ),
        ),
        exists(
            storage()
                .select({ id: farms.id })
                .from(farms)
                .where(
                    and(
                        eq(farms.id, operationFarmIdExpression()),
                        eq(farms.isDeleted, false),
                    ),
                ),
        ),
    );
}

function parseOperationEventData(value: unknown): OperationEventsAnyPayload {
    if (!value || typeof value !== 'object') {
        return {};
    }

    const record = value as Record<string, unknown>;
    const data: OperationEventsAnyPayload = {};

    if (typeof record.completedBy === 'string') {
        data.completedBy = record.completedBy;
    }
    if (
        'assignedUserId' in record &&
        (typeof record.assignedUserId === 'string' ||
            record.assignedUserId === null)
    ) {
        data.assignedUserId = record.assignedUserId;
    }
    if (typeof record.assignedBy === 'string') {
        data.assignedBy = record.assignedBy;
    }
    if (Array.isArray(record.assignedUserIds)) {
        data.assignedUserIds = record.assignedUserIds.filter(
            (value): value is string => typeof value === 'string',
        );
    }
    if (Array.isArray(record.images)) {
        data.images = record.images.filter(
            (value): value is string => typeof value === 'string',
        );
    }
    if (typeof record.notes === 'string') {
        data.notes = record.notes;
    }
    if (typeof record.error === 'string') {
        data.error = record.error;
    }
    if (typeof record.errorCode === 'string') {
        data.errorCode = record.errorCode;
    }
    if (typeof record.canceledBy === 'string') {
        data.canceledBy = record.canceledBy;
    }
    if (typeof record.verifiedBy === 'string') {
        data.verifiedBy = record.verifiedBy;
    }
    if (typeof record.reason === 'string') {
        data.reason = record.reason;
    }
    if (typeof record.scheduledDate === 'string') {
        data.scheduledDate = record.scheduledDate;
    }

    return data;
}

async function fillOperationAggregates(
    operations: SelectOperation[],
    db: DatabaseClient = storage(),
) {
    if (operations.length === 0) {
        return [];
    }

    const aggregateIds = operations.map((op) => op.id.toString());
    const aggregateEventTypes = [
        knownEventTypes.operations.acceptance,
        knownEventTypes.operations.assign,
        knownEventTypes.operations.entityChange,
        knownEventTypes.operations.schedule,
        knownEventTypes.operations.complete,
        knownEventTypes.operations.block,
        knownEventTypes.operations.completionEvidenceUpdate,
        knownEventTypes.operations.verify,
        knownEventTypes.operations.fail,
        knownEventTypes.operations.cancel,
    ];
    const aggregatesEvents: Awaited<ReturnType<typeof getEvents>> = [];
    const eventPageSize = 10000;
    for (let offset = 0; ; offset += eventPageSize) {
        const eventPage = await getEvents(
            aggregateEventTypes,
            aggregateIds,
            offset,
            eventPageSize,
            db,
        );
        aggregatesEvents.push(...eventPage);
        if (eventPage.length < eventPageSize) {
            break;
        }
    }

    const eventsByAggregateId = new Map<string, typeof aggregatesEvents>();
    for (const event of aggregatesEvents) {
        const operationEvents =
            eventsByAggregateId.get(event.aggregateId) ?? [];
        operationEvents.push(event);
        eventsByAggregateId.set(event.aggregateId, operationEvents);
    }

    const operationsWithAggregates = operations.map((op) => {
        const operationEvents = eventsByAggregateId.get(op.id.toString()) ?? [];

        let status: OperationStatus = 'new';
        let assignedUserId: string | null | undefined;
        let assignedUserIds: string[] | undefined;
        let assignedBy: string | undefined;
        let assignedAt: Date | undefined;
        let scheduledDate: Date | undefined;
        let scheduledAt: Date | undefined;
        let completedAt: Date | undefined;
        let completedBy: string | undefined;
        let completionEventId: number | undefined;
        let verifiedAt: Date | undefined;
        let verifiedBy: string | undefined;
        let verificationEventId: number | undefined;
        let error: string | undefined;
        let errorCode: string | undefined;
        let canceledBy: string | undefined;
        let canceledAt: Date | undefined;
        let cancelReason: string | undefined;
        let imageUrls: string[] | undefined;
        let completionNotes: string | undefined;
        let blockedAt: Date | undefined;
        let blockedBy: string | undefined;
        let blockedEventId: number | undefined;
        let blockReasonCode: string | undefined;
        let blockReasonLabel: string | undefined;
        let blockNote: string | undefined;
        let blockImageUrls: string[] | undefined;
        let taskVersionEventId = 0;

        // helpers to safely extract typed values from unknown event.data
        const asString = (v: unknown): string | undefined =>
            typeof v === 'string' ? v : undefined;

        for (const event of operationEvents) {
            taskVersionEventId = event.id;
            const data = parseOperationEventData(event.data);
            if (event.type === knownEventTypes.operations.assign) {
                if ('assignedUserId' in data) {
                    assignedUserId = data.assignedUserId ?? null;
                    assignedAt = event.createdAt;
                }
                if (Array.isArray(data.assignedUserIds)) {
                    assignedUserIds = normalizeAssignedUserIds(
                        data.assignedUserIds,
                        data.assignedUserId,
                    );
                    assignedAt = event.createdAt;
                }
                assignedBy = asString(data?.assignedBy) ?? assignedBy;
            } else if (event.type === knownEventTypes.operations.complete) {
                status = 'pendingVerification';
                completedBy = asString(data?.completedBy) ?? completedBy;
                completedAt = completedAt ?? event.createdAt;
                completionEventId = completionEventId ?? event.id;
                if (Array.isArray(data?.images)) {
                    imageUrls = data.images.filter(
                        (url): url is string => typeof url === 'string',
                    );
                }
                completionNotes = asString(data?.notes) ?? completionNotes;
            } else if (event.type === knownEventTypes.operations.block) {
                const details = scheduleTaskBlockDetailsFromEvent(event);
                status = 'blocked';
                blockedAt = details?.blockedAt ?? event.createdAt;
                blockedBy = details?.blockedBy;
                blockedEventId = event.id;
                blockReasonCode = details?.reasonCode;
                blockReasonLabel = details?.reasonLabel;
                blockNote = details?.note;
                blockImageUrls = details?.images;
            } else if (
                event.type ===
                knownEventTypes.operations.completionEvidenceUpdate
            ) {
                if (Array.isArray(data?.images)) {
                    imageUrls = data.images.filter(
                        (url): url is string => typeof url === 'string',
                    );
                }
                completionNotes = asString(data?.notes) ?? '';
            } else if (event.type === knownEventTypes.operations.verify) {
                status = 'completed';
                verifiedBy = asString(data?.verifiedBy) ?? verifiedBy;
                verifiedAt = event.createdAt;
                verificationEventId = event.id;
            } else if (event.type === knownEventTypes.operations.fail) {
                status = 'failed';
                error = asString(data?.error);
                errorCode = asString(data?.errorCode);
            } else if (event.type === knownEventTypes.operations.cancel) {
                status = 'canceled';
                canceledBy = asString(data?.canceledBy);
                cancelReason = asString(data?.reason);
                canceledAt = event.createdAt;
            } else if (event.type === knownEventTypes.operations.schedule) {
                status = 'planned';
                scheduledDate = data?.scheduledDate
                    ? new Date(String(data.scheduledDate))
                    : undefined;
                scheduledAt = event.createdAt;
                completedAt = undefined;
                completedBy = undefined;
                completionEventId = undefined;
                verifiedAt = undefined;
                verifiedBy = undefined;
                verificationEventId = undefined;
                error = undefined;
                errorCode = undefined;
                canceledBy = undefined;
                canceledAt = undefined;
                cancelReason = undefined;
                imageUrls = undefined;
                completionNotes = undefined;
                blockedAt = undefined;
                blockedBy = undefined;
                blockedEventId = undefined;
                blockReasonCode = undefined;
                blockReasonLabel = undefined;
                blockNote = undefined;
                blockImageUrls = undefined;
            }
        }

        return {
            ...op,
            status,
            assignedUserIds: normalizeAssignedUserIds(
                assignedUserIds,
                assignedUserId,
            ),
            assignedUserId: assignedUserId ?? null,
            assignedBy,
            assignedAt,
            completedAt,
            completedBy,
            completionEventId,
            verifiedAt,
            verifiedBy,
            verificationEventId,
            error,
            errorCode,
            scheduledDate,
            scheduledAt,
            canceledBy,
            canceledAt,
            cancelReason,
            imageUrls,
            completionNotes,
            blockedAt,
            blockedBy,
            blockedEventId,
            blockReasonCode,
            blockReasonLabel,
            blockNote,
            blockImageUrls,
            taskVersionEventId,
        };
    });

    const assignedUserIds = Array.from(
        new Set(
            operationsWithAggregates.flatMap(
                (operation) => operation.assignedUserIds ?? [],
            ),
        ),
    );

    const assignedUsers =
        assignedUserIds.length > 0
            ? await db.query.users.findMany({
                  columns: {
                      id: true,
                      userName: true,
                      displayName: true,
                      avatarUrl: true,
                  },
                  where: inArray(users.id, assignedUserIds),
              })
            : [];
    const assignedUsersById = new Map<string, OperationAssignedUser>(
        assignedUsers.map((user) => [user.id, user]),
    );

    return operationsWithAggregates.map((operation) => ({
        ...operation,
        assignedUsers: (operation.assignedUserIds ?? [])
            .map((assignedUserId) => assignedUsersById.get(assignedUserId))
            .filter((assignedUser): assignedUser is OperationAssignedUser =>
                Boolean(assignedUser),
            ),
        assignedUser:
            operation.assignedUserIds &&
            operation.assignedUserIds.length > 0 &&
            assignedUsersById.has(operation.assignedUserIds[0])
                ? (assignedUsersById.get(operation.assignedUserIds[0]) ?? null)
                : null,
    }));
}

function getOperationsWhere(input: GetOperationsInput) {
    return and(
        eq(operations.accountId, input.accountId),
        eq(operations.isDeleted, false),
        input.gardenId ? eq(operations.gardenId, input.gardenId) : undefined,
        input.raisedBedId
            ? eq(operations.raisedBedId, input.raisedBedId)
            : undefined,
        input.raisedBedFieldIds && input.raisedBedFieldIds.length > 0
            ? inArray(operations.raisedBedFieldId, input.raisedBedFieldIds)
            : undefined,
    );
}

async function getOperationRows(input: GetOperationsInput) {
    return storage().query.operations.findMany({
        where: getOperationsWhere(input),
        orderBy: desc(operations.timestamp),
    });
}

const operationTimelineStatusTypes = [
    knownEventTypes.operations.schedule,
    knownEventTypes.operations.complete,
    knownEventTypes.operations.block,
    knownEventTypes.operations.verify,
    knownEventTypes.operations.fail,
    knownEventTypes.operations.cancel,
];

const operationHistoryStatusTypes = [
    knownEventTypes.operations.assign,
    ...operationTimelineStatusTypes,
];

function getLatestOperationStatusTypeExpression() {
    return sql<string | null>`(
        select ${events.type}
        from ${events}
        where ${events.aggregateId} = CAST(${operations.id} as text)
          and ${events.type} in (${sql.join(
              operationTimelineStatusTypes.map((value) => sql`${value}`),
              sql`, `,
          )})
        order by ${events.createdAt} desc, ${events.id} desc
        limit 1
    )`;
}

function getOperationScheduledDateExpression() {
    return sql<Date | null>`(
        select nullif((${events.data} ->> 'scheduledDate'), '')::timestamp
        from ${events}
        where ${events.aggregateId} = CAST(${operations.id} as text)
          and ${events.type} = ${knownEventTypes.operations.schedule}
        order by ${events.createdAt} desc, ${events.id} desc
        limit 1
    )`;
}

function getOperationCompletedDateExpression() {
    return sql<Date | null>`(
        select ${events.createdAt}
        from ${events}
        where ${events.aggregateId} = CAST(${operations.id} as text)
          and ${events.type} = ${knownEventTypes.operations.complete}
          and (
              not exists (
                  select 1
                  from ${events}
                  where ${events.aggregateId} = CAST(${operations.id} as text)
                    and ${events.type} = ${knownEventTypes.operations.schedule}
              )
              or (${events.createdAt}, ${events.id}) > (
                  select ${events.createdAt}, ${events.id}
                  from ${events}
                  where ${events.aggregateId} = CAST(${operations.id} as text)
                    and ${events.type} = ${knownEventTypes.operations.schedule}
                  order by ${events.createdAt} desc, ${events.id} desc
                  limit 1
                )
          )
        order by ${events.createdAt} asc, ${events.id} asc
        limit 1
    )`;
}

function getOperationStatusExpression() {
    const latestStatusTypeExpression = getLatestOperationStatusTypeExpression();

    return sql<OperationStatus>`(
        case ${latestStatusTypeExpression}
            when ${knownEventTypes.operations.schedule} then 'planned'
            when ${knownEventTypes.operations.complete} then 'pendingVerification'
            when ${knownEventTypes.operations.block} then 'blocked'
            when ${knownEventTypes.operations.verify} then 'completed'
            when ${knownEventTypes.operations.fail} then 'failed'
            when ${knownEventTypes.operations.cancel} then 'canceled'
            else 'new'
        end
    )`;
}

function getOperationStatusWhere(
    status: OperationStatus | OperationStatus[] | undefined,
) {
    if (!status) {
        return undefined;
    }

    const statusValues = Array.isArray(status) ? status : [status];
    if (statusValues.length === 0) {
        return undefined;
    }

    return sql`${getOperationStatusExpression()} in (${sql.join(
        statusValues.map((value) => sql`${value}`),
        sql`, `,
    )})`;
}

const appliedRaisedBedOperationStatuses: OperationStatus[] = [
    // Keep in sync with isAppliedRaisedBedOperationStatus in the garden route.
    'completed',
    'pendingVerification',
];
const terminalOperationStatuses: OperationStatus[] = [
    'completed',
    'blocked',
    'failed',
    'canceled',
];

export const selectedPlantingBlockingOperationStatuses = [
    'new',
    'planned',
    'pendingVerification',
] as const satisfies readonly OperationStatus[];

type SelectedPlantingBlockingOperationStatus =
    (typeof selectedPlantingBlockingOperationStatuses)[number];

function isSelectedPlantingBlockingOperationStatus(
    status: OperationStatus,
): status is SelectedPlantingBlockingOperationStatus {
    return selectedPlantingBlockingOperationStatuses.some(
        (candidate) => candidate === status,
    );
}

type OperationTarget = Pick<
    InsertOperation,
    'entityId' | 'entityTypeName' | 'raisedBedFieldId'
>;

export type BlockingPlantOperation = {
    operationId: number;
    raisedBedFieldId: number;
    positionIndex: number;
    status: SelectedPlantingBlockingOperationStatus;
};

function operationDefinitionMutationLockKey(entityId: number) {
    return `operation-definition-application:${entityId.toString()}`;
}

async function getOperationEntityLineage(db: DatabaseClient, entityId: number) {
    const lineage: number[] = [];
    const visited = new Set<number>();
    let currentEntityId: number | null = entityId;
    while (currentEntityId !== null) {
        if (visited.has(currentEntityId)) {
            throw new Error('Cycle detected in operation entity hierarchy');
        }
        visited.add(currentEntityId);
        const [entity] = await db
            .select({ id: entities.id, parentId: entities.parentId })
            .from(entities)
            .where(
                and(
                    eq(entities.id, currentEntityId),
                    eq(entities.entityTypeName, 'operation'),
                    eq(entities.isDeleted, false),
                ),
            )
            .limit(1);
        if (!entity) {
            break;
        }
        lineage.push(entity.id);
        currentEntityId = entity.parentId;
    }
    return lineage;
}

async function lockOperationDefinitionApplications(
    db: DatabaseClient,
    entityIds: readonly number[],
) {
    if (!isPgliteTestDatabase()) {
        for (const entityId of Array.from(new Set(entityIds)).sort(
            (left, right) => left - right,
        )) {
            await db.execute(
                sql`select pg_advisory_xact_lock(hashtext(${operationDefinitionMutationLockKey(entityId)}));`,
            );
        }
    }
}

type ProspectiveOperationApplicationMutation =
    | { entityId: number; value: string | null }
    | { deletedAttributeValueId: number; entityId: number };

async function getEffectiveOperationApplication(
    db: DatabaseClient,
    entityId: number,
    entityTypeName: string,
    prospectiveMutation?: ProspectiveOperationApplicationMutation,
) {
    if (entityTypeName !== 'operation') {
        return null;
    }

    const [applicationDefinition] = await db
        .select({
            id: attributeDefinitions.id,
            defaultValue: attributeDefinitions.defaultValue,
        })
        .from(attributeDefinitions)
        .where(
            and(
                eq(attributeDefinitions.entityTypeName, 'operation'),
                eq(attributeDefinitions.category, 'attributes'),
                eq(attributeDefinitions.name, 'application'),
                eq(attributeDefinitions.isDeleted, false),
            ),
        )
        .orderBy(asc(attributeDefinitions.id))
        .limit(1);
    if (!applicationDefinition) {
        return null;
    }

    const visitedEntityIds = new Set<number>();
    let currentEntityId: number | null = entityId;
    while (currentEntityId !== null) {
        if (visitedEntityIds.has(currentEntityId)) {
            return null;
        }
        visitedEntityIds.add(currentEntityId);

        const [entity] = await db
            .select({
                id: entities.id,
                entityTypeName: entities.entityTypeName,
                parentId: entities.parentId,
            })
            .from(entities)
            .where(
                and(
                    eq(entities.id, currentEntityId),
                    eq(entities.isDeleted, false),
                ),
            )
            .limit(1);
        if (entity?.entityTypeName !== 'operation') {
            return null;
        }

        if (
            prospectiveMutation &&
            currentEntityId === prospectiveMutation.entityId &&
            'value' in prospectiveMutation
        ) {
            return prospectiveMutation.value;
        }

        const applicationValues = await db
            .select({ id: attributeValues.id, value: attributeValues.value })
            .from(attributeValues)
            .where(
                and(
                    eq(attributeValues.entityId, entity.id),
                    eq(
                        attributeValues.attributeDefinitionId,
                        applicationDefinition.id,
                    ),
                    eq(attributeValues.entityTypeName, 'operation'),
                    eq(attributeValues.isDeleted, false),
                ),
            )
            .orderBy(asc(attributeValues.id));
        const applicationValue = applicationValues.find(
            (value) =>
                !prospectiveMutation ||
                !('deletedAttributeValueId' in prospectiveMutation) ||
                currentEntityId !== prospectiveMutation.entityId ||
                value.id !== prospectiveMutation.deletedAttributeValueId,
        );
        if (applicationValue) {
            return applicationValue.value;
        }

        currentEntityId = entity.parentId;
    }

    return applicationDefinition.defaultValue;
}

async function getBlockingPlantOperationsForFieldIds(
    fieldIds: readonly number[],
    db: DatabaseClient,
): Promise<BlockingPlantOperation[]> {
    const uniqueFieldIds = Array.from(new Set(fieldIds)).sort(
        (left, right) => left - right,
    );
    if (uniqueFieldIds.length === 0) {
        return [];
    }

    const candidateRows = await db
        .select({
            operationId: operations.id,
            entityId: operations.entityId,
            entityTypeName: operations.entityTypeName,
            raisedBedFieldId: raisedBedFields.id,
            positionIndex: raisedBedFields.positionIndex,
            status: getOperationStatusExpression(),
        })
        .from(operations)
        .innerJoin(
            raisedBedFields,
            eq(operations.raisedBedFieldId, raisedBedFields.id),
        )
        .where(
            and(
                inArray(raisedBedFields.id, uniqueFieldIds),
                eq(raisedBedFields.isDeleted, false),
                eq(operations.isDeleted, false),
                getOperationStatusWhere([
                    ...selectedPlantingBlockingOperationStatuses,
                ]),
            ),
        )
        .orderBy(asc(raisedBedFields.id), asc(operations.id));

    const applicationByEntityId = new Map<number, string | null>();
    const conflicts: BlockingPlantOperation[] = [];
    for (const candidate of candidateRows) {
        if (candidate.entityTypeName !== 'operation') {
            continue;
        }
        let application = applicationByEntityId.get(candidate.entityId);
        if (application === undefined) {
            application = await getEffectiveOperationApplication(
                db,
                candidate.entityId,
                candidate.entityTypeName,
            );
            applicationByEntityId.set(candidate.entityId, application);
        }
        if (application !== 'plant') {
            continue;
        }
        if (!isSelectedPlantingBlockingOperationStatus(candidate.status)) {
            continue;
        }

        conflicts.push({
            operationId: candidate.operationId,
            raisedBedFieldId: candidate.raisedBedFieldId,
            positionIndex: candidate.positionIndex,
            status: candidate.status,
        });
    }
    return conflicts;
}

export async function getBlockingPlantOperationsForRaisedBedFootprint(
    input: {
        raisedBedId: number;
        positionIndices: readonly number[];
    },
    db: DatabaseClient = storage(),
): Promise<BlockingPlantOperation[]> {
    if (
        !Number.isSafeInteger(input.raisedBedId) ||
        input.raisedBedId <= 0 ||
        input.positionIndices.some(
            (positionIndex) =>
                !Number.isSafeInteger(positionIndex) || positionIndex < 0,
        )
    ) {
        throw new RangeError('Raised-bed operation footprint is invalid.');
    }

    const positionIndices = Array.from(new Set(input.positionIndices)).sort(
        (left, right) => left - right,
    );
    if (positionIndices.length === 0) {
        return [];
    }
    const fields = await db
        .select({ id: raisedBedFields.id })
        .from(raisedBedFields)
        .where(
            and(
                eq(raisedBedFields.raisedBedId, input.raisedBedId),
                inArray(raisedBedFields.positionIndex, positionIndices),
                eq(raisedBedFields.isDeleted, false),
            ),
        )
        .orderBy(asc(raisedBedFields.id));

    return getBlockingPlantOperationsForFieldIds(
        fields.map((field) => field.id),
        db,
    );
}

async function hasActiveSelectedPlantingMembership(
    db: DatabaseClient,
    raisedBedFieldIds: readonly number[],
) {
    if (raisedBedFieldIds.length === 0) {
        return false;
    }

    const [membership] = await db
        .select({ id: raisedBedPlantingFields.id })
        .from(raisedBedPlantingFields)
        .innerJoin(
            raisedBedPlantings,
            eq(raisedBedPlantingFields.plantingId, raisedBedPlantings.id),
        )
        .where(
            and(
                inArray(
                    raisedBedPlantingFields.raisedBedFieldId,
                    Array.from(new Set(raisedBedFieldIds)),
                ),
                eq(raisedBedPlantingFields.isDeleted, false),
                eq(raisedBedPlantings.configurationSource, 'selected'),
                eq(raisedBedPlantings.isActive, true),
                eq(raisedBedPlantings.isDeleted, false),
            ),
        )
        .limit(1);
    return Boolean(membership);
}

async function lockRaisedBedFieldsForOperationGuard(
    db: DatabaseClient,
    raisedBedFieldIds: readonly number[],
) {
    const uniqueFieldIds = Array.from(new Set(raisedBedFieldIds)).sort(
        (left, right) => left - right,
    );
    if (uniqueFieldIds.length === 0) {
        return [];
    }

    return db
        .select({ id: raisedBedFields.id })
        .from(raisedBedFields)
        .where(inArray(raisedBedFields.id, uniqueFieldIds))
        .orderBy(asc(raisedBedFields.id))
        .for('update');
}

async function assertOperationTargetAllowsDefinition(
    operation: OperationTarget,
    db: DatabaseClient,
) {
    if (
        operation.entityTypeName !== 'operation' ||
        !operation.raisedBedFieldId
    ) {
        return;
    }

    await lockOperationDefinitionApplications(
        db,
        await getOperationEntityLineage(db, operation.entityId),
    );
    const application = await getEffectiveOperationApplication(
        db,
        operation.entityId,
        operation.entityTypeName,
    );
    if (application !== 'plant') {
        return;
    }

    const lockedFields = await lockRaisedBedFieldsForOperationGuard(db, [
        operation.raisedBedFieldId,
    ]);
    if (
        await hasActiveSelectedPlantingMembership(
            db,
            lockedFields.map((field) => field.id),
        )
    ) {
        throw new OperationTargetConflictError('selected_planting_conflict');
    }
}

/**
 * Guards a directory application change that would turn existing field tasks
 * into plant-scoped operations. Call this inside the attribute mutation
 * transaction before persisting `application = plant`.
 */
export async function assertOperationDefinitionCanBecomePlantScoped(
    entityId: number,
    db: DatabaseClient,
    prospectiveMutation: ProspectiveOperationApplicationMutation = {
        entityId,
        value: 'plant',
    },
) {
    await lockOperationDefinitionApplications(
        db,
        await getOperationEntityLineage(db, entityId),
    );
    const operationRows = await db
        .select({
            entityId: operations.entityId,
            entityTypeName: operations.entityTypeName,
            raisedBedFieldId: operations.raisedBedFieldId,
        })
        .from(operations)
        .where(
            and(
                eq(operations.entityTypeName, 'operation'),
                eq(operations.isDeleted, false),
                isNotNull(operations.raisedBedFieldId),
                getOperationStatusWhere([
                    ...selectedPlantingBlockingOperationStatuses,
                ]),
            ),
        )
        .orderBy(asc(operations.raisedBedFieldId));
    const currentApplicationByEntityId = new Map<number, string | null>();
    const prospectiveApplicationByEntityId = new Map<number, string | null>();
    const plantScopedOperationRows: typeof operationRows = [];
    for (const operation of operationRows) {
        let currentApplication = currentApplicationByEntityId.get(
            operation.entityId,
        );
        if (currentApplication === undefined) {
            currentApplication = await getEffectiveOperationApplication(
                db,
                operation.entityId,
                operation.entityTypeName,
            );
            currentApplicationByEntityId.set(
                operation.entityId,
                currentApplication,
            );
        }
        let prospectiveApplication = prospectiveApplicationByEntityId.get(
            operation.entityId,
        );
        if (prospectiveApplication === undefined) {
            prospectiveApplication = await getEffectiveOperationApplication(
                db,
                operation.entityId,
                operation.entityTypeName,
                prospectiveMutation,
            );
            prospectiveApplicationByEntityId.set(
                operation.entityId,
                prospectiveApplication,
            );
        }
        if (
            currentApplication !== 'plant' &&
            prospectiveApplication === 'plant'
        ) {
            plantScopedOperationRows.push(operation);
        }
    }
    const lockedFields = await lockRaisedBedFieldsForOperationGuard(
        db,
        plantScopedOperationRows.flatMap((operation) =>
            operation.raisedBedFieldId === null
                ? []
                : [operation.raisedBedFieldId],
        ),
    );
    if (
        await hasActiveSelectedPlantingMembership(
            db,
            lockedFields.map((field) => field.id),
        )
    ) {
        throw new OperationTargetConflictError('selected_planting_conflict');
    }
}

function getOperationLatestStatusChangeDateExpression() {
    return sql<Date | null>`(
        select ${events.createdAt}
        from ${events}
        where ${events.aggregateId} = CAST(${operations.id} as text)
          and ${events.type} in (${sql.join(
              operationHistoryStatusTypes.map((value) => sql`${value}`),
              sql`, `,
          )})
        order by ${events.createdAt} desc, ${events.id} desc
        limit 1
    )`;
}

function getOperationTaskSortExpression() {
    const statusExpression = getOperationStatusExpression();
    const completedDateExpression = getOperationCompletedDateExpression();
    const scheduledDateExpression = getOperationScheduledDateExpression();
    const latestStatusChangeDateExpression =
        getOperationLatestStatusChangeDateExpression();

    return sql<Date>`case
        when ${statusExpression} = 'blocked'
            then coalesce(${latestStatusChangeDateExpression}, ${scheduledDateExpression}, ${operations.createdAt})
        when ${statusExpression} in (${sql.join(
            appliedRaisedBedOperationStatuses.map((value) => sql`${value}`),
            sql`, `,
        )})
            then coalesce(${completedDateExpression}, ${scheduledDateExpression}, ${latestStatusChangeDateExpression}, ${operations.createdAt})
        else coalesce(${scheduledDateExpression}, ${latestStatusChangeDateExpression}, ${operations.createdAt})
    end`;
}

export async function getOperations(
    accountId: string,
    gardenId?: number,
    raisedBedId?: number,
    raisedBedFieldIds?: number[],
) {
    const query = await getOperationRows({
        accountId,
        gardenId,
        raisedBedId,
        raisedBedFieldIds,
    });

    return await fillOperationAggregates(query);
}

export async function getOperationsPage(
    input: GetOperationsInput & {
        cursor?: number;
        limit?: number;
        includeCompleted?: boolean;
    },
) {
    const offset = input.cursor ?? 0;
    const pageSize = input.limit ?? 20;
    const statusExpression = getOperationStatusExpression();
    const taskSortExpression = getOperationTaskSortExpression();
    const includeCompletedWhere = input.includeCompleted
        ? undefined
        : sql`${statusExpression} not in (${sql.join(
              terminalOperationStatuses.map((value) => sql`${value}`),
              sql`, `,
          )})`;
    const sortOrder = [desc(taskSortExpression), desc(operations.id)];

    const [pageRows, totalResult] = await Promise.all([
        storage()
            .select({
                id: operations.id,
            })
            .from(operations)
            .where(and(getOperationsWhere(input), includeCompletedWhere))
            .orderBy(...sortOrder)
            .offset(offset)
            .limit(pageSize + 1),
        storage()
            .select({ count: count() })
            .from(operations)
            .where(and(getOperationsWhere(input), includeCompletedWhere)),
    ]);

    const pageIds = pageRows.slice(0, pageSize).map((row) => row.id);
    const hydratedItems = await getOperationsByIds(pageIds);
    const hydratedItemsById = new Map(
        hydratedItems.map((item) => [item.id, item]),
    );
    const items = pageIds.flatMap((id) => {
        const item = hydratedItemsById.get(id);
        return item ? [item] : [];
    });

    return {
        items,
        nextCursor: pageRows.length > pageSize ? offset + pageSize : null,
        total: totalResult[0]?.count ?? 0,
    };
}

export type RaisedBedPhotoPreview = {
    raisedBedId: number;
    imageUrls: string[];
    photoCount: number;
};

function getCompletionEventImageUrls(data: unknown) {
    if (!data || typeof data !== 'object') {
        return [];
    }

    const images = Reflect.get(data, 'images');
    if (!Array.isArray(images)) {
        return [];
    }

    return images.filter(
        (url): url is string =>
            typeof url === 'string' && url.trim().length > 0,
    );
}

export async function getRaisedBedPhotoPreviews(
    raisedBedIds: number[],
    imageLimit = 3,
): Promise<RaisedBedPhotoPreview[]> {
    const uniqueRaisedBedIds = Array.from(new Set(raisedBedIds)).sort(
        (left, right) => left - right,
    );

    if (uniqueRaisedBedIds.length === 0) {
        return [];
    }

    const rows = await storage()
        .select({
            raisedBedId: operations.raisedBedId,
            data: events.data,
        })
        .from(operations)
        .innerJoin(events, eq(events.aggregateId, sql`${operations.id}::text`))
        .where(
            and(
                eq(operations.isDeleted, false),
                inArray(operations.raisedBedId, uniqueRaisedBedIds),
                eq(events.type, knownEventTypes.operations.complete),
                sql`jsonb_typeof(${events.data}->'images') = 'array'`,
                sql`jsonb_array_length(${events.data}->'images') > 0`,
            ),
        )
        .orderBy(
            asc(operations.raisedBedId),
            desc(events.createdAt),
            desc(events.id),
        );

    const previewByRaisedBedId = new Map<number, RaisedBedPhotoPreview>(
        uniqueRaisedBedIds.map((raisedBedId) => [
            raisedBedId,
            {
                raisedBedId,
                imageUrls: [],
                photoCount: 0,
            },
        ]),
    );
    const seenImageUrlsByRaisedBedId = new Map<number, Set<string>>();
    const safeImageLimit = Math.max(1, imageLimit);

    for (const row of rows) {
        if (row.raisedBedId === null) {
            continue;
        }

        const preview = previewByRaisedBedId.get(row.raisedBedId);
        if (!preview) {
            continue;
        }

        const imageUrls = getCompletionEventImageUrls(row.data);
        preview.photoCount += imageUrls.length;

        let seenImageUrls = seenImageUrlsByRaisedBedId.get(row.raisedBedId);
        if (!seenImageUrls) {
            seenImageUrls = new Set();
            seenImageUrlsByRaisedBedId.set(row.raisedBedId, seenImageUrls);
        }

        for (const imageUrl of imageUrls) {
            if (seenImageUrls.has(imageUrl)) {
                continue;
            }

            seenImageUrls.add(imageUrl);
            if (preview.imageUrls.length < safeImageLimit) {
                preview.imageUrls.push(imageUrl);
            }
        }
    }

    return [...previewByRaisedBedId.values()];
}

export async function getAppliedRaisedBedOperationsForGarden(
    accountId: string,
    gardenId: number,
) {
    // Select matching operation rows directly. Re-hydrating an intermediate
    // ID list creates an unbounded IN query for long-lived gardens.
    const rows = await storage()
        .select()
        .from(operations)
        .where(
            and(
                getOperationsWhere({ accountId, gardenId }),
                getOperationStatusWhere(appliedRaisedBedOperationStatuses),
                isNotNull(operations.raisedBedId),
            ),
        )
        .orderBy(desc(operations.timestamp));

    return fillOperationAggregates(rows);
}

export async function getAllOperations(filter?: {
    from?: Date;
    to?: Date;
    completedFrom?: Date;
    completedTo?: Date;
    status?: OperationStatus | OperationStatus[];
}) {
    return cacheScheduleRead(
        scheduleCacheKeys.adminOperations(filter),
        () => getAllOperationsUncached(filter),
        scheduleCacheTtls.operations,
    );
}

async function getAllOperationsUncached(filter?: {
    from?: Date;
    to?: Date;
    completedFrom?: Date;
    completedTo?: Date;
    status?: OperationStatus | OperationStatus[];
}) {
    let operationsWithAggregates: Awaited<
        ReturnType<typeof fillOperationAggregates>
    >;

    // If completion date filtering is requested, use event-based filtering
    if (filter?.completedFrom || filter?.completedTo) {
        operationsWithAggregates = await getCompletedOperationsByCompletionDate(
            {
                from: filter.completedFrom || new Date('1970-01-01'),
                to: filter.completedTo || new Date('2099-12-31'),
            },
        );
    } else {
        // Otherwise, use the original timestamp-based filtering
        const operationsList = await storage()
            .select()
            .from(operations)
            .where(
                and(
                    eq(operations.isDeleted, false),
                    getOperationStatusWhere(filter?.status),
                    filter?.from
                        ? gte(operations.timestamp, filter.from)
                        : undefined,
                    filter?.to
                        ? lte(operations.timestamp, filter.to)
                        : undefined,
                ),
            )
            .orderBy(desc(operations.timestamp));
        operationsWithAggregates =
            await fillOperationAggregates(operationsList);
    }

    // Apply status filtering if specified
    if (filter?.status) {
        const statusArray = Array.isArray(filter.status)
            ? filter.status
            : [filter.status];
        operationsWithAggregates = operationsWithAggregates.filter(
            (op) => op && statusArray.includes(op.status as OperationStatus),
        );
    }

    return operationsWithAggregates;
}

async function getFarmUserAcceptedOperationsByIds(
    userId: string,
    ids: number[],
    db: DatabaseClient = storage(),
) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
        return [];
    }

    const rows = await db
        .select({ operation: operations })
        .from(operations)
        .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .leftJoin(gardens, eq(gardens.id, operationGardenIdExpression()))
        .innerJoin(farmUsers, eq(farmUsers.farmId, operationFarmIdExpression()))
        .where(
            and(
                inArray(operations.id, uniqueIds),
                eq(farmUsers.userId, userId),
                eq(operations.isAccepted, true),
                eq(operations.isDeleted, false),
                operationLocationIntegrityWhere(),
            ),
        )
        .orderBy(desc(operations.timestamp));

    return rows.map((row) => row.operation);
}

async function getCompletedFarmUserAcceptedOperationsByCompletionDate(
    userId: string,
    filter: {
        from: Date;
        to: Date;
    },
) {
    const completionEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.operations.complete),
            gte(events.createdAt, filter.from),
            lte(events.createdAt, filter.to),
        ),
        orderBy: [asc(events.createdAt)],
    });

    if (completionEvents.length === 0) {
        return [];
    }

    const operationIds = completionEvents
        .map((event) => Number.parseInt(event.aggregateId, 10))
        .filter((id) => Number.isFinite(id));

    return getFarmUserAcceptedOperationsByIds(userId, operationIds);
}

export async function getFarmUserAcceptedOperations(
    userId: string,
    filter?: OperationsFilter,
) {
    return cacheScheduleRead(
        scheduleCacheKeys.farmUserOperations(userId, filter),
        () => getFarmUserAcceptedOperationsUncached(userId, filter),
        scheduleCacheTtls.operations,
    );
}

export async function getFarmUserPendingVerificationOperations(userId: string) {
    const filter = { status: 'pendingVerification' } satisfies OperationsFilter;

    return cacheScheduleRead(
        scheduleCacheKeys.farmUserOperations(userId, filter),
        async () => {
            const rows = await storage()
                .select({ operation: operations })
                .from(operations)
                .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
                .leftJoin(
                    gardens,
                    eq(gardens.id, operationGardenIdExpression()),
                )
                .innerJoin(
                    farmUsers,
                    eq(farmUsers.farmId, operationFarmIdExpression()),
                )
                .where(
                    and(
                        eq(farmUsers.userId, userId),
                        eq(operations.isAccepted, true),
                        eq(operations.isDeleted, false),
                        operationLocationIntegrityWhere(),
                        getOperationStatusWhere(filter.status),
                    ),
                )
                .orderBy(desc(operations.timestamp));

            return fillOperationAggregates(rows.map((row) => row.operation));
        },
        scheduleCacheTtls.operations,
    );
}

export async function getFarmUserBlockedOperations(
    userId: string,
    filter: {
        from?: Date;
        to?: Date;
    } = {},
) {
    const blockEvents = await storage().query.events.findMany({
        columns: { aggregateId: true },
        where: and(
            eq(events.type, knownEventTypes.operations.block),
            filter.from ? gte(events.createdAt, filter.from) : undefined,
            filter.to ? lte(events.createdAt, filter.to) : undefined,
        ),
        orderBy: [desc(events.createdAt), desc(events.id)],
    });
    const operationIds = Array.from(
        new Set(
            blockEvents
                .map((event) => Number(event.aggregateId))
                .filter((id) => Number.isSafeInteger(id) && id > 0),
        ),
    );
    if (operationIds.length === 0) {
        return [];
    }

    const operationsList = await getFarmUserAcceptedOperationsByIds(
        userId,
        operationIds,
    );
    const hydrated = await fillOperationAggregates(operationsList);

    return hydrated
        .filter(
            (operation) =>
                operation.status === 'blocked' &&
                operation.blockedAt &&
                (!filter.from || operation.blockedAt >= filter.from) &&
                (!filter.to || operation.blockedAt <= filter.to),
        )
        .sort(
            (left, right) =>
                (right.blockedAt?.getTime() ?? 0) -
                (left.blockedAt?.getTime() ?? 0),
        );
}

export async function getBlockedOperations(
    filter: { from?: Date; to?: Date } = {},
) {
    const blockEvents = await storage().query.events.findMany({
        columns: { aggregateId: true },
        where: and(
            eq(events.type, knownEventTypes.operations.block),
            filter.from ? gte(events.createdAt, filter.from) : undefined,
            filter.to ? lte(events.createdAt, filter.to) : undefined,
        ),
        orderBy: [desc(events.createdAt), desc(events.id)],
    });
    const operationIds = Array.from(
        new Set(
            blockEvents
                .map((event) => Number(event.aggregateId))
                .filter((id) => Number.isSafeInteger(id) && id > 0),
        ),
    );
    if (operationIds.length === 0) {
        return [];
    }

    return (await getOperationsByIds(operationIds))
        .filter(
            (operation) =>
                operation.status === 'blocked' &&
                operation.blockedAt &&
                (!filter.from || operation.blockedAt >= filter.from) &&
                (!filter.to || operation.blockedAt <= filter.to),
        )
        .sort(
            (left, right) =>
                (right.blockedAt?.getTime() ?? 0) -
                (left.blockedAt?.getTime() ?? 0),
        );
}

async function getFarmUserAcceptedOperationsUncached(
    userId: string,
    filter?: OperationsFilter,
) {
    let operationsWithAggregates: Awaited<
        ReturnType<typeof fillOperationAggregates>
    >;

    if (filter?.completedFrom || filter?.completedTo) {
        const completedOperations =
            await getCompletedFarmUserAcceptedOperationsByCompletionDate(
                userId,
                {
                    from: filter.completedFrom || new Date('1970-01-01'),
                    to: filter.completedTo || new Date('2099-12-31'),
                },
            );

        operationsWithAggregates =
            await fillOperationAggregates(completedOperations);
    } else {
        const rows = await storage()
            .select({ operation: operations })
            .from(operations)
            .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
            .leftJoin(gardens, eq(gardens.id, operationGardenIdExpression()))
            .innerJoin(
                farmUsers,
                eq(farmUsers.farmId, operationFarmIdExpression()),
            )
            .where(
                and(
                    eq(farmUsers.userId, userId),
                    eq(operations.isAccepted, true),
                    eq(operations.isDeleted, false),
                    operationLocationIntegrityWhere(),
                    filter?.from
                        ? gte(operations.timestamp, filter.from)
                        : undefined,
                    filter?.to
                        ? lte(operations.timestamp, filter.to)
                        : undefined,
                ),
            )
            .orderBy(desc(operations.timestamp));

        operationsWithAggregates = await fillOperationAggregates(
            rows.map((row) => row.operation),
        );
    }

    if (filter?.status) {
        const statusArray = Array.isArray(filter.status)
            ? filter.status
            : [filter.status];
        operationsWithAggregates = operationsWithAggregates.filter(
            (operation) =>
                operation &&
                statusArray.includes(operation.status as OperationStatus),
        );
    }

    return operationsWithAggregates;
}

export async function getFarmAcceptedOperations(
    farmId: number,
    filter?: OperationsFilter,
) {
    const rows = await storage()
        .select({ operation: operations })
        .from(operations)
        .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .leftJoin(gardens, eq(gardens.id, operationGardenIdExpression()))
        .where(
            and(
                eq(operationFarmIdExpression(), farmId),
                eq(operations.isAccepted, true),
                eq(operations.isDeleted, false),
                operationLocationIntegrityWhere(),
                filter?.from
                    ? gte(operations.timestamp, filter.from)
                    : undefined,
                filter?.to ? lte(operations.timestamp, filter.to) : undefined,
            ),
        )
        .orderBy(desc(operations.timestamp));

    let operationsWithAggregates = await fillOperationAggregates(
        rows.map((row) => row.operation),
    );

    if (filter?.completedFrom || filter?.completedTo) {
        operationsWithAggregates = operationsWithAggregates.filter(
            (operation) => {
                if (!operation.completedAt) {
                    return false;
                }

                if (
                    filter.completedFrom &&
                    operation.completedAt < filter.completedFrom
                ) {
                    return false;
                }

                if (
                    filter.completedTo &&
                    operation.completedAt > filter.completedTo
                ) {
                    return false;
                }

                return true;
            },
        );
    }

    if (filter?.status) {
        const statusArray = Array.isArray(filter.status)
            ? filter.status
            : [filter.status];
        operationsWithAggregates = operationsWithAggregates.filter(
            (operation) =>
                operation &&
                statusArray.includes(operation.status as OperationStatus),
        );
    }

    return operationsWithAggregates;
}

export async function getFarmAcceptedOperationsByScheduleRange({
    farmId,
    from,
    to,
}: {
    farmId: number;
    from: Date;
    to: Date;
}) {
    const scheduledDateExpression = sql<string>`${events.data} ->> 'scheduledDate'`;
    const scheduledRows = await storage()
        .selectDistinct({ id: operations.id })
        .from(operations)
        .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .leftJoin(gardens, eq(gardens.id, operationGardenIdExpression()))
        .innerJoin(
            events,
            and(
                sql`${events.aggregateId} = cast(${operations.id} as text)`,
                eq(events.type, knownEventTypes.operations.schedule),
            ),
        )
        .where(
            and(
                eq(operationFarmIdExpression(), farmId),
                eq(operations.isAccepted, true),
                eq(operations.isDeleted, false),
                operationLocationIntegrityWhere(),
                gte(scheduledDateExpression, from.toISOString()),
                lte(scheduledDateExpression, to.toISOString()),
            ),
        );
    const timestampRows = await storage()
        .selectDistinct({ id: operations.id })
        .from(operations)
        .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .leftJoin(gardens, eq(gardens.id, operationGardenIdExpression()))
        .where(
            and(
                eq(operationFarmIdExpression(), farmId),
                eq(operations.isAccepted, true),
                eq(operations.isDeleted, false),
                operationLocationIntegrityWhere(),
                gte(operations.timestamp, from),
                lte(operations.timestamp, to),
            ),
        );
    const operationIds = Array.from(
        new Set([
            ...scheduledRows.map((row) => row.id),
            ...timestampRows.map((row) => row.id),
        ]),
    );

    return getOperationsByIds(operationIds);
}

export async function getRaisedBedOperationsByScheduleRange({
    raisedBedIds,
    from,
    to,
}: {
    raisedBedIds: number[];
    from: Date;
    to: Date;
}) {
    const uniqueRaisedBedIds = Array.from(new Set(raisedBedIds));
    if (uniqueRaisedBedIds.length === 0) {
        return [];
    }

    const scheduledDateExpression = sql<string>`${events.data} ->> 'scheduledDate'`;
    const scheduledRows = await storage()
        .selectDistinct({ id: operations.id })
        .from(operations)
        .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .leftJoin(gardens, eq(gardens.id, operationGardenIdExpression()))
        .innerJoin(
            events,
            and(
                sql`${events.aggregateId} = cast(${operations.id} as text)`,
                eq(events.type, knownEventTypes.operations.schedule),
            ),
        )
        .where(
            and(
                inArray(operations.raisedBedId, uniqueRaisedBedIds),
                eq(operations.isDeleted, false),
                operationLocationIntegrityWhere(),
                gte(scheduledDateExpression, from.toISOString()),
                lte(scheduledDateExpression, to.toISOString()),
            ),
        );
    const timestampRows = await storage()
        .selectDistinct({ id: operations.id })
        .from(operations)
        .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .leftJoin(gardens, eq(gardens.id, operationGardenIdExpression()))
        .where(
            and(
                inArray(operations.raisedBedId, uniqueRaisedBedIds),
                eq(operations.isDeleted, false),
                operationLocationIntegrityWhere(),
                gte(operations.timestamp, from),
                lte(operations.timestamp, to),
            ),
        );
    const operationIds = Array.from(
        new Set([
            ...scheduledRows.map((row) => row.id),
            ...timestampRows.map((row) => row.id),
        ]),
    );

    return getOperationsByIds(operationIds);
}

export async function getFarmUserAcceptedOperationById(
    userId: string,
    id: number,
    db: DatabaseClient = storage(),
) {
    const operations = await getFarmUserAcceptedOperationsByIds(
        userId,
        [id],
        db,
    );
    const [operationWithAggregates] = await fillOperationAggregates(
        operations,
        db,
    );
    return operationWithAggregates ?? null;
}

export async function getFarmUserAcceptedOperationsByScheduleRange({
    userId,
    from,
    to,
}: {
    userId: string;
    from: Date;
    to: Date;
}) {
    return cacheScheduleRead(
        scheduleCacheKeys.farmUserScheduledOperations(userId, from, to),
        async () => {
            const scheduledDateExpression = sql<string>`${events.data} ->> 'scheduledDate'`;
            const scheduledRows = await storage()
                .selectDistinct({ id: operations.id })
                .from(operations)
                .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
                .leftJoin(
                    gardens,
                    eq(gardens.id, operationGardenIdExpression()),
                )
                .innerJoin(
                    farmUsers,
                    eq(farmUsers.farmId, operationFarmIdExpression()),
                )
                .innerJoin(
                    events,
                    and(
                        sql`${events.aggregateId} = cast(${operations.id} as text)`,
                        eq(events.type, knownEventTypes.operations.schedule),
                    ),
                )
                .where(
                    and(
                        eq(farmUsers.userId, userId),
                        eq(operations.isAccepted, true),
                        eq(operations.isDeleted, false),
                        operationLocationIntegrityWhere(),
                        gte(scheduledDateExpression, from.toISOString()),
                        lte(scheduledDateExpression, to.toISOString()),
                    ),
                );

            const acceptedOperations = await getFarmUserAcceptedOperationsByIds(
                userId,
                scheduledRows.map((row) => row.id),
            );

            return fillOperationAggregates(acceptedOperations);
        },
        scheduleCacheTtls.operations,
    );
}

export async function getAssignableFarmUsersByOperationIds(
    operationIds: number[],
    db: DatabaseClient = storage(),
) {
    const uniqueOperationIds = Array.from(new Set(operationIds));
    if (uniqueOperationIds.length === 0) {
        const emptyAssignableFarmUsersByOperationId: Record<
            number,
            OperationAssignableFarmUser[]
        > = {};

        return emptyAssignableFarmUsersByOperationId;
    }

    const rows = await db
        .select({
            operationId: operations.id,
            farmId: farmUsers.farmId,
            userId: users.id,
            userName: users.userName,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
        })
        .from(operations)
        .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .leftJoin(gardens, eq(gardens.id, operationGardenIdExpression()))
        .innerJoin(farmUsers, eq(farmUsers.farmId, operationFarmIdExpression()))
        .innerJoin(users, eq(farmUsers.userId, users.id))
        .where(
            and(
                inArray(operations.id, uniqueOperationIds),
                eq(operations.isDeleted, false),
                operationLocationIntegrityWhere(),
            ),
        )
        .orderBy(asc(operations.id), asc(users.userName));

    const assignableFarmUsersByOperationId: Record<
        number,
        OperationAssignableFarmUser[]
    > = {};

    for (const row of rows) {
        const existingUsers =
            assignableFarmUsersByOperationId[row.operationId] ?? [];
        if (existingUsers.some((user) => user.id === row.userId)) {
            continue;
        }

        existingUsers.push({
            id: row.userId,
            userName: row.userName,
            displayName: row.displayName,
            avatarUrl: row.avatarUrl,
            farmId: row.farmId,
        });
        assignableFarmUsersByOperationId[row.operationId] = existingUsers;
    }

    return assignableFarmUsersByOperationId;
}

export async function lockOperationFarmUserMemberships(
    operationId: number,
    userIds: readonly string[],
    db: DatabaseClient,
) {
    const uniqueUserIds = Array.from(new Set(userIds));
    if (uniqueUserIds.length === 0) {
        return [];
    }

    const rows = await db
        .select({ userId: farmUsers.userId })
        .from(operations)
        .leftJoin(raisedBeds, eq(operations.raisedBedId, raisedBeds.id))
        .leftJoin(gardens, eq(gardens.id, operationGardenIdExpression()))
        .innerJoin(farmUsers, eq(farmUsers.farmId, operationFarmIdExpression()))
        .innerJoin(users, eq(farmUsers.userId, users.id))
        .where(
            and(
                eq(operations.id, operationId),
                inArray(farmUsers.userId, uniqueUserIds),
                eq(operations.isDeleted, false),
                operationLocationIntegrityWhere(),
            ),
        )
        .for('key share', { of: farmUsers });

    return Array.from(new Set(rows.map((row) => row.userId)));
}

export async function getOperationsByIds(
    ids: number[],
    db: DatabaseClient = storage(),
) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
        return [];
    }

    const operationsList = await db.query.operations.findMany({
        where: and(
            inArray(operations.id, uniqueIds),
            eq(operations.isDeleted, false),
        ),
        orderBy: desc(operations.timestamp),
    });

    return fillOperationAggregates(operationsList, db);
}

export async function getOperationById(
    id: number,
    db: DatabaseClient = storage(),
) {
    const operation = await db.query.operations.findFirst({
        where: and(eq(operations.id, id), eq(operations.isDeleted, false)),
    });
    if (!operation) {
        throw new Error(`Operation with id ${id} not found`);
    }
    return (await fillOperationAggregates([operation], db))[0];
}

export async function createOperation(
    {
        entityId,
        entityTypeName,
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        raisedBedFieldId,
        timestamp,
    }: InsertOperation,
    db?: DatabaseClient,
) {
    const operation: InsertOperation = {
        entityId,
        entityTypeName,
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        raisedBedFieldId,
        timestamp: timestamp ?? new Date(),
    };
    const insertOperation = async (client: DatabaseClient) => {
        await assertOperationTargetAllowsDefinition(operation, client);
        const [result] = await client
            .insert(operations)
            .values(operation)
            .returning({ id: operations.id });
        return result.id;
    };

    if (db) {
        return insertOperation(db);
    }

    const id = await storage().transaction(insertOperation);
    await bustScheduleCache();
    return id;
}

export async function createScheduledOperation(
    operation: InsertOperation,
    {
        accept = false,
        scheduledDate,
    }: {
        accept?: boolean;
        scheduledDate: Date;
    },
) {
    const operationId = await storage().transaction(async (transaction) => {
        const id = await createOperation(operation, transaction);
        await createEvent(
            knownEvents.operations.scheduledV1(id.toString(), {
                scheduledDate: scheduledDate.toISOString(),
            }),
            transaction,
        );
        if (accept) {
            await acceptOperation(id, transaction);
        }
        return id;
    });
    await bustScheduleCache();
    return operationId;
}

type CheckoutOperationOptions = {
    accept?: boolean;
    delivery: CheckoutOperationCreatedPayload['delivery'];
    paymentCurrency: CheckoutOperationCreatedPayload['paymentCurrency'];
    scheduledDate: Date;
};

function checkoutOperationAggregateId(cartItemId: number) {
    if (!Number.isSafeInteger(cartItemId) || cartItemId <= 0) {
        throw new CheckoutOperationConflictError(
            'Checkout cart item id must be a positive safe integer.',
        );
    }
    return `shoppingCartItem:${cartItemId.toString()}`;
}

function checkoutOperationFingerprint(
    operation: InsertOperation,
    options: CheckoutOperationOptions,
): Omit<CheckoutOperationCreatedPayload, 'operationId'> {
    const scheduledDate = options.scheduledDate.toISOString();
    const operationTimestamp = operation.timestamp?.toISOString() ?? null;

    return {
        accountId: operation.accountId ?? null,
        entityId: operation.entityId,
        entityTypeName: operation.entityTypeName,
        farmId: operation.farmId ?? null,
        gardenId: operation.gardenId ?? null,
        raisedBedId: operation.raisedBedId ?? null,
        raisedBedFieldId: operation.raisedBedFieldId ?? null,
        operationTimestamp,
        paymentCurrency: options.paymentCurrency,
        delivery: options.delivery,
        scheduledDate,
        accepted: options.accept ?? false,
    };
}

function parseCheckoutOperationCreatedPayload(
    value: unknown,
): CheckoutOperationCreatedPayload | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const data = value as Record<string, unknown>;
    const nullableString = (candidate: unknown): candidate is string | null =>
        typeof candidate === 'string' || candidate === null;
    const nullableNumber = (candidate: unknown): candidate is number | null =>
        (typeof candidate === 'number' && Number.isSafeInteger(candidate)) ||
        candidate === null;
    const paymentCurrency = (
        candidate: unknown,
    ): candidate is CheckoutOperationCreatedPayload['paymentCurrency'] =>
        candidate === 'eur' ||
        candidate === 'inventory' ||
        candidate === 'sunflower';
    const delivery = (
        candidate: unknown,
    ): CheckoutOperationCreatedPayload['delivery'] | undefined => {
        if (candidate === null) {
            return null;
        }
        if (
            !candidate ||
            typeof candidate !== 'object' ||
            Array.isArray(candidate)
        ) {
            return undefined;
        }
        const value = candidate as Record<string, unknown>;
        if (
            typeof value.slotId !== 'number' ||
            !Number.isSafeInteger(value.slotId) ||
            (value.mode !== 'delivery' && value.mode !== 'pickup') ||
            !nullableNumber(value.addressId) ||
            !nullableNumber(value.locationId) ||
            !nullableString(value.notes)
        ) {
            return undefined;
        }
        return {
            addressId: value.addressId,
            locationId: value.locationId,
            mode: value.mode,
            notes: value.notes,
            slotId: value.slotId,
        };
    };
    const isoDateString = (candidate: unknown): candidate is string => {
        if (typeof candidate !== 'string') {
            return false;
        }
        const parsed = new Date(candidate);
        return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString() === candidate
        );
    };

    const parsedDelivery = delivery(data.delivery);
    if (
        typeof data.operationId !== 'number' ||
        !Number.isSafeInteger(data.operationId) ||
        data.operationId <= 0 ||
        !nullableString(data.accountId) ||
        typeof data.entityId !== 'number' ||
        !Number.isSafeInteger(data.entityId) ||
        typeof data.entityTypeName !== 'string' ||
        !nullableNumber(data.farmId) ||
        !nullableNumber(data.gardenId) ||
        !nullableNumber(data.raisedBedId) ||
        !nullableNumber(data.raisedBedFieldId) ||
        !nullableString(data.operationTimestamp) ||
        (data.operationTimestamp !== null &&
            !isoDateString(data.operationTimestamp)) ||
        !paymentCurrency(data.paymentCurrency) ||
        parsedDelivery === undefined ||
        !isoDateString(data.scheduledDate) ||
        typeof data.accepted !== 'boolean'
    ) {
        return null;
    }

    return {
        operationId: data.operationId,
        accountId: data.accountId,
        entityId: data.entityId,
        entityTypeName: data.entityTypeName,
        farmId: data.farmId,
        gardenId: data.gardenId,
        raisedBedId: data.raisedBedId,
        raisedBedFieldId: data.raisedBedFieldId,
        operationTimestamp: data.operationTimestamp,
        paymentCurrency: data.paymentCurrency,
        delivery: parsedDelivery,
        scheduledDate: data.scheduledDate,
        accepted: data.accepted,
    };
}

export async function getCheckoutOperationMappings(
    cartItemIds: number[],
    db: DatabaseClient = storage(),
): Promise<ReadonlyMap<number, CheckoutOperationCreatedPayload>> {
    const uniqueCartItemIds = Array.from(new Set(cartItemIds));
    if (uniqueCartItemIds.length === 0) {
        return new Map();
    }

    const cartItemIdsByAggregateId = new Map(
        uniqueCartItemIds.map((cartItemId) => [
            checkoutOperationAggregateId(cartItemId),
            cartItemId,
        ]),
    );
    const mappingEvents = await getAllEvents(
        knownEventTypes.checkout.operationCreated,
        Array.from(cartItemIdsByAggregateId.keys()),
        { db },
    );
    const mappings = new Map<number, CheckoutOperationCreatedPayload>();

    for (const mappingEvent of mappingEvents) {
        const cartItemId = cartItemIdsByAggregateId.get(
            mappingEvent.aggregateId,
        );
        if (cartItemId === undefined) {
            throw new CheckoutOperationConflictError(
                'Checkout operation mapping has an unexpected aggregate.',
            );
        }
        if (mappings.has(cartItemId)) {
            throw new CheckoutOperationConflictError(
                'Checkout cart item has multiple operation mappings.',
            );
        }
        if (mappingEvent.version !== 1) {
            throw new CheckoutOperationConflictError(
                'Checkout operation mapping has an unsupported version.',
            );
        }
        const mapping = parseCheckoutOperationCreatedPayload(mappingEvent.data);
        if (!mapping) {
            throw new CheckoutOperationConflictError(
                'Checkout operation mapping is malformed.',
            );
        }
        mappings.set(cartItemId, mapping);
    }

    return mappings;
}

export async function getCheckoutOperationProvenance(
    operationIds: number[],
    db: DatabaseClient = storage(),
): Promise<{
    recordedFrom: Date;
    requestedOperationIds: ReadonlySet<number>;
}> {
    const uniqueOperationIds = Array.from(new Set(operationIds));
    if (uniqueOperationIds.length === 0) {
        return {
            recordedFrom: new Date(
                CHECKOUT_OPERATION_PROVENANCE_INTRODUCED_AT_MS,
            ),
            requestedOperationIds: new Set(),
        };
    }

    const operationIdExpression = sql<string>`${events.data}->>'operationId'`;
    const [mappingEvents, [recordingPeriod]] = await Promise.all([
        db
            .select({ operationId: operationIdExpression })
            .from(events)
            .where(
                and(
                    eq(events.type, knownEventTypes.checkout.operationCreated),
                    inArray(
                        operationIdExpression,
                        uniqueOperationIds.map((operationId) =>
                            operationId.toString(),
                        ),
                    ),
                ),
            ),
        db
            .select({
                recordedFrom:
                    sql<Date | null>`min(${events.createdAt})`.mapWith(
                        events.createdAt,
                    ),
            })
            .from(events)
            .where(eq(events.type, knownEventTypes.checkout.operationCreated)),
    ]);

    return {
        recordedFrom:
            recordingPeriod?.recordedFrom ??
            new Date(CHECKOUT_OPERATION_PROVENANCE_INTRODUCED_AT_MS),
        requestedOperationIds: new Set(
            mappingEvents.map((event) =>
                Number.parseInt(event.operationId, 10),
            ),
        ),
    };
}

export async function getCheckoutOperationMapping(
    cartItemId: number,
    db: DatabaseClient = storage(),
) {
    return (
        (await getCheckoutOperationMappings([cartItemId], db)).get(
            cartItemId,
        ) ?? null
    );
}

function assertCheckoutOperationFingerprint(
    stored: CheckoutOperationCreatedPayload,
    expected: Omit<CheckoutOperationCreatedPayload, 'operationId'>,
) {
    const fingerprintFields = [
        'accountId',
        'entityId',
        'entityTypeName',
        'farmId',
        'gardenId',
        'raisedBedId',
        'raisedBedFieldId',
        'operationTimestamp',
        'paymentCurrency',
        'scheduledDate',
        'accepted',
    ] as const;
    const mismatch = fingerprintFields.find(
        (field) => stored[field] !== expected[field],
    );
    if (mismatch) {
        throw new CheckoutOperationConflictError(
            `Checkout operation fingerprint conflicts on ${mismatch}.`,
        );
    }
    const storedDelivery = stored.delivery;
    const expectedDelivery = expected.delivery;
    const deliveryMismatch =
        (storedDelivery === null) !== (expectedDelivery === null) ||
        (storedDelivery !== null &&
            expectedDelivery !== null &&
            (storedDelivery.addressId !== expectedDelivery.addressId ||
                storedDelivery.locationId !== expectedDelivery.locationId ||
                storedDelivery.mode !== expectedDelivery.mode ||
                storedDelivery.notes !== expectedDelivery.notes ||
                storedDelivery.slotId !== expectedDelivery.slotId));
    if (deliveryMismatch) {
        throw new CheckoutOperationConflictError(
            'Checkout operation fingerprint conflicts on delivery.',
        );
    }
}

async function ensureCheckoutOperation(
    cartItemId: number,
    operation: InsertOperation,
    options: CheckoutOperationOptions,
    db: DatabaseClient,
) {
    const fingerprint = checkoutOperationFingerprint(operation, options);
    const stored = await getCheckoutOperationMapping(cartItemId, db);
    if (stored) {
        assertCheckoutOperationFingerprint(stored, fingerprint);

        const mappedOperation = await db.query.operations.findFirst({
            columns: {
                id: true,
                accountId: true,
                entityId: true,
                entityTypeName: true,
                farmId: true,
                gardenId: true,
                raisedBedId: true,
                raisedBedFieldId: true,
                timestamp: true,
            },
            where: and(
                eq(operations.id, stored.operationId),
                eq(operations.isDeleted, false),
            ),
        });
        if (!mappedOperation) {
            throw new CheckoutOperationConflictError(
                'Checkout operation mapping points to a missing or deleted operation.',
            );
        }
        const operationMismatch = (
            [
                'accountId',
                'entityId',
                'entityTypeName',
                'farmId',
                'gardenId',
                'raisedBedId',
                'raisedBedFieldId',
            ] as const
        ).find((field) => mappedOperation[field] !== fingerprint[field]);
        if (
            operationMismatch ||
            (fingerprint.operationTimestamp !== null &&
                mappedOperation.timestamp.toISOString() !==
                    fingerprint.operationTimestamp)
        ) {
            throw new CheckoutOperationConflictError(
                'Checkout operation mapping conflicts with the stored operation.',
            );
        }
        return { operationId: stored.operationId, created: false } as const;
    }

    const operationId = await createOperation(operation, db);
    await createEvent(
        knownEvents.operations.scheduledV1(operationId.toString(), {
            scheduledDate: fingerprint.scheduledDate,
        }),
        db,
    );
    if (fingerprint.accepted) {
        await acceptOperation(operationId, db);
    }
    await createEvent(
        knownEvents.checkout.operationCreatedV1(
            checkoutOperationAggregateId(cartItemId),
            {
                operationId,
                ...fingerprint,
            },
        ),
        db,
    );
    await enqueueCheckoutOperationScheduledNotification(
        {
            operationId,
            scheduledDate: new Date(fingerprint.scheduledDate),
        },
        db,
    );

    return { operationId, created: true } as const;
}

export async function getOrCreateCheckoutOperation(
    cartItemId: number,
    operation: InsertOperation,
    options: CheckoutOperationOptions,
    db?: DatabaseClient,
): Promise<{ operationId: number; created: boolean }> {
    if (db) {
        return ensureCheckoutOperation(cartItemId, operation, options, db);
    }

    const aggregateId = checkoutOperationAggregateId(cartItemId);
    const runInTransaction = () =>
        storage().transaction(async (transaction) => {
            if (!isPgliteTestDatabase()) {
                await transaction.execute(
                    sql`select pg_advisory_xact_lock(hashtext(${`checkout-operation:${aggregateId}`}));`,
                );
            }
            return ensureCheckoutOperation(
                cartItemId,
                operation,
                options,
                transaction,
            );
        });

    const result = isPgliteTestDatabase()
        ? await withCheckoutOperationInProcessLock(
              aggregateId,
              runInTransaction,
          )
        : await runInTransaction();
    if (result.created) {
        await bustScheduleCache();
    }
    return result;
}

export async function switchOperationEntity(
    id: number,
    entity: Pick<InsertOperation, 'entityId' | 'entityTypeName'>,
    db?: DatabaseClient,
) {
    const updateEntity = async (client: DatabaseClient) => {
        const [currentOperation] = await client
            .select({
                id: operations.id,
                raisedBedFieldId: operations.raisedBedFieldId,
            })
            .from(operations)
            .where(and(eq(operations.id, id), eq(operations.isDeleted, false)))
            .limit(1)
            .for('update');

        if (!currentOperation) {
            throw new Error(`Operation with id ${id} not found`);
        }

        await assertOperationTargetAllowsDefinition(
            {
                ...entity,
                raisedBedFieldId: currentOperation.raisedBedFieldId,
            },
            client,
        );
        await client
            .update(operations)
            .set({
                entityId: entity.entityId,
                entityTypeName: entity.entityTypeName,
            })
            .where(eq(operations.id, currentOperation.id));

        await createEvent(
            knownEvents.operations.entityChangedV1(id.toString(), {
                entityId: entity.entityId,
                entityTypeName: entity.entityTypeName,
            }),
            client,
        );
    };

    if (db) {
        await updateEntity(db);
    } else {
        await storage().transaction(updateEntity);
        await bustScheduleCache();
    }
}

async function setOperationAcceptance(
    id: number,
    accepted: boolean,
    db?: DatabaseClient,
) {
    const updateAcceptance = async (client: DatabaseClient) => {
        const [updatedOperation] = await client
            .update(operations)
            .set({ isAccepted: accepted })
            .where(
                and(
                    eq(operations.id, id),
                    eq(operations.isDeleted, false),
                    eq(operations.isAccepted, !accepted),
                ),
            )
            .returning({ id: operations.id });

        if (!updatedOperation) {
            return false;
        }

        await createEvent(
            knownEvents.operations.acceptanceChangedV1(id.toString(), {
                accepted,
            }),
            client,
        );
        return true;
    };

    const changed = db
        ? await updateAcceptance(db)
        : await storage().transaction(updateAcceptance);
    if (!db && changed) {
        await bustScheduleCache();
    }
}

export async function acceptOperation(id: number, db?: DatabaseClient) {
    await setOperationAcceptance(id, true, db);
}

export async function unacceptOperation(id: number, db?: DatabaseClient) {
    await setOperationAcceptance(id, false, db);
}

export async function deleteOperation(id: number) {
    await storage()
        .update(operations)
        .set({ isDeleted: true })
        .where(eq(operations.id, id));
    await bustScheduleCache();
}

async function getCompletedOperationsByCompletionDate(filter: {
    from: Date;
    to: Date;
}) {
    // First, get completion events within the date range
    const completionEvents = await storage().query.events.findMany({
        where: and(
            eq(events.type, knownEventTypes.operations.complete),
            gte(events.createdAt, filter.from),
            lte(events.createdAt, filter.to),
        ),
        orderBy: [asc(events.createdAt)],
    });

    if (completionEvents.length === 0) {
        return [];
    }

    // Extract operation IDs from the completion events
    const operationIds = completionEvents.map((event) =>
        parseInt(event.aggregateId, 10),
    );

    // Get the operations that were completed
    const completedOperations = await storage().query.operations.findMany({
        where: and(
            inArray(operations.id, operationIds),
            eq(operations.isDeleted, false),
        ),
        orderBy: desc(operations.timestamp),
    });

    // Fill aggregates for these specific operations
    return await fillOperationAggregates(completedOperations);
}
