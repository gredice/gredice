import 'server-only';
import {
    ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
    getAdvancedSowingFootprintPositions,
} from '@gredice/js/plants';
import {
    and,
    asc,
    count,
    eq,
    inArray,
    isNotNull,
    isNull,
    or,
    sql,
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
    farms,
    farmUsers,
    gardens,
    type InsertRaisedBed,
    notifications,
    operations,
    type RaisedBedOrientation,
    raisedBeds,
    shoppingCartItemAdvancedSowingAuthorizations,
    shoppingCartItems,
    type UpdateRaisedBed,
} from '../schema';
import {
    type InsertRaisedBedSensor,
    raisedBedFields,
    raisedBedPlantingFields,
    raisedBedPlantings,
    raisedBedSensors,
    type UpdateRaisedBedSensor,
} from '../schema/gardenSchema';
import { withCheckoutCartItemLocks } from './checkoutCartItemLock';
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
import {
    getRaisedBedPlantingsForRaisedBeds,
    type RaisedBedPlantingWithFields,
} from './raisedBedPlantingsRepo';
import { processReferralRewardsForAccount } from './referralsRepo';
import type { ScheduleTaskTransaction } from './scheduleTaskTransactionsRepo';
import { lockAndAssertCartItemsMutable } from './stripeCheckoutAttemptRepo';

const RAISED_BED_FIELDS_PER_BLOCK = 9;

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = StorageClient | TransactionClient;

type RaisedBedFieldPlantCycleEvent = typeof events.$inferSelect;
export type RaisedBedLatestPhotoOperation = {
    id: number;
    completedAt: Date;
    imageUrls: string[];
};
type RaisedBedWithFields = typeof raisedBeds.$inferSelect & {
    fields: RaisedBedFieldWithEvents[];
    latestPhotoOperation: RaisedBedLatestPhotoOperation | null;
    plantings: RaisedBedPlantingWithFields[];
    weedState: RaisedBedWeedState | null;
};

