import 'server-only';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { storage } from '..';
import { bustScheduleCache } from '../cache/scheduleCache';
import {
    events,
    farmUsers,
    gardens,
    operations,
    raisedBeds,
    users,
} from '../schema';
import {
    type InsertRaisedBedField,
    raisedBedFields,
    type SelectRaisedBedField,
} from '../schema/gardenSchema';
import { normalizeAssignedUserIds } from './events/normalizeAssignedUserIds';
import {
    createEvent,
    getAllEvents,
    knownEvents,
    knownEventTypes,
    type RaisedBedFieldSowingLocation,
    type RaisedBedWeedStateLevel,
    type RaisedBedWeedStateSetPayload,
    type RaisedBedWeedStateSource,
    updateEventCreatedAt,
} from './eventsRepo';

export type { RaisedBedWeedStateSetPayload } from './eventsRepo';

const RAISED_BED_FIELDS_PER_BLOCK = 9;
const PLANT_CYCLE_EVENT_TYPES = [
    knownEventTypes.raisedBedFields.plantPlace,
    knownEventTypes.raisedBedFields.plantSchedule,
    knownEventTypes.raisedBedFields.plantUpdate,
    knownEventTypes.raisedBedFields.plantReplaceSort,
    knownEventTypes.raisedBedFields.delete,
] as const;
const PLANT_CYCLE_EVENT_TYPE_SET = new Set<string>(PLANT_CYCLE_EVENT_TYPES);
const RAISED_BED_FIELD_EVENT_TYPES = [
    knownEventTypes.raisedBedFields.create,
    knownEventTypes.raisedBedFields.delete,
    knownEventTypes.raisedBedFields.plantPlace,
    knownEventTypes.raisedBedFields.plantSchedule,
    knownEventTypes.raisedBedFields.plantUpdate,
    knownEventTypes.raisedBedFields.plantReplaceSort,
    knownEventTypes.raisedBedFields.weedStateSet,
] as const;

type CanonicalRaisedBedField = {
    id: number;
    positionIndex: number;
};

type RaisedBedFieldPlantCycleEvent = typeof events.$inferSelect;

export type RaisedBedFieldPlantStatusChange = {
    status: string;
    occurredAt: Date;
};

export type RaisedBedWeedState = {
    level: RaisedBedWeedStateLevel;
    source: RaisedBedWeedStateSource;
    observedAt: Date;
    updatedAt: Date;
    eventId: number;
    notes?: string | null;
};

export type RaisedBedFieldPlantCycle = {
    aggregateId: string;
    positionIndex: number;
    plantPlaceEventId: number;
    eventIds: number[];
    startedAt: Date;
    endedAt: Date;
    endedEventId: number;
    active: boolean;
    plantStatus?: string;
    plantSortId?: number;
    plantScheduledDate?: Date;
    sowingLocation: RaisedBedFieldSowingLocation;
    plantSowDate?: Date;
    plantGrowthDate?: Date;
    plantReadyDate?: Date;
    plantDeadDate?: Date;
    plantHarvestedDate?: Date;
    plantRemovedDate?: Date;
    statusChanges: RaisedBedFieldPlantStatusChange[];
    stoppedDate?: Date;
    toBeRemoved: boolean;
    assignedUserId?: string | null;
    assignedUserIds?: string[];
    assignedBy?: string | null;
    assignedAt?: Date;
    cancellationReason?: string;
};

export type AssignableFarmUser = {
    id: string;
    userName: string;
    displayName: string | null;
    avatarUrl: string | null;
    farmId: number;
};

export type RaisedBedFieldAssignableFarmUser = AssignableFarmUser;

export type GardenAssignableFarmUser = AssignableFarmUser;

export type UniqueGardenAssignableFarmUser = Omit<AssignableFarmUser, 'farmId'>;

type FarmAssignableUserRow = {
    farmId: number;
    userId: string;
    userName: string;
    displayName: string | null;
    avatarUrl: string | null;
};

// Parse assignment metadata carried on events without trusting arbitrary payload shapes.
function extractAssignedUserId(value: unknown) {
    return typeof value === 'string' || value === null ? value : undefined;
}

// Status updates can include assignee metadata for analytics, but only explicit
// assignment events should mutate the projected assignment state.
function isAssignmentEvent(data: { status?: unknown; assignedBy?: unknown }) {
    const hasStatus = typeof data.status === 'string';
    const hasAssignedBy =
        typeof data.assignedBy === 'string' || data.assignedBy === null;

    // Apply assignment mutations for pure assignment events, or for combined
    // updates that explicitly carry assignment ownership via `assignedBy`.
    return !hasStatus || hasAssignedBy;
}

async function getAssignableFarmUserRowsByFarmIds(farmIds: number[]) {
    const uniqueFarmIds = Array.from(new Set(farmIds));
    if (uniqueFarmIds.length === 0) {
        return [] as FarmAssignableUserRow[];
    }

    return storage()
        .selectDistinct({
            farmId: farmUsers.farmId,
            userId: users.id,
            userName: users.userName,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
        })
        .from(farmUsers)
        .innerJoin(users, eq(farmUsers.userId, users.id))
        .where(inArray(farmUsers.farmId, uniqueFarmIds))
        .orderBy(asc(farmUsers.farmId), asc(users.userName));
}

export async function getAssignableFarmUsersByGardenIds(gardenIds: number[]) {
    const uniqueGardenIds = Array.from(new Set(gardenIds));
    if (uniqueGardenIds.length === 0) {
        const emptyAssignableFarmUsersByGardenId: Record<
            number,
            GardenAssignableFarmUser[]
        > = {};

        return emptyAssignableFarmUsersByGardenId;
    }

    const gardenFarmRows = await storage()
        .select({
            gardenId: gardens.id,
            farmId: gardens.farmId,
        })
        .from(gardens)
        .where(
            and(
                inArray(gardens.id, uniqueGardenIds),
                eq(gardens.isDeleted, false),
            ),
        )
        .orderBy(asc(gardens.id));

    const farmUserRows = await getAssignableFarmUserRowsByFarmIds(
        gardenFarmRows.map((row) => row.farmId),
    );

    const usersByFarmId: Record<number, GardenAssignableFarmUser[]> = {};
    for (const row of farmUserRows) {
        const existingUsers = usersByFarmId[row.farmId] ?? [];
        existingUsers.push({
            id: row.userId,
            userName: row.userName,
            displayName: row.displayName,
            avatarUrl: row.avatarUrl,
            farmId: row.farmId,
        });
        usersByFarmId[row.farmId] = existingUsers;
    }

    const assignableFarmUsersByGardenId: Record<
        number,
        GardenAssignableFarmUser[]
    > = {};

    for (const row of gardenFarmRows) {
        assignableFarmUsersByGardenId[row.gardenId] =
            usersByFarmId[row.farmId] ?? [];
    }

    return assignableFarmUsersByGardenId;
}

