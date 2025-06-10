import 'server-only';
import { and, count, desc, eq } from "drizzle-orm";
import { storage } from "..";
import { gardenBlocks, gardens, gardenStacks, raisedBeds, InsertGarden, UpdateGarden, UpdateGardenBlock, UpdateGardenStack, InsertRaisedBed, UpdateRaisedBed } from "../schema";
import { createEvent, knownEvents } from './eventsRepo';
import { v4 as uuidV4 } from 'uuid';

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
    return storage().query.gardens.findFirst({
        where: and(eq(gardens.id, gardenId), eq(gardens.isDeleted, false)),
        with: {
            farm: true,
            stacks: true,
            raisedBeds: true
        }
    });
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
    return storage().query.gardenBlocks.findFirst({
        where: and(
            eq(gardenBlocks.gardenId, gardenId),
            eq(gardenBlocks.id, blockId),
            eq(gardenBlocks.isDeleted, false)
        )
    });
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
    return storage().query.gardenStacks.findFirst({
        where: and(
            eq(gardenStacks.gardenId, gardenId),
            eq(gardenStacks.positionX, x),
            eq(gardenStacks.positionY, y),
            eq(gardenStacks.isDeleted, false)
        )
    });
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
    return storage().query.raisedBeds.findMany({
        where: and(
            eq(raisedBeds.gardenId, gardenId),
            eq(raisedBeds.isDeleted, false)
        ),
    });
}

export async function getRaisedBed(raisedBedId: number) {
    return storage().query.raisedBeds.findFirst({
        where: and(eq(raisedBeds.id, raisedBedId), eq(raisedBeds.isDeleted, false))
    });
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
