import 'server-only';
import { and, eq, inArray, like, or } from 'drizzle-orm';
import { bustScheduleCache } from '../cache/scheduleCache';
import {
    events,
    gardenBlocks,
    gardenStacks,
    gardens,
    notifications,
    operations,
    raisedBeds,
    shoppingCartItems,
    transactions,
} from '../schema';
import { raisedBedFields, raisedBedSensors } from '../schema/gardenSchema';
import { storage } from '../storage';
import { createEvent, knownEvents, knownEventTypes } from './eventsRepo';
import { getFarms } from './farmsRepo';
import { removeGardenPreviewAndQueueBlobDeletionUsing } from './gardenPreviewsRepo';
import {
    createGarden,
    deleteRaisedBedField,
    upsertRaisedBedField,
} from './gardensRepo';

type CreateDefaultGardenOptions = {
    accountId: string;
    name?: string;
};

export type DeleteSandboxGardenCompletelyOptions = {
    batchSize?: number;
    maxBatches?: number;
    maxDurationMs?: number;
};

export type DeleteSandboxGardenCompletelyResult = {
    complete: boolean;
    batches: number;
    deletedRows: number;
};

const GARDEN_EVENT_TYPES = Object.values(knownEventTypes.gardens);
const RAISED_BED_EVENT_TYPES = Object.values(knownEventTypes.raisedBeds);
const SANDBOX_RAISED_BED_FIELD_EVENT_TYPES = Object.values(
    knownEventTypes.raisedBedFields,
);
const OPERATION_EVENT_TYPES = Object.values(knownEventTypes.operations);
const INVENTORY_EVENT_TYPES = Object.values(knownEventTypes.inventory);
const DEFAULT_SANDBOX_GARDEN_DELETE_BATCH_SIZE = 500;
const DEFAULT_SANDBOX_GARDEN_DELETE_MAX_BATCHES = 40;
const DEFAULT_SANDBOX_GARDEN_DELETE_MAX_DURATION_MS = 8_000;
const INVENTORY_PREFIX = 'inventory:';

/**
 * Create an empty sandbox ("play") garden for an account.
 *
 * Unlike {@link createDefaultGardenForAccount} this seeds no blocks or raised
 * beds — the user builds it from scratch. Sandbox gardens are decoration only:
 * building is free and there is no plant-status lifecycle, weather or economy.
 */
export async function createSandboxGarden({
    accountId,
    name,
}: CreateDefaultGardenOptions) {
    const farms = await getFarms();
    const farm = farms.find((f) => !f.isDeleted);
    if (!farm) {
        throw new Error('No farm found');
    }

    const trimmedName = name?.trim();
    return createGarden({
        farmId: farm.id,
        accountId,
        name: trimmedName || 'Vrt za igru',
        isSandbox: true,
    });
}

/**
 * Plant a sort into a sandbox raised bed field at a chosen age.
 *
 * Reuses the real event-sourced planting model (plant-place + status updates)
 * but backdates all events to `sowDate` so the existing time-based generation
 * rendering draws an already-grown plant. No checkout/economy is involved.
 */
const RAISED_BED_FIELD_EVENT_TYPES = [
    knownEventTypes.raisedBedFields.create,
    knownEventTypes.raisedBedFields.delete,
    knownEventTypes.raisedBedFields.plantPlace,
    knownEventTypes.raisedBedFields.plantSchedule,
    knownEventTypes.raisedBedFields.plantUpdate,
    knownEventTypes.raisedBedFields.plantReplaceSort,
] as const;

/**
 * Remove all plant-lifecycle events for a single field position.
 *
 * Sandbox fields are decoration only and keep no history, so each sow starts
 * from a clean slate. This guarantees a single plant cycle and avoids the
 * backdated sow date sorting a replant behind a previous (younger) plant.
 */
async function deleteRaisedBedFieldEvents(aggregateId: string) {
    await storage()
        .delete(events)
        .where(
            and(
                eq(events.aggregateId, aggregateId),
                inArray(events.type, [...RAISED_BED_FIELD_EVENT_TYPES]),
            ),
        );
}

