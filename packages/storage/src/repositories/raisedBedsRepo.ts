import 'server-only';
import {
    and,
    asc,
    count,
    eq,
    inArray,
    isNotNull,
    isNull,
    or,
} from 'drizzle-orm';
import { storage } from '..';
import {
    bustScheduleCache,
    cacheScheduleRead,
    scheduleCacheKeys,
    scheduleCacheTtls,
} from '../cache/scheduleCache';
import { generateRaisedBedName } from '../helpers/generateRaisedBedName';
import { RAISED_BED_PHOTO_OPERATION_ID } from '../helpers/raisedBedPhotoOperations';
import {
    events,
    farmUsers,
    gardens,
    type InsertRaisedBed,
    notifications,
    operations,
    type RaisedBedOrientation,
    raisedBeds,
    shoppingCartItems,
    type UpdateRaisedBed,
} from '../schema';
import {
    type InsertRaisedBedSensor,
    raisedBedFields,
    raisedBedSensors,
    type UpdateRaisedBedSensor,
} from '../schema/gardenSchema';
import {
    createEvent,
    getAllEvents,
    knownEvents,
    knownEventTypes,
    type RaisedBedWeedStateLevel,
    type RaisedBedWeedStateSetPayload,
    type RaisedBedWeedStateSource,
} from './eventsRepo';
import {
    getRaisedBedFieldsWithEvents,
    getRaisedBedFieldsWithEventsForBeds,
    normalizeRaisedBedFieldsForMerge,
    type RaisedBedFieldWithEvents,
    type RaisedBedWeedState,
} from './raisedBedFieldsRepo';
import { processReferralRewardsForAccount } from './referralsRepo';

const RAISED_BED_FIELDS_PER_BLOCK = 9;

type RaisedBedFieldPlantCycleEvent = typeof events.$inferSelect;
export type RaisedBedLatestPhotoOperation = {
    id: number;
    completedAt: Date;
    imageUrls: string[];
};
type RaisedBedWithFields = typeof raisedBeds.$inferSelect & {
    fields: RaisedBedFieldWithEvents[];
    latestPhotoOperation: RaisedBedLatestPhotoOperation | null;
    weedState: RaisedBedWeedState | null;
};

const raisedBedPhotoOperationStatusEventTypes = [
    knownEventTypes.operations.schedule,
    knownEventTypes.operations.complete,
    knownEventTypes.operations.verify,
    knownEventTypes.operations.fail,
    knownEventTypes.operations.cancel,
];

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

function imageUrlsFromOperationCompleteData(value: unknown) {
    if (!value || typeof value !== 'object') {
        return [];
    }

    const images = (value as { images?: unknown }).images;
    return Array.isArray(images)
        ? images.filter(
              (imageUrl): imageUrl is string =>
                  typeof imageUrl === 'string' && imageUrl.trim().length > 0,
          )
        : [];
}

