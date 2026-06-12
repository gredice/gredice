import 'server-only';
import { plantFieldStatusLabel } from '@gredice/js/plants';
import { and, asc, count, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { v4 as uuidV4 } from 'uuid';
import { getEntitiesFormatted, getOperations, storage } from '..';
import type { EntityStandardized } from '../@types/EntityStandardized';
import {
    bustScheduleCache,
    cacheScheduleRead,
    scheduleCacheKeys,
    scheduleCacheTtls,
} from '../cache/scheduleCache';
import { generateRaisedBedName } from '../helpers/generateRaisedBedName';
import {
    events,
    farmUsers,
    gardenBlocks,
    gardenStacks,
    gardens,
    type InsertGarden,
    type InsertRaisedBed,
    notifications,
    operations,
    type RaisedBedOrientation,
    raisedBeds,
    shoppingCartItems,
    type UpdateGarden,
    type UpdateGardenBlock,
    type UpdateGardenStack,
    type UpdateRaisedBed,
    users,
} from '../schema';
import {
    type InsertRaisedBedField,
    type InsertRaisedBedSensor,
    raisedBedFields,
    raisedBedSensors,
    type SelectRaisedBedField,
    type UpdateRaisedBedSensor,
} from '../schema/gardenSchema';
import { normalizeAssignedUserIds } from './events/normalizeAssignedUserIds';
import {
    createEvent,
    getEvents,
    knownEvents,
    knownEventTypes,
    type RaisedBedFieldSowingLocation,
    type RaisedBedWeedStateLevel,
    type RaisedBedWeedStateSetPayload,
    type RaisedBedWeedStateSource,
    updateEventCreatedAt,
} from './eventsRepo';
import { getFarms } from './farmsRepo';
import { processReferralRewardsForAccount } from './referralsRepo';

const RAISED_BED_FIELDS_PER_BLOCK = 9;
const PLANT_CYCLE_EVENT_TYPES = [
    knownEventTypes.raisedBedFields.plantPlace,
    knownEventTypes.raisedBedFields.plantSchedule,
    knownEventTypes.raisedBedFields.plantUpdate,
    knownEventTypes.raisedBedFields.plantReplaceSort,
] as const;

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = TransactionClient | StorageClient;

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

async function normalizeRaisedBedFieldsForMerge(
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

function latestWeedStateFromEvents(
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
    const plantEvents = await getEvents(
        [...PLANT_CYCLE_EVENT_TYPES],
        [aggregateId],
        0,
        100000,
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

export async function createGarden(garden: InsertGarden) {
    const createdGarden = (
        await storage().insert(gardens).values(garden).returning({
            id: gardens.id,
            name: gardens.name,
            accountId: gardens.accountId,
        })
    )[0];
    if (!createdGarden) {
        throw new Error('Failed to create garden');
    }

    await createEvent(
        knownEvents.gardens.createdV1(createdGarden.id.toString(), {
            name: createdGarden.name,
            accountId: createdGarden.accountId,
        }),
    );
    await bustScheduleCache();

    return createdGarden.id;
}

type CreateDefaultGardenOptions = {
    accountId: string;
    name?: string;
};

export async function createDefaultGardenForAccount({
    accountId,
    name,
}: CreateDefaultGardenOptions) {
    const farms = await getFarms();
    const farm = farms.find((f) => !f.isDeleted);
    if (!farm) {
        throw new Error('No farm found');
    }

    const trimmedName = name?.trim();
    const gardenId = await createGarden({
        farmId: farm.id,
        accountId,
        name: trimmedName || 'Moj vrt',
    });

    // Assign 4x3 grid of grass blocks with origin-centered coordinates and two raised beds near the center
    // Grid: x = -1..2, y = -1..1
    // Raised beds are placed at coordinates (0,0) and (1,0)
    for (let x = -1; x < 3; x++) {
        for (let y = -1; y < 2; y++) {
            // Create base block
            const blockId = await createGardenBlock(gardenId, 'Block_Grass');

            // Create stack if not exists
            await createGardenStack(gardenId, { x, y });

            const blockIds = [blockId];
            if ((x === 0 && y === 0) || (x === 1 && y === 0)) {
                const raisedBedBlockId = await createGardenBlock(
                    gardenId,
                    'Raised_Bed',
                );
                await createRaisedBed({
                    accountId,
                    gardenId,
                    blockId: raisedBedBlockId,
                    status: 'new',
                });
                blockIds.push(raisedBedBlockId);
            }

            // Assign block to stack
            await updateGardenStack(gardenId, { x, y, blocks: blockIds });
        }
    }

    return gardenId;
}

export {
    clearSandboxField,
    createSandboxGarden,
    type DeleteSandboxGardenCompletelyOptions,
    type DeleteSandboxGardenCompletelyResult,
    deleteSandboxGardenCompletely,
    getSandboxGardenDeletionCandidate,
    sowSandboxField,
} from './gardenSandboxRepo';

export async function getGardens() {
    return storage().query.gardens.findMany({
        orderBy: desc(gardens.createdAt),
    });
}

export async function getAccountGardensMetadata(accountId: string) {
    return storage().query.gardens.findMany({
        where: and(
            eq(gardens.accountId, accountId),
            eq(gardens.isDeleted, false),
        ),
    });
}

export async function getAccountGardens(
    accountId: string,
    filter?: {
        status?: string;
    },
) {
    const accountGardens = await storage().query.gardens.findMany({
        where: and(
            eq(gardens.accountId, accountId),
            eq(gardens.isDeleted, false),
        ),
    });
    // For each raised bed, fetch and attach fields with event-sourced info
    return Promise.all(
        accountGardens.map(async (garden) => {
            return {
                ...garden,
                raisedBeds: await getRaisedBeds(garden.id, filter),
            };
        }),
    );
}

export async function getGarden(gardenId: number) {
    const [garden, raisedBeds] = await Promise.all([
        storage().query.gardens.findFirst({
            where: and(eq(gardens.id, gardenId), eq(gardens.isDeleted, false)),
            with: {
                farm: true,
                stacks: {
                    where: eq(gardenStacks.isDeleted, false),
                },
            },
        }),
        getRaisedBeds(gardenId),
    ]);
    if (!garden) {
        return null;
    }
    // Attach raised beds with event-sourced info
    return {
        ...garden,
        raisedBeds,
    };
}

export async function updateGarden(garden: UpdateGarden) {
    await storage()
        .update(gardens)
        .set(garden)
        .where(eq(gardens.id, garden.id));

    if (garden.name) {
        await createEvent(
            knownEvents.gardens.renamedV1(garden.id.toString(), {
                name: garden.name,
            }),
        );
    }
    await bustScheduleCache();
}

export async function deleteGarden(gardenId: number) {
    await storage()
        .update(gardens)
        .set({ isDeleted: true })
        .where(eq(gardens.id, gardenId));
    await createEvent(knownEvents.gardens.deletedV1(gardenId.toString()));
    await bustScheduleCache();
}

export async function getGardenBlocks(gardenId: number) {
    return storage().query.gardenBlocks.findMany({
        where: and(
            eq(gardenBlocks.gardenId, gardenId),
            eq(gardenBlocks.isDeleted, false),
        ),
    });
}

export async function getGardenBoxBlocksForAccount(accountId: string) {
    return storage()
        .select({
            blockId: gardenBlocks.id,
            gardenId: gardenBlocks.gardenId,
            gardenName: gardens.name,
            createdAt: gardenBlocks.createdAt,
            updatedAt: gardenBlocks.updatedAt,
        })
        .from(gardenBlocks)
        .innerJoin(gardens, eq(gardenBlocks.gardenId, gardens.id))
        .where(
            and(
                eq(gardens.accountId, accountId),
                eq(gardens.isDeleted, false),
                eq(gardenBlocks.name, 'GardenBox'),
                eq(gardenBlocks.isDeleted, false),
            ),
        )
        .orderBy(asc(gardens.createdAt), asc(gardenBlocks.createdAt));
}

export async function getGardenBlock(gardenId: number, blockId: string) {
    return (
        (await storage().query.gardenBlocks.findFirst({
            where: and(
                eq(gardenBlocks.gardenId, gardenId),
                eq(gardenBlocks.id, blockId),
                eq(gardenBlocks.isDeleted, false),
            ),
        })) ?? null
    );
}

export async function createGardenBlock(
    gardenId: number,
    blockName: string,
    db: DatabaseClient = storage(),
) {
    const blockId = uuidV4();

    await Promise.all([
        db.insert(gardenBlocks).values({
            id: blockId,
            gardenId,
            name: blockName,
        }),
        createEvent(
            knownEvents.gardens.blockPlacedV1(gardenId.toString(), {
                id: blockId,
                name: blockName,
            }),
            db,
        ),
    ]);

    return blockId;
}

export async function updateGardenBlock({ id, ...values }: UpdateGardenBlock) {
    await storage()
        .update(gardenBlocks)
        .set({
            ...values,
        })
        .where(eq(gardenBlocks.id, id));
}

export async function deleteGardenBlock(
    gardenId: number,
    blockId: string,
    db: DatabaseClient = storage(),
) {
    await db
        .update(gardenBlocks)
        .set({ isDeleted: true })
        .where(
            and(
                eq(gardenBlocks.gardenId, gardenId),
                eq(gardenBlocks.id, blockId),
            ),
        );
    await createEvent(
        knownEvents.gardens.blockRemovedV1(gardenId.toString(), {
            id: blockId,
        }),
        db,
    );
}

export async function getGardenStacks(gardenId: number) {
    return storage().query.gardenStacks.findMany({
        where: and(
            eq(gardenStacks.gardenId, gardenId),
            eq(gardenStacks.isDeleted, false),
        ),
    });
}

export async function getGardenStack(
    gardenId: number,
    { x, y }: { x: number; y: number },
) {
    return (
        (await storage().query.gardenStacks.findFirst({
            where: and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.positionX, x),
                eq(gardenStacks.positionY, y),
                eq(gardenStacks.isDeleted, false),
            ),
        })) ?? null
    );
}

export async function getGardenStackForUpdate(
    gardenId: number,
    { x, y }: { x: number; y: number },
    db: DatabaseClient,
) {
    const [stack] = await db
        .select()
        .from(gardenStacks)
        .where(
            and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.positionX, x),
                eq(gardenStacks.positionY, y),
                eq(gardenStacks.isDeleted, false),
            ),
        )
        .for('update')
        .limit(1);

    return stack ?? null;
}

