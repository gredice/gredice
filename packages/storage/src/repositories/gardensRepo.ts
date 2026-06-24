import 'server-only';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { v4 as uuidV4 } from 'uuid';
import { storage } from '..';
import { bustScheduleCache } from '../cache/scheduleCache';
import {
    gardenBlocks,
    gardenStacks,
    gardens,
    type InsertGarden,
    raisedBeds,
    type UpdateGarden,
    type UpdateGardenBlock,
    type UpdateGardenStack,
} from '../schema';
import { createEvent, knownEvents } from './eventsRepo';
import { getFarms } from './farmsRepo';
import {
    createRaisedBed,
    getRaisedBeds,
    getRaisedBedsForGardens,
} from './raisedBedsRepo';

export * from './raisedBedDiaryRepo';
export * from './raisedBedFieldsRepo';
export * from './raisedBedsRepo';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = TransactionClient | StorageClient;

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

export async function accountHasActiveRaisedBed(accountId: string) {
    const result = await storage()
        .select({ count: count() })
        .from(raisedBeds)
        .innerJoin(gardens, eq(raisedBeds.gardenId, gardens.id))
        .where(
            and(
                eq(gardens.accountId, accountId),
                eq(gardens.isDeleted, false),
                eq(raisedBeds.status, 'active'),
                eq(raisedBeds.isDeleted, false),
            ),
        );

    return (result[0]?.count ?? 0) > 0;
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
    const raisedBedsByGardenId = await getRaisedBedsForGardens(
        accountGardens.map((garden) => garden.id),
        filter,
    );
    // For each raised bed, fetch and attach fields with event-sourced info
    return accountGardens.map((garden) => ({
        ...garden,
        raisedBeds: raisedBedsByGardenId.get(garden.id) ?? [],
    }));
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
        console.warn('Garden stack not found', {
            gardenId,
            x: stacks.x,
            y: stacks.y,
        });
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