export async function getUniqueAssignableFarmUsersByGardenIds(
    gardenIds: number[],
) {
    const uniqueGardenIds = Array.from(new Set(gardenIds));
    if (uniqueGardenIds.length === 0) {
        return [] as UniqueGardenAssignableFarmUser[];
    }

    const gardenFarmRows = await storage()
        .select({
            farmId: gardens.farmId,
        })
        .from(gardens)
        .where(
            and(
                inArray(gardens.id, uniqueGardenIds),
                eq(gardens.isDeleted, false),
            ),
        );
    const farmUserRows = await getAssignableFarmUserRowsByFarmIds(
        gardenFarmRows.map((row) => row.farmId),
    );

    return Array.from(
        new Map(
            farmUserRows.map((row) => [
                row.userId,
                {
                    id: row.userId,
                    userName: row.userName,
                    displayName: row.displayName,
                    avatarUrl: row.avatarUrl,
                },
            ]),
        ).values(),
    );
}

export async function getAssignableFarmUsersByRaisedBedFieldIds(
    raisedBedFieldIds: number[],
) {
    const uniqueRaisedBedFieldIds = Array.from(new Set(raisedBedFieldIds));
    if (uniqueRaisedBedFieldIds.length === 0) {
        const emptyAssignableFarmUsersByRaisedBedFieldId: Record<
            number,
            RaisedBedFieldAssignableFarmUser[]
        > = {};

        return emptyAssignableFarmUsersByRaisedBedFieldId;
    }

    const rows = await storage()
        .selectDistinct({
            raisedBedFieldId: raisedBedFields.id,
            farmId: farmUsers.farmId,
            userId: users.id,
            userName: users.userName,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
        })
        .from(raisedBedFields)
        .innerJoin(raisedBeds, eq(raisedBedFields.raisedBedId, raisedBeds.id))
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .innerJoin(farmUsers, eq(gardens.farmId, farmUsers.farmId))
        .innerJoin(users, eq(farmUsers.userId, users.id))
        .where(
            and(
                inArray(raisedBedFields.id, uniqueRaisedBedFieldIds),
                eq(raisedBedFields.isDeleted, false),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
            ),
        )
        .orderBy(asc(raisedBedFields.id), asc(users.userName));

    const assignableFarmUsersByRaisedBedFieldId: Record<
        number,
        RaisedBedFieldAssignableFarmUser[]
    > = {};

    for (const row of rows) {
        const existingUsers =
            assignableFarmUsersByRaisedBedFieldId[row.raisedBedFieldId] ?? [];
        existingUsers.push({
            id: row.userId,
            userName: row.userName,
            displayName: row.displayName,
            avatarUrl: row.avatarUrl,
            farmId: row.farmId,
        });
        assignableFarmUsersByRaisedBedFieldId[row.raisedBedFieldId] =
            existingUsers;
    }

    return assignableFarmUsersByRaisedBedFieldId;
}

export async function getRaisedBedFieldContext(raisedBedFieldId: number) {
    const rows = await storage()
        .select({
            id: raisedBeds.id,
            gardenId: raisedBeds.gardenId,
            accountId: raisedBeds.accountId,
            positionIndex: raisedBedFields.positionIndex,
        })
        .from(raisedBedFields)
        .innerJoin(raisedBeds, eq(raisedBedFields.raisedBedId, raisedBeds.id))
        .where(
            and(
                eq(raisedBedFields.id, raisedBedFieldId),
                eq(raisedBedFields.isDeleted, false),
                eq(raisedBeds.isDeleted, false),
            ),
        )
        .limit(1);

    return rows[0] ?? null;
}

function fieldRowPriority(
    field: SelectRaisedBedField,
    operationCountsByFieldId: Map<number, number>,
) {
    return {
        operationCount: operationCountsByFieldId.get(field.id) ?? 0,
        createdAt: field.createdAt.getTime(),
        id: field.id,
    };
}

export async function normalizeRaisedBedFieldsForMerge(
    tx: ReturnType<typeof storage>,
    raisedBedId: number,
    activeFields: SelectRaisedBedField[],
) {
    const invalidFields = activeFields.filter(
        (field) =>
            field.positionIndex < 0 ||
            field.positionIndex >= RAISED_BED_FIELDS_PER_BLOCK,
    );
    if (invalidFields.length > 0) {
        throw new Error(
            `Raised bed ${raisedBedId} has invalid source positions for merge: ${invalidFields.map((field) => field.positionIndex).join(', ')}`,
        );
    }

    const activeFieldIds = activeFields.map((field) => field.id);
    const operationCountsByFieldId =
        activeFieldIds.length === 0
            ? new Map<number, number>()
            : new Map(
                  (
                      await tx
                          .select({
                              raisedBedFieldId: operations.raisedBedFieldId,
                              count: count(),
                          })
                          .from(operations)
                          .where(
                              and(
                                  inArray(
                                      operations.raisedBedFieldId,
                                      activeFieldIds,
                                  ),
                                  eq(operations.isDeleted, false),
                              ),
                          )
                          .groupBy(operations.raisedBedFieldId)
                  ).flatMap((row) =>
                      typeof row.raisedBedFieldId === 'number'
                          ? [[row.raisedBedFieldId, row.count]]
                          : [],
                  ),
              );

    const fieldsByPosition = new Map<number, SelectRaisedBedField[]>();
    for (const field of activeFields) {
        const fieldsAtPosition = fieldsByPosition.get(field.positionIndex);
        if (fieldsAtPosition) {
            fieldsAtPosition.push(field);
        } else {
            fieldsByPosition.set(field.positionIndex, [field]);
        }
    }

    const duplicateFieldMappings: Array<{
        canonicalFieldId: number;
        duplicateFieldIds: number[];
    }> = [];
    const canonicalFields = new Map<number, CanonicalRaisedBedField>();

    for (
        let positionIndex = 0;
        positionIndex < RAISED_BED_FIELDS_PER_BLOCK;
        positionIndex += 1
    ) {
        const fieldsAtPosition = [
            ...(fieldsByPosition.get(positionIndex) ?? []),
        ].sort((left, right) => {
            const leftPriority = fieldRowPriority(
                left,
                operationCountsByFieldId,
            );
            const rightPriority = fieldRowPriority(
                right,
                operationCountsByFieldId,
            );

            if (rightPriority.operationCount !== leftPriority.operationCount) {
                return (
                    rightPriority.operationCount - leftPriority.operationCount
                );
            }

            if (leftPriority.createdAt !== rightPriority.createdAt) {
                return leftPriority.createdAt - rightPriority.createdAt;
            }

            return leftPriority.id - rightPriority.id;
        });

        const canonicalField = fieldsAtPosition.shift();
        if (canonicalField) {
            canonicalFields.set(positionIndex, {
                id: canonicalField.id,
                positionIndex,
            });

            if (fieldsAtPosition.length > 0) {
                duplicateFieldMappings.push({
                    canonicalFieldId: canonicalField.id,
                    duplicateFieldIds: fieldsAtPosition.map(
                        (field) => field.id,
                    ),
                });
            }

            continue;
        }

        const insertedField = await tx
            .insert(raisedBedFields)
            .values({
                raisedBedId,
                positionIndex,
            })
            .returning({
                id: raisedBedFields.id,
            });
        const insertedFieldId = insertedField[0]?.id;
        if (!insertedFieldId) {
            throw new Error(
                `Failed to create placeholder field ${positionIndex} for raised bed ${raisedBedId}`,
            );
        }

        canonicalFields.set(positionIndex, {
            id: insertedFieldId,
            positionIndex,
        });
    }

    for (const duplicateFieldMapping of duplicateFieldMappings) {
        if (duplicateFieldMapping.duplicateFieldIds.length === 0) {
            continue;
        }

        await tx
            .update(operations)
            .set({
                raisedBedFieldId: duplicateFieldMapping.canonicalFieldId,
            })
            .where(
                inArray(
                    operations.raisedBedFieldId,
                    duplicateFieldMapping.duplicateFieldIds,
                ),
            );

        await tx
            .update(raisedBedFields)
            .set({ isDeleted: true })
            .where(
                inArray(
                    raisedBedFields.id,
                    duplicateFieldMapping.duplicateFieldIds,
                ),
            );
    }

    return [...canonicalFields.values()].sort(
        (left, right) => left.positionIndex - right.positionIndex,
    );
}