export async function createGardenStack(
    gardenId: number,
    { x, y }: { x: number; y: number },
    db: DatabaseClient = storage(),
) {
    // Check if an active (non-deleted) stack already exists at this location.
    const [{ count: existingStacksCount }] = await db
        .select({ count: count() })
        .from(gardenStacks)
        .where(
            and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.positionX, x),
                eq(gardenStacks.positionY, y),
                eq(gardenStacks.isDeleted, false),
            ),
        );
    if (existingStacksCount > 0) {
        return false;
    }

    // If a soft-deleted stack exists at this position, reuse it instead of
    // inserting a new row. This keeps a single canonical row per (gardenId, x, y)
    // and prevents soft-deleted duplicates from accumulating over time.
    const reusableStack = await db.query.gardenStacks.findFirst({
        where: and(
            eq(gardenStacks.gardenId, gardenId),
            eq(gardenStacks.positionX, x),
            eq(gardenStacks.positionY, y),
            eq(gardenStacks.isDeleted, true),
        ),
        orderBy: desc(gardenStacks.id),
    });
    if (reusableStack) {
        await db
            .update(gardenStacks)
            .set({ isDeleted: false, blocks: [] })
            .where(eq(gardenStacks.id, reusableStack.id));
        return true;
    }

    await db
        .insert(gardenStacks)
        .values({ gardenId, positionX: x, positionY: y });
    return true;
}

