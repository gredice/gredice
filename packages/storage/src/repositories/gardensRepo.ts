import 'server-only';
import { and, eq } from "drizzle-orm";
import { storage } from "..";
import { gardens, gardenStacks, InsertGarden, UpdateGarden, UpdateGardenStack } from "../schema/gardenSchema";
import { createEvent, knownEvents } from './eventsRepo';

export async function createGarden(garden: InsertGarden) {
    const createdGarden = (await storage
        .insert(gardens)
        .values(garden)
        .returning({ id: gardens.id, name: gardens.name, accountId: gardens.accountId }))[0];
    if (!createdGarden) {
        throw new Error('Failed to create garden');
    }

    await createEvent(knownEvents.gardens.createdV1(
        createdGarden.id.toString(),
        {
            name: createdGarden.name,
            accountId: createdGarden.accountId
        }));

    return createdGarden;
}

export async function getGardens() {
    return await storage.query.gardens.findMany();
}

export async function getAccountGardens(accountId: string) {
    return await storage.query.gardens.findMany({
        where: and(eq(gardens.accountId, accountId), eq(gardens.isDeleted, false))
    });
}

export async function getGarden(gardenId: number) {
    return await storage.query.gardens.findFirst({
        where: and(eq(gardens.id, gardenId), eq(gardens.isDeleted, false)),
        with: {
            farm: true,
            stacks: true
        }
    });
}

export async function updateGarden(garden: UpdateGarden) {
    await storage.update(gardens).set(garden).where(eq(gardens.id, garden.id));

    if (garden.name) {
        await createEvent(knownEvents.gardens.renamedV1(garden.id.toString(), { name: garden.name }));
    }
}

export async function deleteGarden(gardenId: number) {
    await storage.update(gardens).set({ isDeleted: true }).where(eq(gardens.id, gardenId));
    await createEvent(knownEvents.gardens.deletedV1(gardenId.toString()));
}

export async function createGardenBlock(gardenId: number, blockId: string, blockName: string) {
    const garden = await getGarden(gardenId);
    if (!garden) {
        throw new Error('Garden not found');
    }

    await createEvent(knownEvents.gardens.blockPlacedV1(gardenId.toString(), { id: blockId, name: blockName }));
}

export async function getGardenStacks(gardenId: number) {
    return await storage.query.gardenStacks.findMany({
        where: and(eq(gardenStacks.gardenId, gardenId), eq(gardenStacks.isDeleted, false))
    });
}

export async function getGardenStack(gardenId: number, { x, y }: { x: number, y: number }) {
    return await storage.query.gardenStacks.findFirst({
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
    const existingStacks = await storage.query.gardenStacks.findMany({
        where: and(eq(gardenStacks.gardenId, gardenId), eq(gardenStacks.positionX, x), eq(gardenStacks.positionY, y), eq(gardenStacks.isDeleted, false))
    });
    if (existingStacks.length > 0) {
        throw new Error('Stack already exists');
    }

    await storage
        .insert(gardenStacks)
        .values({ gardenId, positionX: x, positionY: y });
}

export async function updateGardenStack(gardenId: number, stacks: Omit<UpdateGardenStack, 'id'> & { x: number, y: number }) {
    const stackId = (await storage.query.gardenStacks.findFirst({
        where: and(eq(gardenStacks.gardenId, gardenId), eq(gardenStacks.positionX, stacks.x), eq(gardenStacks.positionY, stacks.y), eq(gardenStacks.isDeleted, false))
    }))?.id;
    if (!stackId) {
        throw new Error('Stack not found');
    }

    await storage.update(gardenStacks).set({
        blocks: stacks.blocks,
    }).where(and(eq(gardenStacks.gardenId, gardenId), eq(gardenStacks.id, stackId)));
}

export async function deleteGardenStack(gardenId: number, { x, y }: { x: number, y: number }) {
    await storage
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