async function getRaisedBedFieldRowsAtPosition(
    tx: ReturnType<typeof storage>,
    raisedBedId: number,
    positionIndex: number,
) {
    return tx.query.raisedBedFields.findMany({
        where: and(
            eq(raisedBedFields.raisedBedId, raisedBedId),
            eq(raisedBedFields.positionIndex, positionIndex),
        ),
        orderBy: [asc(raisedBedFields.createdAt), asc(raisedBedFields.id)],
    });
}

async function collapseDuplicateRaisedBedFieldRows(
    tx: ReturnType<typeof storage>,
    fieldRows: SelectRaisedBedField[],
) {
    const canonicalField = fieldRows[0];
    if (!canonicalField) {
        return null;
    }

    const duplicateFieldIds = fieldRows
        .slice(1)
        .map((existingField) => existingField.id);
    if (duplicateFieldIds.length > 0) {
        await tx
            .update(operations)
            .set({
                raisedBedFieldId: canonicalField.id,
            })
            .where(inArray(operations.raisedBedFieldId, duplicateFieldIds));

        await tx
            .update(raisedBedFields)
            .set({
                isDeleted: true,
                updatedAt: new Date(),
            })
            .where(inArray(raisedBedFields.id, duplicateFieldIds));
    }

    return canonicalField;
}

async function syncRaisedBedFieldRow(
    tx: ReturnType<typeof storage>,
    field: Omit<
        InsertRaisedBedField,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
) {
    const existingFieldRows = await getRaisedBedFieldRowsAtPosition(
        tx,
        field.raisedBedId,
        field.positionIndex,
    );
    const canonicalField = await collapseDuplicateRaisedBedFieldRows(
        tx,
        existingFieldRows,
    );

    if (!canonicalField) {
        await tx.insert(raisedBedFields).values(field);
        return;
    }

    await tx
        .update(raisedBedFields)
        .set({
            ...field,
            isDeleted: false,
            updatedAt: new Date(),
        })
        .where(eq(raisedBedFields.id, canonicalField.id));
}

function parsePlantSortId(value: unknown) {
    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        const parsedPlantSortId = parseInt(value, 10);
        return Number.isNaN(parsedPlantSortId) ? undefined : parsedPlantSortId;
    }

    return undefined;
}

function parseSowingLocation(
    value: unknown,
): RaisedBedFieldSowingLocation | undefined {
    return value === 'direct' || value === 'greenhouse' ? value : undefined;
}

function parseWeedStateLevel(value: unknown): RaisedBedWeedStateLevel | null {
    switch (value) {
        case 'none':
        case 'light':
        case 'heavy':
            return value;
        default:
            return null;
    }
}

function parseWeedStateSource(value: unknown): RaisedBedWeedStateSource {
    return value === 'ai' ? 'ai' : 'admin';
}