export async function updateGardenStack(
    gardenId: number,
    stacks: Omit<UpdateGardenStack, 'id'> & { x: number; y: number },
    db: DatabaseClient = storage(),
) {
    const stackId = (
        await db.query.gardenStacks.findFirst({
            where: and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.positionX, stacks.x),
                eq(gardenStacks.positionY, stacks.y),
                eq(gardenStacks.isDeleted, false),
            ),
        })
    )?.id;
    if (!stackId) {
        console.warn(
            `Stack not found for gardenId:${gardenId} at position x:${stacks.x} y:${stacks.y}`,
        );
        throw new Error('Stack not found');
    }

    await db
        .update(gardenStacks)
        .set({
            blocks: stacks.blocks,
        })
        .where(
            and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.id, stackId),
                eq(gardenStacks.isDeleted, false),
            ),
        );
}

export async function deleteGardenStack(
    gardenId: number,
    { x, y }: { x: number; y: number },
) {
    await storage()
        .update(gardenStacks)
        .set({ isDeleted: true })
        .where(
            and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.positionX, x),
                eq(gardenStacks.positionY, y),
            ),
        );
}

export async function deleteGardenStacks(gardenId: number) {
    await storage()
        .update(gardenStacks)
        .set({ isDeleted: true })
        .where(eq(gardenStacks.gardenId, gardenId));
}

export async function createRaisedBed(
    raisedBed: Omit<InsertRaisedBed, 'name'> & {
        orientation?: RaisedBedOrientation;
    },
) {
    const result = (
        await storage()
            .insert(raisedBeds)
            .values({
                ...raisedBed,
                orientation: raisedBed.orientation ?? 'vertical',
                name: generateRaisedBedName(),
            })
            .returning({ id: raisedBeds.id })
    )[0].id;
    await bustScheduleCache();
    return result;
}

export async function getRaisedBedIdsByAccount(accountId: string) {
    const beds = await storage().query.raisedBeds.findMany({
        columns: { id: true },
        where: and(
            eq(raisedBeds.accountId, accountId),
            eq(raisedBeds.isDeleted, false),
        ),
    });
    return beds.map((b) => b.id);
}

export async function countRaisedBedsByAccount(
    accountId: string,
    filters?: {
        status?: string;
    },
) {
    const whereConditions = [
        eq(raisedBeds.accountId, accountId),
        eq(raisedBeds.isDeleted, false),
    ];

    if (filters?.status) {
        whereConditions.push(eq(raisedBeds.status, filters.status));
    }

    const result = await storage()
        .select({ count: count() })
        .from(raisedBeds)
        .where(and(...whereConditions));

    return result[0]?.count ?? 0;
}

/**
 * Returns lightweight raised-bed label metadata for the provided IDs.
 * Duplicate IDs are ignored, deleted raised beds are excluded, and results are ordered by ID.
 */
export async function getRaisedBedMetadataByIds(raisedBedIds: number[]) {
    const uniqueRaisedBedIds = Array.from(new Set(raisedBedIds));
    if (uniqueRaisedBedIds.length === 0) {
        return [];
    }

    return storage()
        .select({
            id: raisedBeds.id,
            name: raisedBeds.name,
            physicalId: raisedBeds.physicalId,
        })
        .from(raisedBeds)
        .where(
            and(
                inArray(raisedBeds.id, uniqueRaisedBedIds),
                eq(raisedBeds.isDeleted, false),
            ),
        )
        .orderBy(asc(raisedBeds.id));
}

async function getRaisedBedWeedStatesByIds(raisedBedIds: number[]) {
    const uniqueRaisedBedIds = Array.from(new Set(raisedBedIds));
    const weedStatesByRaisedBedId = new Map<number, RaisedBedWeedState>();
    if (uniqueRaisedBedIds.length === 0) {
        return weedStatesByRaisedBedId;
    }

    const weedStateEvents = await getEvents(
        knownEventTypes.raisedBeds.weedStateSet,
        uniqueRaisedBedIds.map((raisedBedId) => raisedBedId.toString()),
        0,
        100000,
    );

    const eventsByRaisedBedId = new Map<
        number,
        RaisedBedFieldPlantCycleEvent[]
    >();
    for (const event of weedStateEvents) {
        const raisedBedId = Number(event.aggregateId);
        if (!Number.isInteger(raisedBedId)) {
            continue;
        }

        const raisedBedEvents = eventsByRaisedBedId.get(raisedBedId);
        if (raisedBedEvents) {
            raisedBedEvents.push(event);
        } else {
            eventsByRaisedBedId.set(raisedBedId, [event]);
        }
    }

    for (const [raisedBedId, events] of eventsByRaisedBedId) {
        const weedState = latestWeedStateFromEvents(events);
        if (weedState) {
            weedStatesByRaisedBedId.set(raisedBedId, weedState);
        }
    }

    return weedStatesByRaisedBedId;
}

export async function getRaisedBeds(
    gardenId: number,
    filters?: {
        status?: string;
    },
) {
    // Build where conditions
    const whereConditions = [
        eq(raisedBeds.gardenId, gardenId),
        eq(raisedBeds.isDeleted, false),
    ];

    if (filters?.status) {
        whereConditions.push(eq(raisedBeds.status, filters.status));
    }

    const beds = await storage().query.raisedBeds.findMany({
        where: and(...whereConditions),
    });
    const weedStatesByRaisedBedId = await getRaisedBedWeedStatesByIds(
        beds.map((bed) => bed.id),
    );

    // For each raised bed, fetch and attach fields with event-sourced info
    return Promise.all(
        beds.map(async (bed) => {
            const fields = await getRaisedBedFieldsWithEvents(bed.id);
            return {
                ...bed,
                fields,
                weedState: weedStatesByRaisedBedId.get(bed.id) ?? null,
            };
        }),
    );
}

