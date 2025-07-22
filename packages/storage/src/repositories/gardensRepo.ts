import 'server-only';
import { and, count, desc, eq } from "drizzle-orm";
import { getEntitiesFormatted, getOperations, storage } from "..";
import { gardenBlocks, gardens, gardenStacks, raisedBeds, InsertGarden, UpdateGarden, UpdateGardenBlock, UpdateGardenStack, InsertRaisedBed, UpdateRaisedBed } from "../schema";
import { createEvent, knownEvents, knownEventTypes } from './eventsRepo';
import { v4 as uuidV4 } from 'uuid';
import { getEvents } from './eventsRepo';
import { raisedBedFields, InsertRaisedBedField, raisedBedSensors, UpdateRaisedBedSensor, InsertRaisedBedSensor } from '../schema/gardenSchema';
import { generateRaisedBedName } from '../helpers/generateRaisedBedName';
import { EntityStandardized } from '../@types/EntityStandardized';

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
    const accountGardens = await storage().query.gardens.findMany({
        where: and(
            eq(gardens.accountId, accountId),
            eq(gardens.isDeleted, false)
        )
    });
    // For each raised bed, fetch and attach fields with event-sourced info
    return Promise.all(accountGardens.map(async (garden) => {
        return {
            ...garden,
            raisedBeds: await getRaisedBeds(garden.id)
        };
    }));
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

export async function deleteGardenStacks(gardenId: number) {
    await storage()
        .update(gardenStacks)
        .set({ isDeleted: true })
        .where(eq(gardenStacks.gardenId, gardenId));
}

export async function createRaisedBed(raisedBed: Omit<InsertRaisedBed, 'name'>) {
    return (await storage()
        .insert(raisedBeds)
        .values({
            ...raisedBed,
            name: generateRaisedBedName()
        })
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

    // Retrieve all events in bulk
    const fieldAggregateIds = fields.map(field => `${field.raisedBedId}|${field.positionIndex}`);
    const fieldsEvents = await getEvents([
        knownEventTypes.raisedBedFields.create,
        knownEventTypes.raisedBedFields.delete,
        knownEventTypes.raisedBedFields.plantPlace,
        knownEventTypes.raisedBedFields.plantUpdate,
    ], fieldAggregateIds, 0, 10000);

    // For each field, fetch and apply events
    return fields.map((field) => {
        const aggregateId = `${field.raisedBedId}|${field.positionIndex}`;
        const events = fieldsEvents.filter(event => event.aggregateId === aggregateId);

        // Reduce events to get latest status, plant info, etc.
        let plantStatus: string | undefined = undefined;
        let plantSortId: number | undefined = undefined;
        let plantScheduledDate: Date | undefined = undefined;
        let plantSowDate: Date | undefined = undefined;
        let plantGrowthDate: Date | undefined = undefined;
        let plantReadyDate: Date | undefined = undefined;

        // TODO: Implement multiple handling
        // let operationId = undefined;
        // let operationStatus = undefined;

        for (const event of events) {
            const data = event.data as Record<string, any> | undefined;
            if (event.type === knownEventTypes.raisedBedFields.plantPlace) {
                if (data?.plantSortId) {
                    plantSortId = parseInt(data.plantSortId, 10)
                }
                plantScheduledDate = data?.scheduledDate || plantScheduledDate;
                plantStatus = "new";
            }
            else if (event.type === knownEventTypes.raisedBedFields.plantUpdate) {
                plantStatus = data?.status ?? plantStatus;
                if (plantStatus === 'sowed') {
                    plantSowDate = event.createdAt;
                } else if (plantStatus === 'sprouted') {
                    plantGrowthDate = event.createdAt;
                } else if (plantStatus === 'ready') {
                    plantReadyDate = event.createdAt;
                }
            }
            // else if (event.type === knownEventTypes.raisedBedFields.operationOrder) {
            //     operationId = data?.orderId;
            //     operationStatus = data?.status || operationStatus;
            // }
            else if (event.type === knownEventTypes.raisedBedFields.delete) {
                plantStatus = 'deleted';
                plantSowDate = undefined;
                plantSortId = undefined;
                plantScheduledDate = undefined;
            }
            else {
                console.warn(`Unhandled event type: ${event.type} for field ${field.id}`);
            }
        }

        return {
            ...field,
            plantStatus,
            plantSortId,
            plantScheduledDate,
            plantSowDate,
            plantGrowthDate,
            plantReadyDate,
        };
    });
}

export async function getRaisedBedDiaryEntries(raisedBedId: number) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found`);
    }

    const raisedBedsEventDiaryEntries = (await getEvents([
        knownEventTypes.raisedBeds.create,
        knownEventTypes.raisedBeds.delete,
    ], [raisedBedId.toString()], 0, 10000))
        .map((event) => ({
            id: event.id,
            name: event.type === knownEventTypes.raisedBeds.create ? 'Gredica stvorena' : 'Gredica obrisana',
            description: '',
            status: null,
            timestamp: event.createdAt,
        }))
        .filter(op => op.name);
    const operationsData = await getEntitiesFormatted<EntityStandardized>('operation');
    const operations = await getOperations(raisedBed.accountId, raisedBed.gardenId, raisedBedId);
    const operationsDiaryEntries = operations
        .map(op => ({
            id: op.id,
            name: operationsData?.find(opData => opData.id === op.entityId)?.information?.label,
            description: operationsData?.find(opData => opData.id === op.entityId)?.information?.shortDescription,
            status: op.status === 'completed' ? 'Završeno' : op.status === 'planned' ? 'Planirano' : 'U tijeku...',
            timestamp: op.completedAt ?? op.scheduledDate ?? op.createdAt,
        }))
        .filter(op => op.name)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return [
        ...raisedBedsEventDiaryEntries,
        ...operationsDiaryEntries
    ];
}

export async function updateRaisedBed(raisedBed: UpdateRaisedBed) {
    await storage().update(raisedBeds).set(raisedBed).where(eq(raisedBeds.id, raisedBed.id));
}

export async function deleteRaisedBed(raisedBedId: number) {
    await storage().update(raisedBeds).set({ isDeleted: true }).where(eq(raisedBeds.id, raisedBedId));
}

export async function getAllRaisedBeds() {
    const allRaisedBeds = await storage().query.raisedBeds.findMany({
        where: and(
            eq(raisedBeds.isDeleted, false),
            eq(raisedBeds.isDeleted, false)
        )
    });
    const fields = (await Promise.all(allRaisedBeds.map(r => r.id).map(getRaisedBedFieldsWithEvents))).flatMap(fields => fields);
    return allRaisedBeds.map(raisedBed => ({
        ...raisedBed,
        fields: fields.filter(field => field.raisedBedId === raisedBed.id)
    }));
}

export async function upsertRaisedBedField(field: Omit<InsertRaisedBedField, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) {
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

export function getRaisedBedSensors(raisedBedId: number) {
    return storage().query.raisedBedSensors.findMany({
        where: and(
            eq(raisedBedSensors.raisedBedId, raisedBedId),
            eq(raisedBedSensors.isDeleted, false)
        )
    });
}

export function createRaisedBedSensor(data: InsertRaisedBedSensor) {
    return storage().insert(raisedBedSensors).values({
        ...data
    }).returning({
        id: raisedBedSensors.id
    });
}

export async function updateRaisedBedSensor(data: UpdateRaisedBedSensor) {
    await storage()
        .update(raisedBedSensors)
        .set({
            ...data,
        }).where(and(
            eq(raisedBedSensors.id, data.id),
            eq(raisedBedSensors.isDeleted, false)
        ));
}