function parseWeedStateObservedAt(value: unknown, fallbackDate: Date): Date {
    if (typeof value !== 'string') {
        return fallbackDate;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallbackDate : date;
}

function weedStateFromEvent(
    event: RaisedBedFieldPlantCycleEvent,
): RaisedBedWeedState | null {
    const data =
        event.data && typeof event.data === 'object'
            ? (event.data as Partial<RaisedBedWeedStateSetPayload>)
            : undefined;
    const level = parseWeedStateLevel(data?.level);
    if (!level) {
        return null;
    }

    return {
        level,
        source: parseWeedStateSource(data?.source),
        observedAt: parseWeedStateObservedAt(data?.observedAt, event.createdAt),
        updatedAt: event.createdAt,
        eventId: event.id,
        notes: typeof data?.notes === 'string' ? data.notes : null,
    };
}

function _latestWeedStateFromEvents(
    weedStateEvents: RaisedBedFieldPlantCycleEvent[],
) {
    let weedState: RaisedBedWeedState | null = null;

    for (const event of weedStateEvents) {
        const nextWeedState = weedStateFromEvent(event);
        if (nextWeedState) {
            weedState = nextWeedState;
        }
    }

    return weedState;
}

function splitPlantCycleEvents(
    plantEvents: RaisedBedFieldPlantCycleEvent[],
): RaisedBedFieldPlantCycleEvent[][] {
    const plantCycles: RaisedBedFieldPlantCycleEvent[][] = [];
    let currentPlantCycle: RaisedBedFieldPlantCycleEvent[] = [];

    for (const plantEvent of plantEvents) {
        if (plantEvent.type === knownEventTypes.raisedBedFields.plantPlace) {
            if (currentPlantCycle.length > 0) {
                plantCycles.push(currentPlantCycle);
            }

            currentPlantCycle = [plantEvent];
            continue;
        }

        if (currentPlantCycle.length > 0) {
            currentPlantCycle.push(plantEvent);
        }
    }

    if (currentPlantCycle.length > 0) {
        plantCycles.push(currentPlantCycle);
    }

    return plantCycles;
}

function summarizePlantCycle(
    aggregateId: string,
    positionIndex: number,
    plantCycleEvents: RaisedBedFieldPlantCycleEvent[],
): RaisedBedFieldPlantCycle | null {
    const plantPlaceEvent = plantCycleEvents[0];
    if (
        !plantPlaceEvent ||
        plantPlaceEvent.type !== knownEventTypes.raisedBedFields.plantPlace
    ) {
        return null;
    }

    let plantStatus: string | undefined;
    let plantSortId: number | undefined;
    let plantScheduledDate: Date | undefined;
    let sowingLocation: RaisedBedFieldSowingLocation = 'direct';
    let plantSowDate: Date | undefined;
    let plantGrowthDate: Date | undefined;
    let plantReadyDate: Date | undefined;
    let plantDeadDate: Date | undefined;
    let plantHarvestedDate: Date | undefined;
    let plantRemovedDate: Date | undefined;
    const statusChanges: RaisedBedFieldPlantStatusChange[] = [];
    let active = false;
    let toBeRemoved = false;
    let stoppedDate: Date | undefined;
    let assignedUserId: string | null | undefined;
    let assignedUserIds: string[] | undefined;
    let assignedBy: string | null | undefined;
    let assignedAt: Date | undefined;
    let cancellationReason: string | undefined;

    for (const plantCycleEvent of plantCycleEvents) {
        const data = plantCycleEvent.data as
            | Record<string, unknown>
            | undefined;

        if (
            plantCycleEvent.type === knownEventTypes.raisedBedFields.plantPlace
        ) {
            active = true;
            toBeRemoved = false;
            stoppedDate = undefined;
            plantStatus = 'new';
            plantSortId = parsePlantSortId(data?.plantSortId);
            sowingLocation =
                parseSowingLocation(data?.sowingLocation) ?? 'direct';

            if (data?.scheduledDate && typeof data.scheduledDate === 'string') {
                plantScheduledDate = new Date(data.scheduledDate);
            } else if (
                data?.scheduledDate &&
                typeof data.scheduledDate === 'object' &&
                data.scheduledDate instanceof Date
            ) {
                plantScheduledDate = data.scheduledDate;
            } else {
                plantScheduledDate = undefined;
            }

            plantSowDate = undefined;
            plantGrowthDate = undefined;
            plantReadyDate = undefined;
            plantDeadDate = undefined;
            plantHarvestedDate = undefined;
            plantRemovedDate = undefined;
            assignedUserId = undefined;
            assignedUserIds = undefined;
            assignedBy = undefined;
            assignedAt = undefined;
            cancellationReason = undefined;
            continue;
        }

        if (
            plantCycleEvent.type ===
            knownEventTypes.raisedBedFields.plantSchedule
        ) {
            if (data?.scheduledDate && typeof data.scheduledDate === 'string') {
                plantScheduledDate = new Date(data.scheduledDate);
            } else if (
                data?.scheduledDate &&
                typeof data.scheduledDate === 'object' &&
                data.scheduledDate instanceof Date
            ) {
                plantScheduledDate = data.scheduledDate;
            } else if (data?.scheduledDate == null) {
                plantScheduledDate = undefined;
            }
            sowingLocation =
                parseSowingLocation(data?.sowingLocation) ?? sowingLocation;
            continue;
        }

        if (
            plantCycleEvent.type ===
            knownEventTypes.raisedBedFields.plantReplaceSort
        ) {
            const nextPlantSortId = parsePlantSortId(data?.plantSortId);
            if (typeof nextPlantSortId === 'number') {
                plantSortId = nextPlantSortId;
            }
            continue;
        }

        if (
            plantCycleEvent.type === knownEventTypes.raisedBedFields.plantUpdate
        ) {
            const previousPlantStatus = plantStatus;
            const nextPlantStatus =
                typeof data?.status === 'string' ? data.status : undefined;
            const statusEventDate = effectiveEventDate(
                data ?? {},
                plantCycleEvent.createdAt,
            );
            let shouldApplyAssignedBy = true;
            const shouldApplyAssignedUsers = isAssignmentEvent(data ?? {});
            const hasAssignedUserIdUpdate =
                shouldApplyAssignedUsers &&
                extractAssignedUserId(data?.assignedUserId) !== undefined;
            if (nextPlantStatus && nextPlantStatus !== previousPlantStatus) {
                statusChanges.push({
                    status: nextPlantStatus,
                    occurredAt: statusEventDate,
                });
            }
            plantStatus = nextPlantStatus ?? plantStatus;
            if (hasAssignedUserIdUpdate) {
                const nextAssignedUserId = extractAssignedUserId(
                    data?.assignedUserId,
                );
                assignedUserId = nextAssignedUserId;
                assignedUserIds = undefined;
                if (nextAssignedUserId === null) {
                    assignedBy = null;
                    assignedAt = undefined;
                    shouldApplyAssignedBy = false;
                } else {
                    assignedAt = plantCycleEvent.createdAt;
                }
            }
            if (
                shouldApplyAssignedUsers &&
                Array.isArray(data?.assignedUserIds)
            ) {
                const eventAssignedUserId = extractAssignedUserId(
                    data?.assignedUserId,
                );
                assignedUserIds = normalizeAssignedUserIds(
                    data.assignedUserIds.filter(
                        (value): value is string => typeof value === 'string',
                    ),
                    eventAssignedUserId,
                );
                assignedUserId = assignedUserIds[0] ?? null;
                if (assignedUserIds.length === 0) {
                    assignedBy = null;
                    assignedAt = undefined;
                    shouldApplyAssignedBy = false;
                } else {
                    assignedAt = plantCycleEvent.createdAt;
                }
            }
            if (shouldApplyAssignedBy && typeof data?.assignedBy === 'string') {
                assignedBy = data.assignedBy;
            }

            if (plantStatus === 'new' || plantStatus === 'planned') {
                active = true;
                toBeRemoved = false;
                stoppedDate = undefined;
                plantSowDate = undefined;
                plantGrowthDate = undefined;
                plantReadyDate = undefined;
                plantDeadDate = undefined;
                plantHarvestedDate = undefined;
                plantRemovedDate = undefined;
            } else if (
                plantStatus === 'pendingVerification' ||
                plantStatus === 'sowed'
            ) {
                plantSowDate = plantSowDate ?? statusEventDate;
            } else if (plantStatus === 'sprouted') {
                plantGrowthDate = statusEventDate;
            } else if (plantStatus === 'notSprouted') {
                plantDeadDate = statusEventDate;
                stoppedDate = statusEventDate;
                toBeRemoved = true;
            } else if (plantStatus === 'died') {
                plantDeadDate = statusEventDate;
                stoppedDate = statusEventDate;
            } else if (plantStatus === 'firstFlowers') {
                plantGrowthDate = plantGrowthDate ?? statusEventDate;
            } else if (plantStatus === 'firstFruitSet') {
                plantGrowthDate = plantGrowthDate ?? statusEventDate;
            } else if (plantStatus === 'ready') {
                plantReadyDate = statusEventDate;
            } else if (plantStatus === 'harvested') {
                plantHarvestedDate = statusEventDate;
                stoppedDate = statusEventDate;
            } else if (plantStatus === 'removed') {
                plantRemovedDate = statusEventDate;
                active = false;
                stoppedDate = statusEventDate;
            }
            continue;
        }

        if (plantCycleEvent.type === knownEventTypes.raisedBedFields.delete) {
            const statusEventDate = plantCycleEvent.createdAt;
            plantStatus = 'deleted';
            active = false;
            toBeRemoved = true;
            stoppedDate = statusEventDate;
            cancellationReason =
                typeof data?.reason === 'string' ? data.reason : undefined;
        }
    }

    const lastPlantCycleEvent = plantCycleEvents[plantCycleEvents.length - 1];
    const endedAt = lastPlantCycleEvent?.createdAt ?? plantPlaceEvent.createdAt;
    const endedEventId = lastPlantCycleEvent?.id ?? plantPlaceEvent.id;

    return {
        aggregateId,
        positionIndex,
        plantPlaceEventId: plantPlaceEvent.id,
        eventIds: plantCycleEvents.map((plantCycleEvent) => plantCycleEvent.id),
        startedAt: plantPlaceEvent.createdAt,
        endedAt,
        endedEventId,
        active,
        plantStatus,
        plantSortId,
        plantScheduledDate,
        sowingLocation,
        plantSowDate,
        plantGrowthDate,
        plantReadyDate,
        plantDeadDate,
        plantHarvestedDate,
        plantRemovedDate,
        statusChanges,
        stoppedDate,
        toBeRemoved,
        assignedUserIds: normalizeAssignedUserIds(
            assignedUserIds,
            assignedUserId,
        ),
        assignedUserId,
        assignedBy,
        assignedAt,
        cancellationReason,
    };
}

function summarizePlantCycles(
    aggregateId: string,
    positionIndex: number,
    plantEvents: RaisedBedFieldPlantCycleEvent[],
) {
    return splitPlantCycleEvents(plantEvents)
        .map((plantCycleEvents) =>
            summarizePlantCycle(aggregateId, positionIndex, plantCycleEvents),
        )
        .filter((plantCycle): plantCycle is RaisedBedFieldPlantCycle =>
            Boolean(plantCycle),
        );
}

function eventDataRecord(event: RaisedBedFieldPlantCycleEvent) {
    return event.data && typeof event.data === 'object'
        ? (event.data as Record<string, unknown>)
        : {};
}

function effectiveEventDate(data: Record<string, unknown>, fallbackDate: Date) {
    if (typeof data.effectiveDate !== 'string') {
        return fallbackDate;
    }

    const date = new Date(data.effectiveDate);
    return Number.isNaN(date.getTime()) ? fallbackDate : date;
}

function plantUpdateEventStatus(event: RaisedBedFieldPlantCycleEvent) {
    const data = eventDataRecord(event);

    return event.type === knownEventTypes.raisedBedFields.plantUpdate &&
        typeof data.status === 'string'
        ? data.status
        : undefined;
}

function comparePlantCycleEventOrder(
    left: Pick<RaisedBedFieldPlantCycleEvent, 'createdAt' | 'id'>,
    right: Pick<RaisedBedFieldPlantCycleEvent, 'createdAt' | 'id'>,
) {
    const timestampDifference =
        left.createdAt.getTime() - right.createdAt.getTime();
    if (timestampDifference !== 0) {
        return timestampDifference;
    }

    return left.id - right.id;
}

function wouldKeepPlantCycleEventOrder({
    plantCycleEvents,
    targetEvent,
    createdAt,
}: {
    plantCycleEvents: RaisedBedFieldPlantCycleEvent[];
    targetEvent: RaisedBedFieldPlantCycleEvent;
    createdAt: Date;
}) {
    const targetIndex = plantCycleEvents.findIndex(
        (event) => event.id === targetEvent.id,
    );
    if (targetIndex < 0) {
        return false;
    }

    const proposedEventOrder = {
        createdAt,
        id: targetEvent.id,
    };
    const previousEvent = plantCycleEvents[targetIndex - 1];
    const nextEvent = plantCycleEvents[targetIndex + 1];

    return (
        (!previousEvent ||
            comparePlantCycleEventOrder(proposedEventOrder, previousEvent) >=
                0) &&
        (!nextEvent ||
            comparePlantCycleEventOrder(proposedEventOrder, nextEvent) <= 0)
    );
}

export async function updateActiveRaisedBedFieldPlantStatusEventCreatedAt({
    raisedBedId,
    positionIndex,
    status,
    createdAt,
}: {
    raisedBedId: number;
    positionIndex: number;
    status: string;
    createdAt: Date;
}) {
    const aggregateId = `${raisedBedId.toString()}|${positionIndex.toString()}`;
    const plantEvents = await getAllEvents(
        [...PLANT_CYCLE_EVENT_TYPES],
        [aggregateId],
    );
    const activePlantCycleEvents = splitPlantCycleEvents(plantEvents).find(
        (plantCycleEvents) => {
            const plantCycle = summarizePlantCycle(
                aggregateId,
                positionIndex,
                plantCycleEvents,
            );

            return plantCycle?.active && plantCycle.plantStatus === status;
        },
    );
    const targetEvent =
        status === 'new'
            ? activePlantCycleEvents?.find(
                  (event) =>
                      event.type === knownEventTypes.raisedBedFields.plantPlace,
              )
            : activePlantCycleEvents
              ? [...activePlantCycleEvents]
                    .reverse()
                    .find((event) => plantUpdateEventStatus(event) === status)
              : undefined;

    if (!activePlantCycleEvents || !targetEvent) {
        return false;
    }

    if (
        !wouldKeepPlantCycleEventOrder({
            plantCycleEvents: activePlantCycleEvents,
            targetEvent,
            createdAt,
        })
    ) {
        return false;
    }

    await updateEventCreatedAt(targetEvent.id, createdAt);
    return true;
}

function plantCyclesOverlap(
    sourcePlantCycle: Pick<
        RaisedBedFieldPlantCycle,
        'startedAt' | 'endedAt' | 'plantPlaceEventId' | 'endedEventId'
    >,
    targetPlantCycle: Pick<
        RaisedBedFieldPlantCycle,
        'startedAt' | 'endedAt' | 'plantPlaceEventId' | 'endedEventId'
    >,
) {
    const compareEventBoundaries = (
        left: { createdAt: Date; eventId: number },
        right: { createdAt: Date; eventId: number },
    ) => {
        return comparePlantCycleEventOrder(
            { createdAt: left.createdAt, id: left.eventId },
            { createdAt: right.createdAt, id: right.eventId },
        );
    };

    return (
        compareEventBoundaries(
            {
                createdAt: sourcePlantCycle.startedAt,
                eventId: sourcePlantCycle.plantPlaceEventId,
            },
            {
                createdAt: targetPlantCycle.endedAt,
                eventId: targetPlantCycle.endedEventId,
            },
        ) <= 0 &&
        compareEventBoundaries(
            {
                createdAt: targetPlantCycle.startedAt,
                eventId: targetPlantCycle.plantPlaceEventId,
            },
            {
                createdAt: sourcePlantCycle.endedAt,
                eventId: sourcePlantCycle.endedEventId,
            },
        ) <= 0
    );
}

async function getPlantCyclesForPosition(
    tx: ReturnType<typeof storage>,
    raisedBedId: number,
    positionIndex: number,
) {
    const aggregateId = `${raisedBedId.toString()}|${positionIndex.toString()}`;
    const plantEvents = await tx.query.events.findMany({
        where: and(
            eq(events.aggregateId, aggregateId),
            inArray(events.type, [...PLANT_CYCLE_EVENT_TYPES]),
        ),
        orderBy: [asc(events.createdAt), asc(events.id)],
    });

    return summarizePlantCycles(aggregateId, positionIndex, plantEvents);
}

function buildWeedStatePayload({
    level,
    notes,
    observedAt,
    source,
}: {
    level: RaisedBedWeedStateLevel;
    notes?: string | null;
    observedAt?: Date;
    source: RaisedBedWeedStateSource;
}): RaisedBedWeedStateSetPayload {
    return {
        level,
        source,
        observedAt: (observedAt ?? new Date()).toISOString(),
        ...(notes ? { notes } : {}),
    };
}

export async function setRaisedBedFieldWeedState({
    level,
    notes,
    observedAt,
    positionIndex,
    raisedBedId,
    source = 'admin',
}: {
    level: RaisedBedWeedStateLevel;
    notes?: string | null;
    observedAt?: Date;
    positionIndex: number;
    raisedBedId: number;
    source?: RaisedBedWeedStateSource;
}) {
    if (!Number.isInteger(positionIndex) || positionIndex < 0) {
        throw new Error('Field position must be zero or greater.');
    }

    const raisedBed = await storage().query.raisedBeds.findFirst({
        where: and(
            eq(raisedBeds.id, raisedBedId),
            eq(raisedBeds.isDeleted, false),
        ),
    });
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    await upsertRaisedBedField({ raisedBedId, positionIndex });
    return createEvent(
        knownEvents.raisedBedFields.weedStateSetV1(
            `${raisedBedId.toString()}|${positionIndex.toString()}`,
            buildWeedStatePayload({ level, notes, observedAt, source }),
        ),
    );
}

export async function getRaisedBedFieldPlantCycles(raisedBedId: number) {
    const fields = await storage().query.raisedBedFields.findMany({
        where: and(
            eq(raisedBedFields.raisedBedId, raisedBedId),
            eq(raisedBedFields.isDeleted, false),
        ),
    });

    const positionIndices = Array.from(
        new Set(fields.map((field) => field.positionIndex)),
    ).sort((left, right) => left - right);
    if (positionIndices.length === 0) {
        return [];
    }

    const aggregateIds = positionIndices.map(
        (positionIndex) =>
            `${raisedBedId.toString()}|${positionIndex.toString()}`,
    );
    const plantEvents = await getAllEvents(
        [...PLANT_CYCLE_EVENT_TYPES],
        aggregateIds,
    );

    const plantEventsByAggregateId = new Map<
        string,
        RaisedBedFieldPlantCycleEvent[]
    >();
    for (const plantEvent of plantEvents) {
        const aggregateEvents = plantEventsByAggregateId.get(
            plantEvent.aggregateId,
        );
        if (aggregateEvents) {
            aggregateEvents.push(plantEvent);
        } else {
            plantEventsByAggregateId.set(plantEvent.aggregateId, [plantEvent]);
        }
    }

    return positionIndices.flatMap((positionIndex) => {
        const aggregateId = `${raisedBedId.toString()}|${positionIndex.toString()}`;
        return summarizePlantCycles(
            aggregateId,
            positionIndex,
            plantEventsByAggregateId.get(aggregateId) ?? [],
        );
    });
}

function reduceRaisedBedFieldWithEvents(
    field: SelectRaisedBedField,
    eventsForAggregate: RaisedBedFieldPlantCycleEvent[],
) {
    const aggregateId = `${field.raisedBedId}|${field.positionIndex}`;
    const events = eventsForAggregate;

    // Reduce events to get latest status, plant info, etc.
    let plantStatus: string | undefined;
    let plantSortId: number | undefined;
    let plantScheduledDate: Date | undefined;
    let sowingLocation: RaisedBedFieldSowingLocation = 'direct';
    let plantSowDate: Date | undefined;
    let plantGrowthDate: Date | undefined;
    let plantReadyDate: Date | undefined;
    let plantDeadDate: Date | undefined;
    let plantHarvestedDate: Date | undefined;
    let plantRemovedDate: Date | undefined;
    let active = true;
    let toBeRemoved = false;
    let stoppedDate: Date | undefined;
    let assignedUserId: string | null | undefined;
    let assignedUserIds: string[] | undefined;
    let assignedBy: string | null | undefined;
    let assignedAt: Date | undefined;
    let weedState: RaisedBedWeedState | null = null;
    let cancellationReason: string | undefined;

    for (const event of events) {
        const data = event.data as Record<string, unknown> | undefined;
        // Handle plant placement event
        if (event.type === knownEventTypes.raisedBedFields.plantPlace) {
            // A field can be replanted after it was removed, so a new placement
            // must restart the lifecycle instead of inheriting the previous one.
            active = true;
            toBeRemoved = false;
            stoppedDate = undefined;
            plantStatus = 'new';
            plantSortId = undefined;
            sowingLocation = 'direct';
            plantScheduledDate = undefined;
            plantSowDate = undefined;
            plantGrowthDate = undefined;
            plantReadyDate = undefined;
            plantDeadDate = undefined;
            plantHarvestedDate = undefined;
            plantRemovedDate = undefined;
            assignedUserId = undefined;
            assignedUserIds = undefined;
            assignedBy = undefined;
            assignedAt = undefined;
            cancellationReason = undefined;

            // Parse plant sort ID if provided
            if (typeof data?.plantSortId === 'number') {
                plantSortId = data.plantSortId;
            } else if (typeof data?.plantSortId === 'string') {
                plantSortId = parseInt(data.plantSortId, 10);
            } else {
                console.error('Invalid raised bed field plant sort ID', {
                    eventId: event.id,
                    fieldId: field.id,
                    plantSortId: data?.plantSortId,
                    positionIndex: field.positionIndex,
                    raisedBedId: field.raisedBedId,
                });
            }
            sowingLocation =
                parseSowingLocation(data?.sowingLocation) ?? 'direct';

            // Parse scheduled date if provided
            if (data?.scheduledDate && typeof data.scheduledDate === 'string') {
                plantScheduledDate = new Date(data.scheduledDate);
            } else if (
                data?.scheduledDate &&
                typeof data.scheduledDate === 'object' &&
                data?.scheduledDate instanceof Date
            ) {
                plantScheduledDate = data?.scheduledDate;
            }
        }
        // Handle plant schedule update event
        else if (event.type === knownEventTypes.raisedBedFields.plantSchedule) {
            if (data?.scheduledDate && typeof data.scheduledDate === 'string') {
                plantScheduledDate = new Date(data.scheduledDate);
            } else if (
                data?.scheduledDate &&
                typeof data.scheduledDate === 'object' &&
                data?.scheduledDate instanceof Date
            ) {
                plantScheduledDate = data?.scheduledDate;
            } else if (data?.scheduledDate == null) {
                plantScheduledDate = undefined;
            }
            sowingLocation =
                parseSowingLocation(data?.sowingLocation) ?? sowingLocation;
        }
        // Handle plant status update event
        else if (event.type === knownEventTypes.raisedBedFields.plantUpdate) {
            const statusEventDate = effectiveEventDate(
                data ?? {},
                event.createdAt,
            );
            let shouldApplyAssignedBy = true;
            const shouldApplyAssignedUsers = isAssignmentEvent(data ?? {});
            const hasAssignedUserIdUpdate =
                shouldApplyAssignedUsers &&
                extractAssignedUserId(data?.assignedUserId) !== undefined;
            plantStatus =
                typeof data?.status === 'string' ? data?.status : plantStatus;
            if (hasAssignedUserIdUpdate) {
                const nextAssignedUserId = extractAssignedUserId(
                    data?.assignedUserId,
                );
                assignedUserId = nextAssignedUserId;
                assignedUserIds = undefined;
                if (nextAssignedUserId === null) {
                    assignedBy = null;
                    assignedAt = undefined;
                    shouldApplyAssignedBy = false;
                } else {
                    assignedAt = event.createdAt;
                }
            }
            if (
                shouldApplyAssignedUsers &&
                Array.isArray(data?.assignedUserIds)
            ) {
                const eventAssignedUserId = extractAssignedUserId(
                    data?.assignedUserId,
                );
                assignedUserIds = normalizeAssignedUserIds(
                    data.assignedUserIds.filter(
                        (value): value is string => typeof value === 'string',
                    ),
                    eventAssignedUserId,
                );
                assignedUserId = assignedUserIds[0] ?? null;
                if (assignedUserIds.length === 0) {
                    assignedBy = null;
                    assignedAt = undefined;
                    shouldApplyAssignedBy = false;
                } else {
                    assignedAt = event.createdAt;
                }
            }
            if (shouldApplyAssignedBy && typeof data?.assignedBy === 'string') {
                assignedBy = data.assignedBy;
            }
            if (plantStatus === 'new' || plantStatus === 'planned') {
                active = true;
                toBeRemoved = false;
                stoppedDate = undefined;
                plantSowDate = undefined;
                plantGrowthDate = undefined;
                plantReadyDate = undefined;
                plantDeadDate = undefined;
                plantHarvestedDate = undefined;
                plantRemovedDate = undefined;
            } else if (
                plantStatus === 'pendingVerification' ||
                plantStatus === 'sowed'
            ) {
                plantSowDate = plantSowDate ?? statusEventDate;
            } else if (plantStatus === 'sprouted') {
                plantGrowthDate = statusEventDate;
            } else if (plantStatus === 'notSprouted') {
                plantDeadDate = statusEventDate;
                stoppedDate = statusEventDate;
                toBeRemoved = true;
            } else if (plantStatus === 'died') {
                plantDeadDate = statusEventDate;
                stoppedDate = statusEventDate;
            } else if (plantStatus === 'firstFlowers') {
                plantGrowthDate = plantGrowthDate ?? statusEventDate;
            } else if (plantStatus === 'firstFruitSet') {
                plantGrowthDate = plantGrowthDate ?? statusEventDate;
            } else if (plantStatus === 'ready') {
                plantReadyDate = statusEventDate;
            } else if (plantStatus === 'harvested') {
                plantHarvestedDate = statusEventDate;
                stoppedDate = statusEventDate;
            } else if (plantStatus === 'removed') {
                plantRemovedDate = statusEventDate;
                active = false;
                stoppedDate = statusEventDate;
            }
        }
        // Handle plant sort replace event
        else if (
            event.type === knownEventTypes.raisedBedFields.plantReplaceSort
        ) {
            if (data?.plantSortId && typeof data.plantSortId === 'string') {
                plantSortId = parseInt(data.plantSortId, 10);
            }
        }
        // Handle weed state updates
        else if (event.type === knownEventTypes.raisedBedFields.weedStateSet) {
            weedState = weedStateFromEvent(event) ?? weedState;
        }
        // Handle field deletion event
        else if (event.type === knownEventTypes.raisedBedFields.delete) {
            plantStatus = 'deleted';
            plantSowDate = undefined;
            plantSortId = undefined;
            plantScheduledDate = undefined;
            active = false;
            stoppedDate = event.createdAt;
            cancellationReason =
                typeof data?.reason === 'string' ? data.reason : undefined;
        } else {
            console.warn('Unhandled raised bed field event type', {
                eventId: event.id,
                eventType: event.type,
                fieldId: field.id,
                positionIndex: field.positionIndex,
                raisedBedId: field.raisedBedId,
            });
        }
    }

    return {
        ...field,
        plantCycles: summarizePlantCycles(
            aggregateId,
            field.positionIndex,
            events.filter((event) =>
                PLANT_CYCLE_EVENT_TYPE_SET.has(event.type),
            ),
        ),
        plantStatus,
        plantSortId,
        plantScheduledDate,
        sowingLocation,
        plantSowDate,
        plantGrowthDate,
        plantReadyDate,
        plantDeadDate,
        plantHarvestedDate,
        plantRemovedDate,
        active,
        toBeRemoved,
        stoppedDate,
        assignedUserIds: normalizeAssignedUserIds(
            assignedUserIds,
            assignedUserId,
        ),
        assignedUserId,
        assignedBy,
        assignedAt,
        cancellationReason,
        weedState,
    };
}

export type RaisedBedFieldWithEvents = ReturnType<
    typeof reduceRaisedBedFieldWithEvents
>;

function groupRaisedBedFieldEventsByAggregateId(
    fieldEvents: RaisedBedFieldPlantCycleEvent[],
) {
    const fieldEventsByAggregateId = new Map<
        string,
        RaisedBedFieldPlantCycleEvent[]
    >();

    for (const event of fieldEvents) {
        const aggregateEvents = fieldEventsByAggregateId.get(event.aggregateId);
        if (aggregateEvents) {
            aggregateEvents.push(event);
        } else {
            fieldEventsByAggregateId.set(event.aggregateId, [event]);
        }
    }

    return fieldEventsByAggregateId;
}

export async function getRaisedBedFieldsWithEventsForBeds(
    raisedBedIds: number[],
): Promise<Map<number, RaisedBedFieldWithEvents[]>> {
    const uniqueRaisedBedIds = Array.from(new Set(raisedBedIds));
    const fieldsByRaisedBedId = new Map<number, RaisedBedFieldWithEvents[]>();

    for (const raisedBedId of uniqueRaisedBedIds) {
        fieldsByRaisedBedId.set(raisedBedId, []);
    }

    if (uniqueRaisedBedIds.length === 0) {
        return fieldsByRaisedBedId;
    }

    const fields = await storage().query.raisedBedFields.findMany({
        where: and(
            inArray(raisedBedFields.raisedBedId, uniqueRaisedBedIds),
            eq(raisedBedFields.isDeleted, false),
        ),
    });

    const fieldAggregateIds = Array.from(
        new Set(
            fields.map(
                (field) => `${field.raisedBedId}|${field.positionIndex}`,
            ),
        ),
    );
    let fieldsEvents: RaisedBedFieldPlantCycleEvent[] = [];
    if (fieldAggregateIds.length > 0) {
        fieldsEvents = await getAllEvents(
            [...RAISED_BED_FIELD_EVENT_TYPES],
            fieldAggregateIds,
        );
    }

    const fieldsEventsByAggregateId =
        groupRaisedBedFieldEventsByAggregateId(fieldsEvents);

    for (const field of fields) {
        const aggregateId = `${field.raisedBedId}|${field.positionIndex}`;
        const reducedField = reduceRaisedBedFieldWithEvents(
            field,
            fieldsEventsByAggregateId.get(aggregateId) ?? [],
        );
        const raisedBedFields = fieldsByRaisedBedId.get(field.raisedBedId);
        if (raisedBedFields) {
            raisedBedFields.push(reducedField);
        } else {
            fieldsByRaisedBedId.set(field.raisedBedId, [reducedField]);
        }
    }

    return fieldsByRaisedBedId;
}

// New: Retrieve all raised bed fields for a single raised bed, with event-sourced info
export async function getRaisedBedFieldsWithEvents(raisedBedId: number) {
    return (
        (await getRaisedBedFieldsWithEventsForBeds([raisedBedId])).get(
            raisedBedId,
        ) ?? []
    );
}

export async function upsertRaisedBedField(
    field: Omit<
        InsertRaisedBedField,
        'id' | 'createdAt' | 'updatedAt' | 'isDeleted'
    >,
) {
    await storage().transaction(async (tx) => {
        await syncRaisedBedFieldRow(tx, field);
    });
    await bustScheduleCache();
}

export async function moveRaisedBedFieldPlantHistory({
    raisedBedId,
    sourcePositionIndex,
    targetPositionIndex,
    sourcePlantPlaceEventId,
}: {
    raisedBedId: number;
    sourcePositionIndex: number;
    targetPositionIndex: number;
    sourcePlantPlaceEventId: number;
}) {
    if (sourcePositionIndex === targetPositionIndex) {
        throw new Error('Source and target field positions must be different');
    }

    if (sourcePositionIndex < 0 || targetPositionIndex < 0) {
        throw new Error('Field positions must be zero or greater');
    }

    const sourceAggregateId = `${raisedBedId.toString()}|${sourcePositionIndex.toString()}`;
    const targetAggregateId = `${raisedBedId.toString()}|${targetPositionIndex.toString()}`;

    const result = await storage().transaction(async (tx) => {
        const sourceFieldRows = await getRaisedBedFieldRowsAtPosition(
            tx,
            raisedBedId,
            sourcePositionIndex,
        );
        if (sourceFieldRows.length === 0) {
            throw new Error(
                `Source field ${sourcePositionIndex} not found in raised bed ${raisedBedId}`,
            );
        }

        await syncRaisedBedFieldRow(tx, {
            raisedBedId,
            positionIndex: sourcePositionIndex,
        });
        await syncRaisedBedFieldRow(tx, {
            raisedBedId,
            positionIndex: targetPositionIndex,
        });

        const [sourcePlantCycles, targetPlantCycles] = await Promise.all([
            getPlantCyclesForPosition(tx, raisedBedId, sourcePositionIndex),
            getPlantCyclesForPosition(tx, raisedBedId, targetPositionIndex),
        ]);

        const sourcePlantCycle = sourcePlantCycles.find(
            (plantCycle) =>
                plantCycle.plantPlaceEventId === sourcePlantPlaceEventId,
        );
        if (!sourcePlantCycle) {
            throw new Error('Selected source plant history was not found');
        }

        const overlappingTargetPlantCycles = targetPlantCycles.filter(
            (targetPlantCycle) =>
                plantCyclesOverlap(sourcePlantCycle, targetPlantCycle),
        );
        const shouldSwap = overlappingTargetPlantCycles.length > 0;

        const sourcePlantCycleEventIds = sourcePlantCycle.eventIds;
        const targetPlantCycleEventIds = overlappingTargetPlantCycles.flatMap(
            (targetPlantCycle) => targetPlantCycle.eventIds,
        );

        await tx
            .update(events)
            .set({
                aggregateId: targetAggregateId,
            })
            .where(inArray(events.id, sourcePlantCycleEventIds));

        if (shouldSwap) {
            await tx
                .update(events)
                .set({
                    aggregateId: sourceAggregateId,
                })
                .where(inArray(events.id, targetPlantCycleEventIds));
        }

        return {
            swapped: shouldSwap,
        };
    });
    await bustScheduleCache();
    return result;
}

export async function deleteRaisedBedField(
    raisedBedId: number,
    positionIndex: number,
    options: { preserveHistory?: boolean } = {},
) {
    await storage()
        .update(raisedBedFields)
        .set(
            options.preserveHistory
                ? { updatedAt: new Date() }
                : { isDeleted: true },
        )
        .where(
            and(
                eq(raisedBedFields.raisedBedId, raisedBedId),
                eq(raisedBedFields.positionIndex, positionIndex),
                eq(raisedBedFields.isDeleted, false),
            ),
        );
    await bustScheduleCache();
}