export async function getRaisedBed(raisedBedId: number) {
    const [raisedBed, fields, weedStatesByRaisedBedId] = await Promise.all([
        storage().query.raisedBeds.findFirst({
            where: and(
                eq(raisedBeds.id, raisedBedId),
                eq(raisedBeds.isDeleted, false),
            ),
        }),
        getRaisedBedFieldsWithEvents(raisedBedId),
        getRaisedBedWeedStatesByIds([raisedBedId]),
    ]);
    if (!raisedBed) return null;
    // Attach raised bed fields with event-sourced info
    return {
        ...raisedBed,
        fields,
        weedState: weedStatesByRaisedBedId.get(raisedBed.id) ?? null,
    };
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

export async function setRaisedBedWeedState({
    level,
    notes,
    observedAt,
    raisedBedId,
    source = 'admin',
}: {
    level: RaisedBedWeedStateLevel;
    notes?: string | null;
    observedAt?: Date;
    raisedBedId: number;
    source?: RaisedBedWeedStateSource;
}) {
    const raisedBed = await storage().query.raisedBeds.findFirst({
        where: and(
            eq(raisedBeds.id, raisedBedId),
            eq(raisedBeds.isDeleted, false),
        ),
    });
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    return createEvent(
        knownEvents.raisedBeds.weedStateSetV1(
            raisedBedId.toString(),
            buildWeedStatePayload({ level, notes, observedAt, source }),
        ),
    );
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
    const plantEvents = await getEvents(
        [...PLANT_CYCLE_EVENT_TYPES],
        aggregateIds,
        0,
        100000,
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

// New: Retrieve all raised bed fields for a single raised bed, with event-sourced info
export async function getRaisedBedFieldsWithEvents(raisedBedId: number) {
    const fields = await storage().query.raisedBedFields.findMany({
        where: and(
            eq(raisedBedFields.raisedBedId, raisedBedId),
            eq(raisedBedFields.isDeleted, false),
        ),
    });

    // Retrieve all events in bulk
    const fieldAggregateIds = Array.from(
        new Set(
            fields.map(
                (field) => `${field.raisedBedId}|${field.positionIndex}`,
            ),
        ),
    );
    const fieldsEvents = await getEvents(
        [
            knownEventTypes.raisedBedFields.create,
            knownEventTypes.raisedBedFields.delete,
            knownEventTypes.raisedBedFields.plantPlace,
            knownEventTypes.raisedBedFields.plantSchedule,
            knownEventTypes.raisedBedFields.plantUpdate,
            knownEventTypes.raisedBedFields.plantReplaceSort,
            knownEventTypes.raisedBedFields.weedStateSet,
        ],
        fieldAggregateIds,
        0,
        100000,
    );
    const plantCycleEventsByAggregateId = new Map<
        string,
        RaisedBedFieldPlantCycleEvent[]
    >();
    const plantCycleEventTypes = new Set<string>(PLANT_CYCLE_EVENT_TYPES);
    for (const event of fieldsEvents) {
        if (!plantCycleEventTypes.has(event.type)) {
            continue;
        }

        const aggregateEvents = plantCycleEventsByAggregateId.get(
            event.aggregateId,
        );
        if (aggregateEvents) {
            aggregateEvents.push(event);
        } else {
            plantCycleEventsByAggregateId.set(event.aggregateId, [event]);
        }
    }

    const fieldsEventsByAggregateId = new Map<string, typeof fieldsEvents>();
    for (const event of fieldsEvents) {
        const aggregateEvents = fieldsEventsByAggregateId.get(
            event.aggregateId,
        );
        if (aggregateEvents) {
            aggregateEvents.push(event);
        } else {
            fieldsEventsByAggregateId.set(event.aggregateId, [event]);
        }
    }

    // For each field, fetch and apply events
    return fields.map((field) => {
        const aggregateId = `${field.raisedBedId}|${field.positionIndex}`;
        const events = fieldsEventsByAggregateId.get(aggregateId) ?? [];

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

                // Parse plant sort ID if provided
                if (typeof data?.plantSortId === 'number') {
                    plantSortId = data.plantSortId;
                } else if (typeof data?.plantSortId === 'string') {
                    plantSortId = parseInt(data.plantSortId, 10);
                } else {
                    console.error(
                        `Invalid plantSortId in event ${event.id} for field ${field.id}`,
                    );
                }
                sowingLocation =
                    parseSowingLocation(data?.sowingLocation) ?? 'direct';

                // Parse scheduled date if provided
                if (
                    data?.scheduledDate &&
                    typeof data.scheduledDate === 'string'
                ) {
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
            else if (
                event.type === knownEventTypes.raisedBedFields.plantSchedule
            ) {
                if (
                    data?.scheduledDate &&
                    typeof data.scheduledDate === 'string'
                ) {
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
            else if (
                event.type === knownEventTypes.raisedBedFields.plantUpdate
            ) {
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
                    typeof data?.status === 'string'
                        ? data?.status
                        : plantStatus;
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
                            (value): value is string =>
                                typeof value === 'string',
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
                if (
                    shouldApplyAssignedBy &&
                    typeof data?.assignedBy === 'string'
                ) {
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
            else if (
                event.type === knownEventTypes.raisedBedFields.weedStateSet
            ) {
                weedState = weedStateFromEvent(event) ?? weedState;
            }
            // Handle field deletion event
            else if (event.type === knownEventTypes.raisedBedFields.delete) {
                plantStatus = 'deleted';
                plantSowDate = undefined;
                plantSortId = undefined;
                plantScheduledDate = undefined;
            } else {
                console.warn(
                    `Unhandled event type: ${event.type} for field ${field.id}`,
                );
            }
        }

        return {
            ...field,
            plantCycles: summarizePlantCycles(
                aggregateId,
                field.positionIndex,
                plantCycleEventsByAggregateId.get(aggregateId) ?? [],
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
            weedState,
        };
    });
}

export async function getRaisedBedDiaryEntries(raisedBedId: number) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found`);
    }

    const [events, operationsData, operations] = await Promise.all([
        getEvents(
            [
                knownEventTypes.raisedBeds.create,
                knownEventTypes.raisedBeds.aiAnalysis,
                knownEventTypes.raisedBeds.delete,
                knownEventTypes.raisedBeds.abandon,
            ],
            [raisedBedId.toString()],
            0,
            10000,
        ),
        getEntitiesFormatted<EntityStandardized>('operation'),
        // TODO: Maybe retrieve operations from other accounts as well, but anonimized
        raisedBed.accountId && raisedBed.gardenId
            ? await getOperations(
                  raisedBed.accountId,
                  raisedBed.gardenId,
                  raisedBedId,
              )
            : Promise.resolve([]),
    ]);

    const raisedBedsEventDiaryEntries = events
        .map((event) => {
            const data = event.data as Record<string, unknown> | undefined;
            let name = 'Nepoznato';
            let description = '';

            switch (event.type) {
                case knownEventTypes.raisedBeds.create: {
                    name = 'Gredica stvorena';
                    break;
                }
                case knownEventTypes.raisedBeds.aiAnalysis: {
                    name = 'Savjeti suncokreta';
                    description =
                        typeof data?.markdown === 'string'
                            ? data.markdown
                            : 'AI analiza je spremljena.';
                    break;
                }
                case knownEventTypes.raisedBeds.delete: {
                    name = 'Gredica obrisana';
                    break;
                }
                case knownEventTypes.raisedBeds.abandon: {
                    name = 'Gredica napuštena';
                    description =
                        data?.reason === 'inactivity'
                            ? 'Gredica je napuštena zbog neaktivnosti.'
                            : '';
                    break;
                }
            }

            return {
                id: event.id,
                name,
                description,
                status: null,
                timestamp: event.createdAt,
                imageUrls: Array.isArray(data?.imageUrls)
                    ? data.imageUrls.filter(
                          (url: unknown) => typeof url === 'string',
                      )
                    : typeof data?.imageUrl === 'string'
                      ? [data.imageUrl]
                      : undefined,
                isMarkdown:
                    event.type === knownEventTypes.raisedBeds.aiAnalysis,
            };
        })
        .filter((op) => op.name);
    const operationsDiaryEntries = operations
        .filter((op) => !op.raisedBedFieldId) // Filter out operations with raisedBedFieldId
        .map((op) => ({
            id: op.id,
            name:
                operationsData?.find((opData) => opData.id === op.entityId)
                    ?.information?.label ?? 'Nepoznato',
            description: operationsData?.find(
                (opData) => opData.id === op.entityId,
            )?.information?.shortDescription,
            status: operationStatusToLabel(op.status),
            timestamp: op.completedAt ?? op.scheduledDate ?? op.createdAt,
            imageUrls: op.imageUrls,
            rescheduleTarget: operationDiaryRescheduleTarget(op),
        }))
        .filter((op) => op.name)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return [...raisedBedsEventDiaryEntries, ...operationsDiaryEntries].sort(
        (a, b) => {
            const aTime =
                a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
            const bTime =
                b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
            return bTime - aTime;
        },
    );
}

export async function updateRaisedBed(raisedBed: UpdateRaisedBed) {
    const previousRaisedBed =
        raisedBed.status === 'active'
            ? (
                  await storage()
                      .select({
                          accountId: raisedBeds.accountId,
                          status: raisedBeds.status,
                      })
                      .from(raisedBeds)
                      .where(eq(raisedBeds.id, raisedBed.id))
                      .limit(1)
              )[0]
            : null;

    await storage()
        .update(raisedBeds)
        .set(raisedBed)
        .where(eq(raisedBeds.id, raisedBed.id));
    await bustScheduleCache();

    const activatedAccountId =
        previousRaisedBed?.status !== 'active'
            ? (raisedBed.accountId ?? previousRaisedBed?.accountId)
            : null;
    if (raisedBed.status === 'active' && activatedAccountId) {
        await processReferralRewardsForAccount(activatedAccountId);
    }
}

export async function abandonRaisedBed({
    accountId,
    gardenId,
    operationEntityId,
    operationEntityTypeName,
    reason,
    raisedBedId,
}: {
    accountId: string;
    gardenId: number;
    operationEntityId: number;
    operationEntityTypeName: string;
    reason?: 'inactivity' | 'user';
    raisedBedId: number;
}) {
    const operation = await storage().transaction(async (tx) => {
        const [createdOperation] = await tx
            .insert(operations)
            .values({
                accountId,
                entityId: operationEntityId,
                entityTypeName: operationEntityTypeName,
                gardenId,
                raisedBedId,
            })
            .returning({ id: operations.id });

        await tx
            .update(raisedBeds)
            .set({ status: 'abandoned' })
            .where(eq(raisedBeds.id, raisedBedId));

        await tx.insert(events).values(
            knownEvents.raisedBeds.abandonV1(raisedBedId.toString(), {
                reason,
            }),
        );

        return createdOperation;
    });
    await bustScheduleCache();
    return operation.id;
}

export async function mergeRaisedBeds(
    targetRaisedBedId: number,
    sourceRaisedBedId: number,
) {
    if (targetRaisedBedId === sourceRaisedBedId) {
        throw new Error('Cannot merge the same raised bed');
    }

    const db = storage();

    await db.transaction(async (tx) => {
        const targetRaisedBed = await tx.query.raisedBeds.findFirst({
            where: and(
                eq(raisedBeds.id, targetRaisedBedId),
                eq(raisedBeds.isDeleted, false),
            ),
        });
        const sourceRaisedBed = await tx.query.raisedBeds.findFirst({
            where: and(
                eq(raisedBeds.id, sourceRaisedBedId),
                eq(raisedBeds.isDeleted, false),
            ),
        });

        if (!targetRaisedBed) {
            throw new Error(`Target raised bed ${targetRaisedBedId} not found`);
        }
        if (!sourceRaisedBed) {
            throw new Error(`Source raised bed ${sourceRaisedBedId} not found`);
        }

        if (targetRaisedBed.gardenId !== sourceRaisedBed.gardenId) {
            throw new Error('Raised beds must belong to the same garden');
        }

        const targetFields = await tx.query.raisedBedFields.findMany({
            where: and(
                eq(raisedBedFields.raisedBedId, targetRaisedBedId),
                eq(raisedBedFields.isDeleted, false),
            ),
        });
        const sourceFields = await tx.query.raisedBedFields.findMany({
            where: and(
                eq(raisedBedFields.raisedBedId, sourceRaisedBedId),
                eq(raisedBedFields.isDeleted, false),
            ),
        });

        await normalizeRaisedBedFieldsForMerge(
            tx,
            targetRaisedBedId,
            targetFields,
        );
        const normalizedSourceFields = await normalizeRaisedBedFieldsForMerge(
            tx,
            sourceRaisedBedId,
            sourceFields,
        );

        const sourceFieldMappings = normalizedSourceFields.map((field) => ({
            fieldId: field.id,
            previousPositionIndex: field.positionIndex,
            nextPositionIndex:
                field.positionIndex + RAISED_BED_FIELDS_PER_BLOCK,
        }));

        for (const mapping of sourceFieldMappings) {
            await tx
                .update(raisedBedFields)
                .set({
                    raisedBedId: targetRaisedBedId,
                    positionIndex: mapping.nextPositionIndex,
                })
                .where(eq(raisedBedFields.id, mapping.fieldId));
        }

        await tx
            .update(operations)
            .set({ raisedBedId: targetRaisedBedId })
            .where(eq(operations.raisedBedId, sourceRaisedBedId));
        await tx
            .update(notifications)
            .set({ raisedBedId: targetRaisedBedId })
            .where(eq(notifications.raisedBedId, sourceRaisedBedId));
        await tx
            .update(shoppingCartItems)
            .set({ isDeleted: true })
            .where(
                and(
                    eq(shoppingCartItems.raisedBedId, sourceRaisedBedId),
                    eq(shoppingCartItems.isDeleted, false),
                    eq(shoppingCartItems.status, 'new'),
                ),
            );
        await tx
            .update(raisedBedSensors)
            .set({ raisedBedId: targetRaisedBedId })
            .where(eq(raisedBedSensors.raisedBedId, sourceRaisedBedId));
        await tx
            .update(events)
            .set({ aggregateId: targetRaisedBedId.toString() })
            .where(
                and(
                    eq(events.aggregateId, sourceRaisedBedId.toString()),
                    inArray(events.type, [
                        knownEventTypes.raisedBeds.create,
                        knownEventTypes.raisedBeds.place,
                        knownEventTypes.raisedBeds.delete,
                        knownEventTypes.raisedBeds.abandon,
                        knownEventTypes.raisedBeds.aiAnalysis,
                    ]),
                ),
            );

        for (const mapping of sourceFieldMappings) {
            await tx
                .update(events)
                .set({
                    aggregateId: `${targetRaisedBedId.toString()}|${mapping.nextPositionIndex.toString()}`,
                })
                .where(
                    and(
                        eq(
                            events.aggregateId,
                            `${sourceRaisedBedId.toString()}|${mapping.previousPositionIndex.toString()}`,
                        ),
                        inArray(events.type, [
                            knownEventTypes.raisedBedFields.create,
                            knownEventTypes.raisedBedFields.delete,
                            knownEventTypes.raisedBedFields.plantPlace,
                            knownEventTypes.raisedBedFields.plantSchedule,
                            knownEventTypes.raisedBedFields.plantUpdate,
                            knownEventTypes.raisedBedFields.plantReplaceSort,
                        ]),
                    ),
                );
        }

        await tx
            .update(raisedBeds)
            .set({
                isDeleted: true,
                physicalId: null,
                gardenId: null,
                accountId: null,
                blockId: null,
            })
            .where(eq(raisedBeds.id, sourceRaisedBedId));

        if (!targetRaisedBed.physicalId && sourceRaisedBed.physicalId) {
            await tx
                .update(raisedBeds)
                .set({
                    physicalId: sourceRaisedBed.physicalId,
                })
                .where(eq(raisedBeds.id, targetRaisedBedId));
        }
    });
    await bustScheduleCache();
}

export async function deleteRaisedBed(raisedBedId: number) {
    await storage()
        .update(raisedBeds)
        .set({ isDeleted: true })
        .where(eq(raisedBeds.id, raisedBedId));
    await bustScheduleCache();
}

export async function getFarmUserRaisedBeds(userId: string) {
    return cacheScheduleRead(
        scheduleCacheKeys.farmUserRaisedBeds(userId),
        () => getFarmUserRaisedBedsUncached(userId),
        scheduleCacheTtls.raisedBeds,
    );
}

async function getFarmUserRaisedBedsUncached(userId: string) {
    const farmRaisedBeds = await storage()
        .select({ raisedBed: raisedBeds })
        .from(raisedBeds)
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .innerJoin(farmUsers, eq(gardens.farmId, farmUsers.farmId))
        .where(
            and(
                eq(farmUsers.userId, userId),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
                // Sandbox ("play") gardens never appear in farm scheduling.
                eq(gardens.isSandbox, false),
            ),
        )
        .orderBy(asc(raisedBeds.id));

    const fields = (
        await Promise.all(
            farmRaisedBeds
                .map((row) => row.raisedBed.id)
                .map(getRaisedBedFieldsWithEvents),
        )
    ).flat();

    return farmRaisedBeds.map(({ raisedBed }) => ({
        ...raisedBed,
        fields: fields.filter((field) => field.raisedBedId === raisedBed.id),
    }));
}

export async function getAllRaisedBeds() {
    return cacheScheduleRead(
        scheduleCacheKeys.adminRaisedBeds(),
        getAllRaisedBedsUncached,
        scheduleCacheTtls.raisedBeds,
    );
}

// Exclude raised beds belonging to sandbox ("play") gardens. Beds with no
// garden (merged/abandoned) are kept.
const excludeSandboxRaisedBeds = or(
    isNull(raisedBeds.gardenId),
    eq(gardens.isSandbox, false),
);

async function getAllRaisedBedsUncached() {
    const rows = await storage()
        .select({ raisedBed: raisedBeds })
        .from(raisedBeds)
        .leftJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .where(and(eq(raisedBeds.isDeleted, false), excludeSandboxRaisedBeds));
    const allRaisedBeds = rows.map((row) => row.raisedBed);
    const fields = (
        await Promise.all(
            allRaisedBeds.map((r) => r.id).map(getRaisedBedFieldsWithEvents),
        )
    ).flat();
    return allRaisedBeds.map((raisedBed) => ({
        ...raisedBed,
        fields: fields.filter((field) => field.raisedBedId === raisedBed.id),
    }));
}

export async function getAllRaisedBedsFiltered(filters?: { status?: string }) {
    // Build where conditions
    const whereConditions = [
        eq(raisedBeds.isDeleted, false),
        excludeSandboxRaisedBeds,
    ];

    if (filters?.status) {
        whereConditions.push(eq(raisedBeds.status, filters.status));
    }

    const rows = await storage()
        .select({ raisedBed: raisedBeds })
        .from(raisedBeds)
        .leftJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .where(and(...whereConditions));
    const allRaisedBeds = rows.map((row) => row.raisedBed);

    const fields = (
        await Promise.all(
            allRaisedBeds.map((r) => r.id).map(getRaisedBedFieldsWithEvents),
        )
    ).flat();

    return allRaisedBeds.map((raisedBed) => ({
        ...raisedBed,
        fields: fields.filter((field) => field.raisedBedId === raisedBed.id),
    }));
}

export async function getRaisedBedFieldDiaryEntries(
    raisedBedId: number,
    positionIndex: number,
) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found`);
    }

    const fields = raisedBed.fields.filter(
        (f) => f.positionIndex === positionIndex,
    );
    const [events, operationsData, operations] = await Promise.all([
        getEvents(
            [
                knownEventTypes.raisedBedFields.create,
                knownEventTypes.raisedBedFields.plantPlace,
                knownEventTypes.raisedBedFields.plantSchedule,
                knownEventTypes.raisedBedFields.plantUpdate,
                knownEventTypes.raisedBedFields.plantReplaceSort,
                knownEventTypes.raisedBedFields.aiAnalysis,
                knownEventTypes.raisedBedFields.delete,
            ],
            [`${raisedBedId.toString()}|${positionIndex.toString()}`],
            0,
            10000,
        ),
        getEntitiesFormatted<EntityStandardized>('operation'),
        // TODO: Maybe retrieve operations from other accounts as well, but anonimized
        raisedBed.accountId && raisedBed.gardenId && fields.length > 0
            ? await getOperations(
                  raisedBed.accountId,
                  raisedBed.gardenId,
                  raisedBedId,
                  fields.map((f) => f.id),
              )
            : Promise.resolve([]),
    ]);

    const raisedBedsEventDiaryEntries = events
        .map((event) => {
            const data = event.data as Record<string, unknown> | undefined;
            let name = 'Nepoznato';
            let description = '';
            switch (event.type) {
                case knownEventTypes.raisedBedFields.create: {
                    name = 'Polje zauzeto';
                    description = 'Polje je zauzeto i spremno za sijanje.';
                    break;
                }
                case knownEventTypes.raisedBedFields.plantPlace: {
                    name = 'Zatraženo sijanje biljke';
                    description =
                        'Sijanje biljke je zatraženo i čeka na odobrenje.';
                    break;
                }
                case knownEventTypes.raisedBedFields.plantSchedule: {
                    name = 'Ažuriran termin sijanja';
                    description = 'Termin sijanja biljke je promijenjen.';
                    break;
                }
                case knownEventTypes.raisedBedFields.plantUpdate: {
                    const newStatus =
                        typeof event.data === 'object' &&
                        event.data !== null &&
                        'status' in event.data &&
                        typeof event.data.status === 'string'
                            ? event.data.status
                            : 'unknown';
                    const statusLabels = plantFieldStatusLabel(newStatus);
                    name = statusLabels.label;
                    description = statusLabels.description;
                    break;
                }
                case knownEventTypes.raisedBedFields.plantReplaceSort: {
                    name = 'Zamjena sorte biljke';
                    description = 'Za biljku je zamjenjena navedena sorta.';
                    break;
                }
                case knownEventTypes.raisedBedFields.delete: {
                    name = 'Polje uklonjeno';
                    description = 'Polje je uklonjeno.';
                    break;
                }
                case knownEventTypes.raisedBedFields.aiAnalysis: {
                    name = 'Savjeti suncokreta';
                    description =
                        typeof data?.markdown === 'string'
                            ? data.markdown
                            : 'AI analiza je spremljena.';
                    break;
                }
                default:
                    name = 'Nepoznato';
                    description = 'Nepoznata promjena.';
            }

            return {
                id: event.id,
                name,
                description,
                status: null,
                timestamp: event.createdAt,
                imageUrls: Array.isArray(data?.imageUrls)
                    ? data.imageUrls.filter(
                          (url: unknown) => typeof url === 'string',
                      )
                    : typeof data?.imageUrl === 'string'
                      ? [data.imageUrl]
                      : undefined,
                isMarkdown:
                    event.type === knownEventTypes.raisedBedFields.aiAnalysis,
            };
        })
        .filter((event) => event.name);

    const operationsDiaryEntries = operations
        .map((op) => ({
            id: op.id,
            name:
                operationsData?.find((opData) => opData.id === op.entityId)
                    ?.information?.label ?? 'Nepoznato',
            description: operationsData?.find(
                (opData) => opData.id === op.entityId,
            )?.information?.shortDescription,
            status: operationStatusToLabel(op.status),
            timestamp: op.completedAt ?? op.scheduledDate ?? op.createdAt,
            imageUrls: op.imageUrls,
            rescheduleTarget: operationDiaryRescheduleTarget(op, positionIndex),
        }))
        .filter((op) => op.name)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const plannedFieldDiaryEntry = fieldPlantDiaryEntry(
        raisedBedId,
        positionIndex,
        fields,
    );

    return [
        ...raisedBedsEventDiaryEntries,
        ...operationsDiaryEntries,
        ...(plannedFieldDiaryEntry ? [plannedFieldDiaryEntry] : []),
    ].sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
        return bTime - aTime;
    });
}

type DiaryRescheduleTarget =
    | {
          type: 'operation';
          operationId: number;
          raisedBedId: number | null;
          raisedBedFieldId: number | null;
          positionIndex?: number;
          scheduledDate: string;
      }
    | {
          type: 'raisedBedFieldPlant';
          raisedBedId: number;
          positionIndex: number;
          scheduledDate: string;
      };

type DiaryOperation = Awaited<ReturnType<typeof getOperations>>[number];
type RaisedBedFieldWithEvents = Awaited<
    ReturnType<typeof getRaisedBedFieldsWithEvents>
>[number];

const fieldPlantRescheduleStatuses = new Set(['new', 'planned']);

function operationDiaryRescheduleTarget(
    operation: DiaryOperation,
    positionIndex?: number,
): DiaryRescheduleTarget | undefined {
    if (operation.status !== 'planned' || !operation.scheduledDate) {
        return undefined;
    }

    return {
        type: 'operation',
        operationId: operation.id,
        raisedBedId: operation.raisedBedId,
        raisedBedFieldId: operation.raisedBedFieldId,
        ...(positionIndex !== undefined ? { positionIndex } : {}),
        scheduledDate: operation.scheduledDate.toISOString(),
    };
}

function isPlannedFieldPlant(field: RaisedBedFieldWithEvents) {
    return (
        field.active &&
        Boolean(field.plantSortId) &&
        Boolean(field.plantScheduledDate) &&
        (!field.plantStatus ||
            fieldPlantRescheduleStatuses.has(field.plantStatus))
    );
}

function fieldPlantDiaryEntry(
    raisedBedId: number,
    positionIndex: number,
    fields: RaisedBedFieldWithEvents[],
) {
    const field = fields.find(
        (candidate) =>
            candidate.positionIndex === positionIndex &&
            isPlannedFieldPlant(candidate),
    );
    if (!field?.plantScheduledDate) {
        return null;
    }

    return {
        id: -field.id,
        name: 'Planirano sijanje',
        description: 'Sijanje biljke je planirano za odabrani datum.',
        status: 'Planirano',
        timestamp: field.plantScheduledDate,
        imageUrls: undefined,
        rescheduleTarget: {
            type: 'raisedBedFieldPlant',
            raisedBedId,
            positionIndex,
            scheduledDate: field.plantScheduledDate.toISOString(),
        } satisfies DiaryRescheduleTarget,
    };
}

export async function getRaisedBedAiHistoryEntries(raisedBedId: number) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        return [];
    }

    const fieldPositionIndexes = Array.from(
        new Set(raisedBed.fields.map((field) => field.positionIndex)),
    );
    const aggregateIds = [
        raisedBedId.toString(),
        ...fieldPositionIndexes.map(
            (positionIndex) =>
                `${raisedBedId.toString()}|${positionIndex.toString()}`,
        ),
    ];

    const events = await getEvents(
        [
            knownEventTypes.raisedBeds.aiAnalysis,
            knownEventTypes.raisedBedFields.aiAnalysis,
        ],
        aggregateIds,
        0,
        10000,
    );

    return events
        .map((event) => {
            const data = event.data as Record<string, unknown> | undefined;
            const imageUrls = Array.isArray(data?.imageUrls)
                ? data.imageUrls.filter(
                      (url: unknown): url is string => typeof url === 'string',
                  )
                : typeof data?.imageUrl === 'string'
                  ? [data.imageUrl]
                  : undefined;
            return {
                id: event.id,
                description:
                    typeof data?.markdown === 'string'
                        ? data.markdown
                        : undefined,
                timestamp: event.createdAt,
                imageUrls,
                isMarkdown: true,
            };
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

function operationStatusToLabel(status: string) {
    switch (status) {
        case 'new':
            return 'Novo';
        case 'completed':
            return 'Završeno';
        case 'pendingVerification':
            return 'Završeno';
        case 'planned':
            return 'Planirano';
        case 'canceled':
            return 'Otkazano';
        case 'failed':
            return 'Neuspješno';
        default:
            return 'Nepoznato';
    }
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
) {
    await storage()
        .update(raisedBedFields)
        .set({ isDeleted: true })
        .where(
            and(
                eq(raisedBedFields.raisedBedId, raisedBedId),
                eq(raisedBedFields.positionIndex, positionIndex),
                eq(raisedBedFields.isDeleted, false),
            ),
        );
    await bustScheduleCache();
}

export async function getRaisedBedSensors(raisedBedId: number) {
    const raisedBed = await storage().query.raisedBeds.findFirst({
        columns: {
            id: true,
            physicalId: true,
            gardenId: true,
        },
        where: and(
            eq(raisedBeds.id, raisedBedId),
            eq(raisedBeds.isDeleted, false),
        ),
    });

    if (!raisedBed) {
        return [];
    }

    let raisedBedIds: number[] = [raisedBed.id];

    if (raisedBed.physicalId) {
        const whereConditions = [
            eq(raisedBeds.physicalId, raisedBed.physicalId),
            eq(raisedBeds.isDeleted, false),
        ];

        if (raisedBed.gardenId) {
            whereConditions.push(eq(raisedBeds.gardenId, raisedBed.gardenId));
        }

        const relatedBeds = await storage().query.raisedBeds.findMany({
            columns: { id: true },
            where: and(...whereConditions),
        });

        raisedBedIds = Array.from(
            new Set([raisedBed.id, ...relatedBeds.map((bed) => bed.id)]),
        );
    }

    const sensors = await storage().query.raisedBedSensors.findMany({
        where: and(
            inArray(raisedBedSensors.raisedBedId, raisedBedIds),
            eq(raisedBedSensors.isDeleted, false),
        ),
    });

    const uniqueSensors: typeof sensors = [];
    const seen = new Set<string>();

    for (const sensor of sensors) {
        const key = sensor.sensorSignalcoId
            ? `signalco:${sensor.sensorSignalcoId}`
            : `id:${sensor.id}`;

        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        uniqueSensors.push(sensor);
    }

    return uniqueSensors;
}

export function createRaisedBedSensor(data: InsertRaisedBedSensor) {
    return storage()
        .insert(raisedBedSensors)
        .values({
            ...data,
        })
        .returning({
            id: raisedBedSensors.id,
        });
}

export async function updateRaisedBedSensor(data: UpdateRaisedBedSensor) {
    await storage()
        .update(raisedBedSensors)
        .set({
            ...data,
        })
        .where(
            and(
                eq(raisedBedSensors.id, data.id),
                eq(raisedBedSensors.isDeleted, false),
            ),
        );
}