export async function sowSandboxField({
    raisedBedId,
    positionIndex,
    plantSortId,
    sowDate,
    status = 'ready',
}: {
    raisedBedId: number;
    positionIndex: number;
    plantSortId: number;
    sowDate: Date;
    status?: string;
}) {
    const aggregateId = `${raisedBedId}|${positionIndex}`;

    await upsertRaisedBedField({ raisedBedId, positionIndex });
    // Start from a clean slate so the new plant is always the current cycle,
    // regardless of how far its (backdated) sow date is in the past.
    await deleteRaisedBedFieldEvents(aggregateId);
    await createEvent({
        ...knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: plantSortId.toString(),
            scheduledDate: null,
        }),
        createdAt: sowDate,
    });
    // A `sowed` status update is what makes the derivation set `plantSowDate`,
    // which drives the rendered plant age/generation.
    await createEvent({
        ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'sowed',
        }),
        createdAt: sowDate,
    });
    if (status && status !== 'sowed') {
        await createEvent({
            ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
                status,
            }),
            createdAt: sowDate,
        });
    }
    await bustScheduleCache();
}

/**
 * Clear a sandbox field: soft-delete the field row and drop its plant events so
 * the position is truly empty (and a later replant starts fresh).
 */
export async function clearSandboxField(
    raisedBedId: number,
    positionIndex: number,
) {
    await deleteRaisedBedField(raisedBedId, positionIndex);
    await deleteRaisedBedFieldEvents(`${raisedBedId}|${positionIndex}`);
    await bustScheduleCache();
}

function normalizeSandboxGardenDeleteBatchSize(batchSize?: number) {
    return Math.max(
        1,
        Math.floor(batchSize ?? DEFAULT_SANDBOX_GARDEN_DELETE_BATCH_SIZE),
    );
}

async function getSandboxRaisedBedIds(gardenId: number, batchSize: number) {
    const rows = await storage()
        .select({ id: raisedBeds.id })
        .from(raisedBeds)
        .where(eq(raisedBeds.gardenId, gardenId))
        .limit(batchSize);
    return rows.map((row) => row.id);
}

async function getSandboxRaisedBedFieldIds(
    raisedBedIds: number[],
    batchSize: number,
) {
    if (raisedBedIds.length === 0) {
        return [];
    }

    const rows = await storage()
        .select({ id: raisedBedFields.id })
        .from(raisedBedFields)
        .where(inArray(raisedBedFields.raisedBedId, raisedBedIds))
        .limit(batchSize);
    return rows.map((row) => row.id);
}

async function getSandboxGardenBlockIds(gardenId: number, batchSize: number) {
    const rows = await storage()
        .select({ id: gardenBlocks.id })
        .from(gardenBlocks)
        .where(eq(gardenBlocks.gardenId, gardenId))
        .limit(batchSize);
    return rows.map((row) => row.id);
}

async function deleteSandboxNotificationBatch({
    batchSize,
    blockIds,
    gardenId,
    raisedBedIds,
}: {
    batchSize: number;
    blockIds: string[];
    gardenId: number;
    raisedBedIds: number[];
}) {
    const byGarden = await storage()
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.gardenId, gardenId))
        .limit(batchSize);
    if (byGarden.length > 0) {
        await storage()
            .delete(notifications)
            .where(
                inArray(
                    notifications.id,
                    byGarden.map((row) => row.id),
                ),
            );
        return byGarden.length;
    }

    if (raisedBedIds.length > 0) {
        const byRaisedBed = await storage()
            .select({ id: notifications.id })
            .from(notifications)
            .where(inArray(notifications.raisedBedId, raisedBedIds))
            .limit(batchSize);
        if (byRaisedBed.length > 0) {
            await storage()
                .delete(notifications)
                .where(
                    inArray(
                        notifications.id,
                        byRaisedBed.map((row) => row.id),
                    ),
                );
            return byRaisedBed.length;
        }
    }

    if (blockIds.length > 0) {
        const byBlock = await storage()
            .select({ id: notifications.id })
            .from(notifications)
            .where(inArray(notifications.blockId, blockIds))
            .limit(batchSize);
        if (byBlock.length > 0) {
            await storage()
                .delete(notifications)
                .where(
                    inArray(
                        notifications.id,
                        byBlock.map((row) => row.id),
                    ),
                );
            return byBlock.length;
        }
    }

    return 0;
}

async function deleteSandboxShoppingCartItemBatch({
    batchSize,
    gardenId,
    raisedBedIds,
}: {
    batchSize: number;
    gardenId: number;
    raisedBedIds: number[];
}) {
    const byGarden = await storage()
        .select({ id: shoppingCartItems.id })
        .from(shoppingCartItems)
        .where(eq(shoppingCartItems.gardenId, gardenId))
        .limit(batchSize);
    if (byGarden.length > 0) {
        await storage()
            .delete(shoppingCartItems)
            .where(
                inArray(
                    shoppingCartItems.id,
                    byGarden.map((row) => row.id),
                ),
            );
        return byGarden.length;
    }

    if (raisedBedIds.length === 0) {
        return 0;
    }

    const byRaisedBed = await storage()
        .select({ id: shoppingCartItems.id })
        .from(shoppingCartItems)
        .where(inArray(shoppingCartItems.raisedBedId, raisedBedIds))
        .limit(batchSize);
    if (byRaisedBed.length <= 0) {
        return 0;
    }

    await storage()
        .delete(shoppingCartItems)
        .where(
            inArray(
                shoppingCartItems.id,
                byRaisedBed.map((row) => row.id),
            ),
        );
    return byRaisedBed.length;
}