async function getLatestRaisedBedPhotoOperationsByIds(
    raisedBedIds: number[],
): Promise<Map<number, RaisedBedLatestPhotoOperation>> {
    const uniqueRaisedBedIds = Array.from(new Set(raisedBedIds));
    const latestPhotoOperationsByRaisedBedId = new Map<
        number,
        RaisedBedLatestPhotoOperation & { eventId: number }
    >();

    if (uniqueRaisedBedIds.length === 0) {
        return new Map();
    }

    const photoOperations = await storage().query.operations.findMany({
        columns: {
            id: true,
            raisedBedId: true,
        },
        where: and(
            inArray(operations.raisedBedId, uniqueRaisedBedIds),
            eq(operations.entityId, RAISED_BED_PHOTO_OPERATION_ID),
            eq(operations.entityTypeName, 'operation'),
            eq(operations.isDeleted, false),
            isNotNull(operations.raisedBedId),
        ),
    });
    const raisedBedIdByOperationId = new Map<number, number>();
    for (const operation of photoOperations) {
        if (typeof operation.raisedBedId === 'number') {
            raisedBedIdByOperationId.set(operation.id, operation.raisedBedId);
        }
    }

    const operationIds = Array.from(raisedBedIdByOperationId.keys());
    if (operationIds.length === 0) {
        return new Map();
    }

    const operationEvents = await getAllEvents(
        raisedBedPhotoOperationStatusEventTypes,
        operationIds.map((operationId) => operationId.toString()),
    );
    const latestStatusTypeByOperationId = new Map<number, string>();
    for (const event of operationEvents) {
        const operationId = Number(event.aggregateId);
        if (raisedBedIdByOperationId.has(operationId)) {
            latestStatusTypeByOperationId.set(operationId, event.type);
        }
    }

    for (const event of operationEvents) {
        if (event.type !== knownEventTypes.operations.complete) {
            continue;
        }

        const operationId = Number(event.aggregateId);
        const latestStatusType = latestStatusTypeByOperationId.get(operationId);
        if (
            latestStatusType !== knownEventTypes.operations.complete &&
            latestStatusType !== knownEventTypes.operations.verify
        ) {
            continue;
        }

        const raisedBedId = raisedBedIdByOperationId.get(operationId);
        if (!raisedBedId) {
            continue;
        }

        const imageUrls = imageUrlsFromOperationCompleteData(event.data);
        if (imageUrls.length === 0) {
            continue;
        }

        const current = latestPhotoOperationsByRaisedBedId.get(raisedBedId);
        if (
            current &&
            (current.completedAt > event.createdAt ||
                (current.completedAt.getTime() === event.createdAt.getTime() &&
                    current.eventId > event.id))
        ) {
            continue;
        }

        latestPhotoOperationsByRaisedBedId.set(raisedBedId, {
            id: operationId,
            completedAt: event.createdAt,
            imageUrls,
            eventId: event.id,
        });
    }

    return new Map(
        Array.from(
            latestPhotoOperationsByRaisedBedId,
            ([raisedBedId, item]) => [
                raisedBedId,
                {
                    id: item.id,
                    completedAt: item.completedAt,
                    imageUrls: item.imageUrls,
                },
            ],
        ),
    );
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

export async function listActiveRaisedBedOperationTargets() {
    const rows = await storage()
        .select({
            id: raisedBeds.id,
            accountId: raisedBeds.accountId,
            gardenId: raisedBeds.gardenId,
        })
        .from(raisedBeds)
        .innerJoin(gardens, eq(gardens.id, raisedBeds.gardenId))
        .where(
            and(
                eq(raisedBeds.status, 'active'),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
                isNotNull(raisedBeds.accountId),
                isNotNull(raisedBeds.gardenId),
            ),
        )
        .orderBy(asc(raisedBeds.id));

    return rows.flatMap((row) =>
        row.accountId && row.gardenId
            ? [
                  {
                      id: row.id,
                      accountId: row.accountId,
                      gardenId: row.gardenId,
                  },
              ]
            : [],
    );
}

async function getRaisedBedWeedStatesByIds(raisedBedIds: number[]) {
    const uniqueRaisedBedIds = Array.from(new Set(raisedBedIds));
    const weedStatesByRaisedBedId = new Map<number, RaisedBedWeedState>();
    if (uniqueRaisedBedIds.length === 0) {
        return weedStatesByRaisedBedId;
    }

    const weedStateEvents = await getAllEvents(
        knownEventTypes.raisedBeds.weedStateSet,
        uniqueRaisedBedIds.map((raisedBedId) => raisedBedId.toString()),
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
    return (
        (await getRaisedBedsForGardens([gardenId], filters)).get(gardenId) ?? []
    );
}

export async function getRaisedBedsForGardens(
    gardenIds: number[],
    filters?: {
        status?: string;
    },
) {
    const uniqueGardenIds = Array.from(new Set(gardenIds));
    const raisedBedsByGardenId = new Map<number, RaisedBedWithFields[]>();

    for (const gardenId of uniqueGardenIds) {
        raisedBedsByGardenId.set(gardenId, []);
    }

    if (uniqueGardenIds.length === 0) {
        return raisedBedsByGardenId;
    }

    // Build where conditions
    const whereConditions = [
        inArray(raisedBeds.gardenId, uniqueGardenIds),
        eq(raisedBeds.isDeleted, false),
    ];

    if (filters?.status) {
        whereConditions.push(eq(raisedBeds.status, filters.status));
    }

    const beds = await storage().query.raisedBeds.findMany({
        where: and(...whereConditions),
    });
    const bedIds = beds.map((bed) => bed.id);
    const [
        weedStatesByRaisedBedId,
        fieldsByRaisedBedId,
        latestPhotoOperationsByRaisedBedId,
    ] = await Promise.all([
        getRaisedBedWeedStatesByIds(bedIds),
        getRaisedBedFieldsWithEventsForBeds(bedIds),
        getLatestRaisedBedPhotoOperationsByIds(bedIds),
    ]);

    // For each raised bed, fetch and attach fields with event-sourced info
    for (const bed of beds) {
        if (bed.gardenId === null) {
            continue;
        }

        const gardenBeds = raisedBedsByGardenId.get(bed.gardenId);
        const bedWithFields = {
            ...bed,
            fields: fieldsByRaisedBedId.get(bed.id) ?? [],
            latestPhotoOperation:
                latestPhotoOperationsByRaisedBedId.get(bed.id) ?? null,
            weedState: weedStatesByRaisedBedId.get(bed.id) ?? null,
        };
        if (gardenBeds) {
            gardenBeds.push(bedWithFields);
        } else {
            raisedBedsByGardenId.set(bed.gardenId, [bedWithFields]);
        }
    }

    return raisedBedsByGardenId;
}

export async function getRaisedBed(raisedBedId: number) {
    const [
        raisedBed,
        fields,
        weedStatesByRaisedBedId,
        latestPhotoOperationsByRaisedBedId,
    ] = await Promise.all([
        storage().query.raisedBeds.findFirst({
            where: and(
                eq(raisedBeds.id, raisedBedId),
                eq(raisedBeds.isDeleted, false),
            ),
        }),
        getRaisedBedFieldsWithEvents(raisedBedId),
        getRaisedBedWeedStatesByIds([raisedBedId]),
        getLatestRaisedBedPhotoOperationsByIds([raisedBedId]),
    ]);
    if (!raisedBed) return null;
    // Attach raised bed fields with event-sourced info
    return {
        ...raisedBed,
        fields,
        latestPhotoOperation:
            latestPhotoOperationsByRaisedBedId.get(raisedBed.id) ?? null,
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

    const fieldsByRaisedBedId = await getRaisedBedFieldsWithEventsForBeds(
        farmRaisedBeds.map((row) => row.raisedBed.id),
    );

    return farmRaisedBeds.map(({ raisedBed }) => ({
        ...raisedBed,
        fields: fieldsByRaisedBedId.get(raisedBed.id) ?? [],
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
    const raisedBedIds = allRaisedBeds.map((raisedBed) => raisedBed.id);
    const [fieldsByRaisedBedId, latestPhotoOperationsByRaisedBedId] =
        await Promise.all([
            getRaisedBedFieldsWithEventsForBeds(raisedBedIds),
            getLatestRaisedBedPhotoOperationsByIds(raisedBedIds),
        ]);
    return allRaisedBeds.map((raisedBed) => ({
        ...raisedBed,
        fields: fieldsByRaisedBedId.get(raisedBed.id) ?? [],
        latestPhotoOperation:
            latestPhotoOperationsByRaisedBedId.get(raisedBed.id) ?? null,
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

    const raisedBedIds = allRaisedBeds.map((raisedBed) => raisedBed.id);
    const [fieldsByRaisedBedId, latestPhotoOperationsByRaisedBedId] =
        await Promise.all([
            getRaisedBedFieldsWithEventsForBeds(raisedBedIds),
            getLatestRaisedBedPhotoOperationsByIds(raisedBedIds),
        ]);

    return allRaisedBeds.map((raisedBed) => ({
        ...raisedBed,
        fields: fieldsByRaisedBedId.get(raisedBed.id) ?? [],
        latestPhotoOperation:
            latestPhotoOperationsByRaisedBedId.get(raisedBed.id) ?? null,
    }));
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