const raisedBedPhotoOperationStatusEventTypes = [
    knownEventTypes.operations.schedule,
    knownEventTypes.operations.complete,
    knownEventTypes.operations.block,
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
    db: DatabaseClient = storage(),
) {
    const result = (
        await db
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

export type GardenRaisedBedMutationMetadata = Readonly<{
    id: number;
    blockId: string | null;
    status: string;
    orientation: RaisedBedOrientation;
}>;

/**
 * Lock active raised-bed projections for a garden in stable ID order. This
 * lightweight view is intended for garden placement mutations that already
 * own the surrounding account and garden locks.
 */
export async function listGardenRaisedBedMetadataForUpdate(
    gardenId: number,
    db: TransactionClient,
): Promise<GardenRaisedBedMutationMetadata[]> {
    return db
        .select({
            id: raisedBeds.id,
            blockId: raisedBeds.blockId,
            status: raisedBeds.status,
            orientation: raisedBeds.orientation,
        })
        .from(raisedBeds)
        .where(
            and(
                eq(raisedBeds.gardenId, gardenId),
                eq(raisedBeds.isDeleted, false),
            ),
        )
        .orderBy(asc(raisedBeds.id))
        .for('update');
}

/**
 * Delete an unactivated raised bed at most once. Schedule cache invalidation
 * belongs to the outer command after its transaction commits.
 */
export async function softDeleteNewRaisedBedOnce(
    raisedBedId: number,
    db: TransactionClient,
) {
    const [deletedRaisedBed] = await db
        .update(raisedBeds)
        .set({ isDeleted: true })
        .where(
            and(
                eq(raisedBeds.id, raisedBedId),
                eq(raisedBeds.status, 'new'),
                eq(raisedBeds.isDeleted, false),
            ),
        )
        .returning({ id: raisedBeds.id });
    return deletedRaisedBed !== undefined;
}

/**
 * Update orientation for one active raised-bed projection inside the caller's
 * transaction. Schedule cache invalidation belongs to the outer command.
 */
export async function updateRaisedBedOrientation(
    raisedBedId: number,
    orientation: RaisedBedOrientation,
    db: TransactionClient,
) {
    const [updatedRaisedBed] = await db
        .update(raisedBeds)
        .set({ orientation })
        .where(
            and(
                eq(raisedBeds.id, raisedBedId),
                eq(raisedBeds.isDeleted, false),
            ),
        )
        .returning({ id: raisedBeds.id });
    return updatedRaisedBed !== undefined;
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
        plantingsByRaisedBedId,
    ] = await Promise.all([
        getRaisedBedWeedStatesByIds(bedIds),
        getRaisedBedFieldsWithEventsForBeds(bedIds),
        getLatestRaisedBedPhotoOperationsByIds(bedIds),
        getRaisedBedPlantingsForRaisedBeds(bedIds),
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
            plantings: plantingsByRaisedBedId.get(bed.id) ?? [],
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
        plantingsByRaisedBedId,
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
        getRaisedBedPlantingsForRaisedBeds([raisedBedId]),
    ]);
    if (!raisedBed) return null;
    // Attach raised bed fields with event-sourced info
    return {
        ...raisedBed,
        fields,
        latestPhotoOperation:
            latestPhotoOperationsByRaisedBedId.get(raisedBed.id) ?? null,
        plantings: plantingsByRaisedBedId.get(raisedBed.id) ?? [],
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

export type CheckoutPlantingRaisedBedActivation =
    | {
          available: false;
          reason: 'abandoned' | 'not_found' | 'status_changed';
      }
    | {
          available: true;
          activatedAccountId: string | null;
      };

/**
 * Serializes checkout planting against abandonment on the parent raised bed.
 * The caller must keep this in the same transaction as the planting events.
 */
export async function lockAndActivateRaisedBedForCheckoutPlanting(
    raisedBedId: number,
    transaction: ScheduleTaskTransaction,
): Promise<CheckoutPlantingRaisedBedActivation> {
    const [raisedBed] = await transaction
        .select({
            accountId: raisedBeds.accountId,
            status: raisedBeds.status,
        })
        .from(raisedBeds)
        .where(
            and(
                eq(raisedBeds.id, raisedBedId),
                eq(raisedBeds.isDeleted, false),
            ),
        )
        .limit(1)
        .for('update');

    if (!raisedBed) {
        return { available: false, reason: 'not_found' };
    }
    if (raisedBed.status === 'abandoned') {
        return { available: false, reason: 'abandoned' };
    }
    if (raisedBed.status === 'active') {
        return { available: true, activatedAccountId: null };
    }

    const [activatedRaisedBed] = await transaction
        .update(raisedBeds)
        .set({ status: 'active' })
        .where(
            and(
                eq(raisedBeds.id, raisedBedId),
                eq(raisedBeds.isDeleted, false),
                eq(raisedBeds.status, raisedBed.status),
            ),
        )
        .returning({ accountId: raisedBeds.accountId });

    if (!activatedRaisedBed) {
        return { available: false, reason: 'status_changed' };
    }

    return {
        available: true,
        activatedAccountId: activatedRaisedBed.accountId,
    };
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
    const expectedMutableCartItems = await db
        .select({ id: shoppingCartItems.id })
        .from(shoppingCartItems)
        .where(
            and(
                eq(shoppingCartItems.raisedBedId, sourceRaisedBedId),
                eq(shoppingCartItems.isDeleted, false),
                eq(shoppingCartItems.status, 'new'),
            ),
        );
    const expectedMutableCartItemIds = expectedMutableCartItems.map(
        (item) => item.id,
    );

    await withCheckoutCartItemLocks(expectedMutableCartItemIds, async (tx) => {
        const liveMutableCartItems = await tx
            .select({ id: shoppingCartItems.id })
            .from(shoppingCartItems)
            .where(
                and(
                    eq(shoppingCartItems.raisedBedId, sourceRaisedBedId),
                    eq(shoppingCartItems.isDeleted, false),
                    eq(shoppingCartItems.status, 'new'),
                ),
            );
        const expectedMutableCartItemIdSet = new Set(
            expectedMutableCartItemIds,
        );
        if (
            liveMutableCartItems.length !== expectedMutableCartItemIds.length ||
            liveMutableCartItems.some(
                (item) => !expectedMutableCartItemIdSet.has(item.id),
            )
        ) {
            throw new Error(
                'Shopping cart items changed while fencing raised bed merge.',
            );
        }
        await lockAndAssertCartItemsMutable(expectedMutableCartItemIds, tx);

        // Planting writers lock physical fields before the raised bed. Use the
        // same order here so merge cannot deadlock with concurrent placement.
        const mergeFields = await tx
            .select()
            .from(raisedBedFields)
            .where(
                inArray(raisedBedFields.raisedBedId, [
                    targetRaisedBedId,
                    sourceRaisedBedId,
                ]),
            )
            .orderBy(asc(raisedBedFields.id))
            .for('update');
        await tx
            .select({ id: raisedBeds.id })
            .from(raisedBeds)
            .where(
                inArray(raisedBeds.id, [targetRaisedBedId, sourceRaisedBedId]),
            )
            .orderBy(asc(raisedBeds.id))
            .for('update');

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

        const targetFields = mergeFields.filter(
            (field) =>
                field.raisedBedId === targetRaisedBedId && !field.isDeleted,
        );
        const allSourceFields = mergeFields.filter(
            (field) => field.raisedBedId === sourceRaisedBedId,
        );
        const sourceFields = allSourceFields.filter(
            (field) => !field.isDeleted,
        );
        const invalidHistoricalSourceFields = allSourceFields.filter(
            (field) =>
                field.positionIndex < 0 ||
                field.positionIndex >= RAISED_BED_FIELDS_PER_BLOCK,
        );
        if (invalidHistoricalSourceFields.length > 0) {
            throw new Error(
                `Source raised bed ${sourceRaisedBedId.toString()} has historical fields outside the mergeable block.`,
            );
        }

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

        const lockedSourcePlantingRows = await tx
            .select({ id: raisedBedPlantings.id })
            .from(raisedBedPlantings)
            .where(eq(raisedBedPlantings.raisedBedId, sourceRaisedBedId))
            .orderBy(asc(raisedBedPlantings.id))
            .for('update');
        if (lockedSourcePlantingRows.length > 0) {
            await tx
                .select({ id: raisedBedPlantingFields.id })
                .from(raisedBedPlantingFields)
                .where(
                    inArray(
                        raisedBedPlantingFields.plantingId,
                        lockedSourcePlantingRows.map((row) => row.id),
                    ),
                )
                .orderBy(asc(raisedBedPlantingFields.id))
                .for('update');
        }
        const sourcePlantings =
            (
                await getRaisedBedPlantingsForRaisedBeds(
                    [sourceRaisedBedId],
                    tx,
                )
            ).get(sourceRaisedBedId) ?? [];
        for (const planting of sourcePlantings) {
            if (
                planting.configurationSource !== 'selected' ||
                planting.isDeleted
            ) {
                continue;
            }
            const translatedAnchor =
                planting.anchorPositionIndex + RAISED_BED_FIELDS_PER_BLOCK;
            const expectedTranslatedPositions =
                getAdvancedSowingFootprintPositions({
                    anchorPositionIndex: translatedAnchor,
                    bedFieldCount: ADVANCED_SOWING_DEFAULT_BED_FIELD_COUNT,
                    fieldSpanRows: planting.spanRows,
                    fieldSpanColumns: planting.spanColumns,
                });
            for (const membership of planting.memberships) {
                const expectedPosition =
                    expectedTranslatedPositions[
                        membership.relativeRow * planting.spanColumns +
                            membership.relativeColumn
                    ];
                if (
                    membership.raisedBedField.positionIndex +
                        RAISED_BED_FIELDS_PER_BLOCK !==
                    expectedPosition
                ) {
                    throw new Error(
                        `Selected planting ${planting.id.toString()} cannot be translated to the merged raised-bed block.`,
                    );
                }
            }
        }

        // Move every source field, including soft-deleted historical rows used
        // by inactive legacy projections. Membership IDs remain stable.
        await tx
            .update(raisedBedFields)
            .set({
                raisedBedId: targetRaisedBedId,
                positionIndex: sql`${raisedBedFields.positionIndex} + ${RAISED_BED_FIELDS_PER_BLOCK}`,
            })
            .where(eq(raisedBedFields.raisedBedId, sourceRaisedBedId));
        await tx
            .update(raisedBedPlantings)
            .set({
                raisedBedId: targetRaisedBedId,
                anchorPositionIndex: sql`${raisedBedPlantings.anchorPositionIndex} + ${RAISED_BED_FIELDS_PER_BLOCK}`,
            })
            .where(eq(raisedBedPlantings.raisedBedId, sourceRaisedBedId));

        await tx
            .update(operations)
            .set({ raisedBedId: targetRaisedBedId })
            .where(eq(operations.raisedBedId, sourceRaisedBedId));
        await tx
            .update(notifications)
            .set({ raisedBedId: targetRaisedBedId })
            .where(eq(notifications.raisedBedId, sourceRaisedBedId));
        if (expectedMutableCartItemIds.length > 0) {
            await tx
                .delete(shoppingCartItemAdvancedSowingAuthorizations)
                .where(
                    inArray(
                        shoppingCartItemAdvancedSowingAuthorizations.cartItemId,
                        expectedMutableCartItemIds,
                    ),
                );
        }
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
                            knownEventTypes.raisedBedFields.plantBlock,
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
        .select({ farmId: gardens.farmId, raisedBed: raisedBeds })
        .from(raisedBeds)
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .innerJoin(farms, eq(gardens.farmId, farms.id))
        .innerJoin(farmUsers, eq(gardens.farmId, farmUsers.farmId))
        .where(
            and(
                eq(farmUsers.userId, userId),
                eq(raisedBeds.isDeleted, false),
                eq(gardens.isDeleted, false),
                eq(farms.isDeleted, false),
                // Sandbox ("play") gardens never appear in farm scheduling.
                eq(gardens.isSandbox, false),
            ),
        )
        .orderBy(asc(raisedBeds.id));

    const raisedBedIds = farmRaisedBeds.map((row) => row.raisedBed.id);
    const [fieldsByRaisedBedId, plantingsByRaisedBedId] = await Promise.all([
        getRaisedBedFieldsWithEventsForBeds(raisedBedIds),
        getRaisedBedPlantingsForRaisedBeds(raisedBedIds),
    ]);

    return farmRaisedBeds.map(({ farmId, raisedBed }) => ({
        ...raisedBed,
        farmId,
        fields: fieldsByRaisedBedId.get(raisedBed.id) ?? [],
        plantings: plantingsByRaisedBedId.get(raisedBed.id) ?? [],
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
    const [
        fieldsByRaisedBedId,
        latestPhotoOperationsByRaisedBedId,
        plantingsByRaisedBedId,
    ] = await Promise.all([
        getRaisedBedFieldsWithEventsForBeds(raisedBedIds),
        getLatestRaisedBedPhotoOperationsByIds(raisedBedIds),
        getRaisedBedPlantingsForRaisedBeds(raisedBedIds),
    ]);
    return allRaisedBeds.map((raisedBed) => ({
        ...raisedBed,
        fields: fieldsByRaisedBedId.get(raisedBed.id) ?? [],
        latestPhotoOperation:
            latestPhotoOperationsByRaisedBedId.get(raisedBed.id) ?? null,
        plantings: plantingsByRaisedBedId.get(raisedBed.id) ?? [],
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
    const [
        fieldsByRaisedBedId,
        latestPhotoOperationsByRaisedBedId,
        plantingsByRaisedBedId,
    ] = await Promise.all([
        getRaisedBedFieldsWithEventsForBeds(raisedBedIds),
        getLatestRaisedBedPhotoOperationsByIds(raisedBedIds),
        getRaisedBedPlantingsForRaisedBeds(raisedBedIds),
    ]);

    return allRaisedBeds.map((raisedBed) => ({
        ...raisedBed,
        fields: fieldsByRaisedBedId.get(raisedBed.id) ?? [],
        latestPhotoOperation:
            latestPhotoOperationsByRaisedBedId.get(raisedBed.id) ?? null,
        plantings: plantingsByRaisedBedId.get(raisedBed.id) ?? [],
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