async function deleteSandboxTransactionBatch(
    gardenId: number,
    batchSize: number,
) {
    const rows = await storage()
        .select({ id: transactions.id })
        .from(transactions)
        .where(eq(transactions.gardenId, gardenId))
        .limit(batchSize);
    if (rows.length <= 0) {
        return 0;
    }

    await storage()
        .delete(transactions)
        .where(
            inArray(
                transactions.id,
                rows.map((row) => row.id),
            ),
        );
    return rows.length;
}

async function deleteEventRowsByIds(eventIds: number[]) {
    if (eventIds.length === 0) {
        return 0;
    }

    await storage().delete(events).where(inArray(events.id, eventIds));
    return eventIds.length;
}

async function deleteSandboxOperationBatch({
    batchSize,
    fieldIds,
    gardenId,
    raisedBedIds,
}: {
    batchSize: number;
    fieldIds: number[];
    gardenId: number;
    raisedBedIds: number[];
}) {
    const operationRows =
        raisedBedIds.length > 0 && fieldIds.length > 0
            ? await storage()
                  .select({ id: operations.id })
                  .from(operations)
                  .where(
                      or(
                          eq(operations.gardenId, gardenId),
                          inArray(operations.raisedBedId, raisedBedIds),
                          inArray(operations.raisedBedFieldId, fieldIds),
                      ),
                  )
                  .limit(batchSize)
            : raisedBedIds.length > 0
              ? await storage()
                    .select({ id: operations.id })
                    .from(operations)
                    .where(
                        or(
                            eq(operations.gardenId, gardenId),
                            inArray(operations.raisedBedId, raisedBedIds),
                        ),
                    )
                    .limit(batchSize)
              : await storage()
                    .select({ id: operations.id })
                    .from(operations)
                    .where(eq(operations.gardenId, gardenId))
                    .limit(batchSize);

    if (operationRows.length <= 0) {
        return 0;
    }

    const operationAggregateIds = operationRows.map((row) => row.id.toString());
    const operationEventRows = await storage()
        .select({ id: events.id })
        .from(events)
        .where(
            and(
                inArray(events.type, OPERATION_EVENT_TYPES),
                inArray(events.aggregateId, operationAggregateIds),
            ),
        )
        .limit(batchSize);
    if (operationEventRows.length > 0) {
        return deleteEventRowsByIds(operationEventRows.map((row) => row.id));
    }

    await storage()
        .delete(operations)
        .where(
            inArray(
                operations.id,
                operationRows.map((row) => row.id),
            ),
        );
    return operationRows.length;
}

async function deleteSandboxInventoryEventBatch({
    accountId,
    batchSize,
    gardenId,
}: {
    accountId: string;
    batchSize: number;
    gardenId: number;
}) {
    const rows = await storage()
        .select({ id: events.id })
        .from(events)
        .where(
            and(
                inArray(events.type, INVENTORY_EVENT_TYPES),
                like(
                    events.aggregateId,
                    `${INVENTORY_PREFIX}${accountId}:gardenBox:${gardenId.toString()}:%`,
                ),
            ),
        )
        .limit(batchSize);
    return deleteEventRowsByIds(rows.map((row) => row.id));
}

async function deleteSandboxRaisedBedFieldEventBatch(
    raisedBedIds: number[],
    batchSize: number,
) {
    if (raisedBedIds.length === 0) {
        return 0;
    }

    const raisedBedFieldEventRows = await storage()
        .select({ id: events.id })
        .from(events)
        .where(
            and(
                inArray(events.type, SANDBOX_RAISED_BED_FIELD_EVENT_TYPES),
                or(
                    ...raisedBedIds.map((raisedBedId) =>
                        like(events.aggregateId, `${raisedBedId.toString()}|%`),
                    ),
                ),
            ),
        )
        .limit(batchSize);
    return deleteEventRowsByIds(raisedBedFieldEventRows.map((row) => row.id));
}

