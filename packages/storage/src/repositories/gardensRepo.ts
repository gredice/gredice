import 'server-only';
import { and, count, desc, eq } from "drizzle-orm";
import { storage } from "..";
import { gardenBlocks, gardens, gardenStacks, raisedBeds, InsertGarden, UpdateGarden, UpdateGardenBlock, UpdateGardenStack, InsertRaisedBed, UpdateRaisedBed } from "../schema";
import { createEvent, knownEvents, knownEventTypes } from './eventsRepo';
import { v4 as uuidV4 } from 'uuid';
import { getEvents } from './eventsRepo';
import { raisedBedFields, InsertRaisedBedField } from '../schema/gardenSchema';

export async function createGarden(garden: InsertGarden) {
    const createdGarden = (await storage()
        .insert(gardens)
        .values(garden)
        .returning({
            id: gardens.id,
            name: gardens.name,
            accountId: gardens.accountId
        }))[0];
    if (!createdGarden) {
        throw new Error('Failed to create garden');
    }

    await createEvent(knownEvents.gardens.createdV1(
        createdGarden.id.toString(),
        {
            name: createdGarden.name,
            accountId: createdGarden.accountId
        }));

    return createdGarden.id;
}

export async function getGardens() {
    return storage().query.gardens.findMany({
        orderBy: desc(gardens.createdAt)
    });
}

export async function getAccountGardens(accountId: string) {
    return storage().query.gardens.findMany({
        where: and(
            eq(gardens.accountId, accountId),
            eq(gardens.isDeleted, false)
        ),
        with: {
            raisedBeds: true
        }
    });
}

export async function getGarden(gardenId: number) {
    const [garden, raisedBeds] = await Promise.all([
        storage().query.gardens.findFirst({
            where: and(eq(gardens.id, gardenId), eq(gardens.isDeleted, false)),
            with: {
                farm: true,
                stacks: true
            }
        }),
        getRaisedBeds(gardenId)
    ]);
    if (!garden) {
        return null;
    }
    // Attach raised beds with event-sourced info
    return {
        ...garden,
        raisedBeds
    }
}

export async function updateGarden(garden: UpdateGarden) {
    await storage().update(gardens).set(garden).where(eq(gardens.id, garden.id));

    if (garden.name) {
        await createEvent(knownEvents.gardens.renamedV1(garden.id.toString(), { name: garden.name }));
    }
}

export async function deleteGarden(gardenId: number) {
    await storage().update(gardens).set({ isDeleted: true }).where(eq(gardens.id, gardenId));
    await createEvent(knownEvents.gardens.deletedV1(gardenId.toString()));
}

export async function getGardenBlocks(gardenId: number) {
    return storage().query.gardenBlocks.findMany({
        where: and(eq(gardenBlocks.gardenId, gardenId), eq(gardenBlocks.isDeleted, false))
    });
}

export async function getGardenBlock(gardenId: number, blockId: string) {
    return await storage().query.gardenBlocks.findFirst({
        where: and(
            eq(gardenBlocks.gardenId, gardenId),
            eq(gardenBlocks.id, blockId),
            eq(gardenBlocks.isDeleted, false)
        )
    }) ?? null;
}

export async function createGardenBlock(gardenId: number, blockName: string) {
    const blockId = uuidV4();

    await Promise.all([
        storage().insert(gardenBlocks).values({
            id: blockId,
            gardenId,
            name: blockName
        }),
        await createEvent(knownEvents.gardens.blockPlacedV1(gardenId.toString(), { id: blockId, name: blockName }))
    ]);

    return blockId;
}

export async function updateGardenBlock({ id, ...values }: UpdateGardenBlock) {
    await storage()
        .update(gardenBlocks)
        .set({
            ...values
        })
        .where(eq(gardenBlocks.id, id));
}

export async function deleteGardenBlock(gardenId: number, blockId: string) {
    await storage()
        .update(gardenBlocks)
        .set({ isDeleted: true })
        .where(
            and(
                eq(gardenBlocks.gardenId, gardenId),
                eq(gardenBlocks.id, blockId)
            )
        );
    await createEvent(knownEvents.gardens.blockRemovedV1(gardenId.toString(), { id: blockId }));
}

export async function getGardenStacks(gardenId: number) {
    return storage().query.gardenStacks.findMany({
        where: and(eq(gardenStacks.gardenId, gardenId), eq(gardenStacks.isDeleted, false))
    });
}

export async function getGardenStack(gardenId: number, { x, y }: { x: number, y: number }) {
    return await storage().query.gardenStacks.findFirst({
        where: and(
            eq(gardenStacks.gardenId, gardenId),
            eq(gardenStacks.positionX, x),
            eq(gardenStacks.positionY, y),
            eq(gardenStacks.isDeleted, false)
        )
    }) ?? null;
}

export async function createGardenStack(gardenId: number, { x, y }: { x: number, y: number }) {
    // Check if stack at location already exists
    const [{ count: existingStacksCount }] = await storage()
        .select({ count: count() })
        .from(gardenStacks)
        .where(
            and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.positionX, x),
                eq(gardenStacks.positionY, y),
                eq(gardenStacks.isDeleted, false)));
    if (existingStacksCount > 0) {
        return false;
    }

    await storage()
        .insert(gardenStacks)
        .values({ gardenId, positionX: x, positionY: y });
    return true;
}