async function deleteSandboxRaisedBedEventBatch(
    raisedBedIds: number[],
    batchSize: number,
) {
    if (raisedBedIds.length === 0) {
        return 0;
    }

    const rows = await storage()
        .select({ id: events.id })
        .from(events)
        .where(
            and(
                inArray(events.type, RAISED_BED_EVENT_TYPES),
                inArray(
                    events.aggregateId,
                    raisedBedIds.map((raisedBedId) => raisedBedId.toString()),
                ),
            ),
        )
        .limit(batchSize);
    return deleteEventRowsByIds(rows.map((row) => row.id));
}

async function deleteSandboxGardenEventBatch(
    gardenId: number,
    batchSize: number,
) {
    const rows = await storage()
        .select({ id: events.id })
        .from(events)
        .where(
            and(
                inArray(events.type, GARDEN_EVENT_TYPES),
                eq(events.aggregateId, gardenId.toString()),
            ),
        )
        .limit(batchSize);
    return deleteEventRowsByIds(rows.map((row) => row.id));
}

async function deleteSandboxRaisedBedSensorBatch(
    raisedBedIds: number[],
    batchSize: number,
) {
    if (raisedBedIds.length === 0) {
        return 0;
    }

    const rows = await storage()
        .select({ id: raisedBedSensors.id })
        .from(raisedBedSensors)
        .where(inArray(raisedBedSensors.raisedBedId, raisedBedIds))
        .limit(batchSize);
    if (rows.length <= 0) {
        return 0;
    }

    await storage()
        .delete(raisedBedSensors)
        .where(
            inArray(
                raisedBedSensors.id,
                rows.map((row) => row.id),
            ),
        );
    return rows.length;
}

async function deleteSandboxRaisedBedFieldBatch(
    raisedBedIds: number[],
    batchSize: number,
) {
    if (raisedBedIds.length === 0) {
        return 0;
    }

    const rows = await storage()
        .select({ id: raisedBedFields.id })
        .from(raisedBedFields)
        .where(inArray(raisedBedFields.raisedBedId, raisedBedIds))
        .limit(batchSize);
    if (rows.length <= 0) {
        return 0;
    }

    await storage()
        .delete(raisedBedFields)
        .where(
            inArray(
                raisedBedFields.id,
                rows.map((row) => row.id),
            ),
        );
    return rows.length;
}

async function deleteSandboxRaisedBedBatch(
    gardenId: number,
    batchSize: number,
) {
    const rows = await storage()
        .select({ id: raisedBeds.id })
        .from(raisedBeds)
        .where(eq(raisedBeds.gardenId, gardenId))
        .limit(batchSize);
    if (rows.length <= 0) {
        return 0;
    }

    await storage()
        .delete(raisedBeds)
        .where(
            inArray(
                raisedBeds.id,
                rows.map((row) => row.id),
            ),
        );
    return rows.length;
}

async function deleteSandboxGardenStackBatch(
    gardenId: number,
    batchSize: number,
) {
    const rows = await storage()
        .select({ id: gardenStacks.id })
        .from(gardenStacks)
        .where(eq(gardenStacks.gardenId, gardenId))
        .limit(batchSize);
    if (rows.length <= 0) {
        return 0;
    }

    await storage()
        .delete(gardenStacks)
        .where(
            inArray(
                gardenStacks.id,
                rows.map((row) => row.id),
            ),
        );
    return rows.length;
}

async function deleteSandboxGardenBlockBatch(
    gardenId: number,
    batchSize: number,
) {
    const rows = await storage()
        .select({ id: gardenBlocks.id })
        .from(gardenBlocks)
        .where(eq(gardenBlocks.gardenId, gardenId))
        .limit(batchSize);
    if (rows.length <= 0) {
        return 0;
    }

    await storage()
        .delete(gardenBlocks)
        .where(
            inArray(
                gardenBlocks.id,
                rows.map((row) => row.id),
            ),
        );
    return rows.length;
}

async function deleteNextSandboxGardenDependencyBatch(
    garden: typeof gardens.$inferSelect,
    batchSize: number,
) {
    const [raisedBedIds, blockIds] = await Promise.all([
        getSandboxRaisedBedIds(garden.id, batchSize),
        getSandboxGardenBlockIds(garden.id, batchSize),
    ]);
    const fieldIds = await getSandboxRaisedBedFieldIds(raisedBedIds, batchSize);

    const notificationRows = await deleteSandboxNotificationBatch({
        batchSize,
        blockIds,
        gardenId: garden.id,
        raisedBedIds,
    });
    if (notificationRows > 0) {
        return notificationRows;
    }

    const cartItemRows = await deleteSandboxShoppingCartItemBatch({
        batchSize,
        gardenId: garden.id,
        raisedBedIds,
    });
    if (cartItemRows > 0) {
        return cartItemRows;
    }

    const transactionRows = await deleteSandboxTransactionBatch(
        garden.id,
        batchSize,
    );
    if (transactionRows > 0) {
        return transactionRows;
    }

    const operationRows = await deleteSandboxOperationBatch({
        batchSize,
        fieldIds,
        gardenId: garden.id,
        raisedBedIds,
    });
    if (operationRows > 0) {
        return operationRows;
    }

    const inventoryEventRows = await deleteSandboxInventoryEventBatch({
        accountId: garden.accountId,
        batchSize,
        gardenId: garden.id,
    });
    if (inventoryEventRows > 0) {
        return inventoryEventRows;
    }

    const fieldEventRows = await deleteSandboxRaisedBedFieldEventBatch(
        raisedBedIds,
        batchSize,
    );
    if (fieldEventRows > 0) {
        return fieldEventRows;
    }

    const raisedBedEventRows = await deleteSandboxRaisedBedEventBatch(
        raisedBedIds,
        batchSize,
    );
    if (raisedBedEventRows > 0) {
        return raisedBedEventRows;
    }

    const gardenEventRows = await deleteSandboxGardenEventBatch(
        garden.id,
        batchSize,
    );
    if (gardenEventRows > 0) {
        return gardenEventRows;
    }

    const sensorRows = await deleteSandboxRaisedBedSensorBatch(
        raisedBedIds,
        batchSize,
    );
    if (sensorRows > 0) {
        return sensorRows;
    }

    const fieldRows = await deleteSandboxRaisedBedFieldBatch(
        raisedBedIds,
        batchSize,
    );
    if (fieldRows > 0) {
        return fieldRows;
    }

    const raisedBedRows = await deleteSandboxRaisedBedBatch(
        garden.id,
        batchSize,
    );
    if (raisedBedRows > 0) {
        return raisedBedRows;
    }

    const stackRows = await deleteSandboxGardenStackBatch(garden.id, batchSize);
    if (stackRows > 0) {
        return stackRows;
    }

    return deleteSandboxGardenBlockBatch(garden.id, batchSize);
}

export function getSandboxGardenDeletionCandidate(gardenId: number) {
    return storage().query.gardens.findFirst({
        where: eq(gardens.id, gardenId),
    });
}

export async function deleteSandboxGardenCompletely(
    gardenId: number,
    options: DeleteSandboxGardenCompletelyOptions = {},
): Promise<DeleteSandboxGardenCompletelyResult> {
    const garden = await getSandboxGardenDeletionCandidate(gardenId);
    if (!garden) {
        return { batches: 0, complete: true, deletedRows: 0 };
    }
    if (!garden.isSandbox) {
        throw new Error('Only sandbox gardens can be deleted completely');
    }

    const batchSize = normalizeSandboxGardenDeleteBatchSize(options.batchSize);
    const maxBatches = Math.max(
        1,
        Math.floor(
            options.maxBatches ?? DEFAULT_SANDBOX_GARDEN_DELETE_MAX_BATCHES,
        ),
    );
    const maxDurationMs = Math.max(
        1,
        Math.floor(
            options.maxDurationMs ??
                DEFAULT_SANDBOX_GARDEN_DELETE_MAX_DURATION_MS,
        ),
    );
    const startedAt = Date.now();
    let batches = 0;
    let deletedRows = 0;

    await storage().transaction(async (tx) => {
        if (!garden.isDeleted) {
            await tx
                .update(gardens)
                .set({ isDeleted: true })
                .where(eq(gardens.id, garden.id));
        }
        await removeGardenPreviewAndQueueBlobDeletionUsing(
            tx,
            garden.id,
            'garden_deleted',
        );
    });

    while (batches < maxBatches && Date.now() - startedAt < maxDurationMs) {
        const deletedBatchRows = await deleteNextSandboxGardenDependencyBatch(
            garden,
            batchSize,
        );
        if (deletedBatchRows === 0) {
            await storage().delete(gardens).where(eq(gardens.id, garden.id));
            await bustScheduleCache();
            return {
                batches,
                complete: true,
                deletedRows,
            };
        }

        batches += 1;
        deletedRows += deletedBatchRows;
    }

    if (deletedRows > 0) {
        await bustScheduleCache();
    }

    return {
        batches,
        complete: false,
        deletedRows,
    };
}