export async function updateGardenStack(gardenId: number, stacks: Omit<UpdateGardenStack, 'id'> & { x: number, y: number }) {
    const stackId = (await storage().query.gardenStacks.findFirst({
        where: and(eq(gardenStacks.gardenId, gardenId), eq(gardenStacks.positionX, stacks.x), eq(gardenStacks.positionY, stacks.y), eq(gardenStacks.isDeleted, false))
    }))?.id;
    if (!stackId) {
        throw new Error('Stack not found');
    }

    await storage().update(gardenStacks).set({
        blocks: stacks.blocks,
    }).where(and(eq(gardenStacks.gardenId, gardenId), eq(gardenStacks.id, stackId)));
}

export async function deleteGardenStack(gardenId: number, { x, y }: { x: number, y: number }) {
    await storage()
        .update(gardenStacks)
        .set({ isDeleted: true })
        .where(
            and(
                eq(gardenStacks.gardenId, gardenId),
                eq(gardenStacks.positionX, x),
                eq(gardenStacks.positionY, y)
            )
        );
}

export async function createRaisedBed(raisedBed: InsertRaisedBed) {
    return (await storage()
        .insert(raisedBeds)
        .values(raisedBed)
        .returning({ id: raisedBeds.id }))[0].id;
}

export async function getRaisedBeds(gardenId: number) {
    const beds = await storage().query.raisedBeds.findMany({
        where: and(
            eq(raisedBeds.gardenId, gardenId),
            eq(raisedBeds.isDeleted, false)
        )
    });
    // For each raised bed, fetch and attach fields with event-sourced info
    return Promise.all(beds.map(async (bed) => {
        const fields = await getRaisedBedFieldsWithEvents(bed.id);
        return {
            ...bed,
            fields
        };
    }));
}

export async function getRaisedBed(raisedBedId: number) {
    const [raisedBed, fields] = await Promise.all([
        storage().query.raisedBeds.findFirst({
            where: and(eq(raisedBeds.id, raisedBedId), eq(raisedBeds.isDeleted, false))
        }),
        getRaisedBedFieldsWithEvents(raisedBedId)
    ]);
    if (!raisedBed) return null;
    // Attach raised bed fields with event-sourced info
    return {
        ...raisedBed,
        fields
    };
}

// New: Retrieve all raised bed fields for a single raised bed, with event-sourced info
export async function getRaisedBedFieldsWithEvents(raisedBedId: number) {
    const fields = await storage().query.raisedBedFields.findMany({
        where: and(
            eq(raisedBedFields.raisedBedId, raisedBedId),
            eq(raisedBedFields.isDeleted, false)
        ),
    });
    // For each field, fetch and apply events
    return Promise.all(fields.map(async (field) => {
        const aggregateId = `${field.raisedBedId}|${field.positionIndex}`;
        const events = await getEvents([
            knownEventTypes.raisedBedFields.create,
            knownEventTypes.raisedBedFields.update,
            knownEventTypes.raisedBedFields.delete,
            knownEventTypes.raisedBedFields.plantPlace,
            knownEventTypes.raisedBedFields.operationOrder,
        ], aggregateId);
        // Reduce events to get latest status, plant info, etc.
        let status = field.status;
        let plantId = undefined;
        let plantSortId = undefined;
        let orderId = undefined;
        for (const event of events.reverse()) {
            const data = event.data as Record<string, any> | undefined;
            if (event.type === 'raisedBedField.update' && data?.status) status = data.status;
            if (event.type === 'raisedBedField.plantPlace') {
                plantId = data?.plantId;
                plantSortId = data?.plantSortId;
                status = data?.status || status;
            }
            if (event.type === 'raisedBedField.operationOrder') {
                orderId = data?.orderId;
                status = data?.status || status;
            }
            if (event.type === 'raisedBedField.delete') status = 'deleted';
        }
        return { ...field, status, plantId, plantSortId, orderId };
    }));
}

export async function updateRaisedBed(raisedBed: UpdateRaisedBed) {
    await storage().update(raisedBeds).set(raisedBed).where(eq(raisedBeds.id, raisedBed.id));
}

export async function deleteRaisedBed(raisedBedId: number) {
    await storage().update(raisedBeds).set({ isDeleted: true }).where(eq(raisedBeds.id, raisedBedId));
}

export async function getAllRaisedBeds() {
    return storage().query.raisedBeds.findMany({
        where: and(
            eq(raisedBeds.isDeleted, false),
            eq(raisedBeds.isDeleted, false)
        )
    });
}

export async function upsertRaisedBedField(field: Omit<InsertRaisedBedField, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'> & { status?: string }) {
    // Try to update first
    const updated = await storage()
        .update(raisedBedFields)
        .set({ ...field, updatedAt: new Date() })
        .where(and(
            eq(raisedBedFields.raisedBedId, field.raisedBedId),
            eq(raisedBedFields.positionIndex, field.positionIndex),
            eq(raisedBedFields.isDeleted, false)
        ));
    if (updated.rowCount && updated.rowCount > 0) {
        return;
    }

    // If not updated, insert new
    await storage()
        .insert(raisedBedFields)
        .values(field)
        .onConflictDoNothing();
}

export async function deleteRaisedBedField(raisedBedId: number, positionIndex: number) {
    await storage().update(raisedBedFields).set({ isDeleted: true }).where(and(
        eq(raisedBedFields.raisedBedId, raisedBedId),
        eq(raisedBedFields.positionIndex, positionIndex),
        eq(raisedBedFields.isDeleted, false)
    ));
}
