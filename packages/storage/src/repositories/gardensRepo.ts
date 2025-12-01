import 'server-only';
import { plantFieldStatusLabel } from '@gredice/js/plants';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { v4 as uuidV4 } from 'uuid';
import { getEntitiesFormatted, getOperations, storage } from '..';
import type { EntityStandardized } from '../@types/EntityStandardized';
import { generateRaisedBedName } from '../helpers/generateRaisedBedName';
import {
    gardenBlocks,
    gardenStacks,
    gardens,
    type InsertGarden,
    type InsertRaisedBed,
    type RaisedBedOrientation,
    raisedBeds,
    type UpdateGarden,
    type UpdateGardenBlock,
    type UpdateGardenStack,
    type UpdateRaisedBed,
} from '../schema';
import {
    type InsertRaisedBedField,
    type InsertRaisedBedSensor,
    raisedBedFields,
    raisedBedSensors,
    type UpdateRaisedBedSensor,
} from '../schema/gardenSchema';
import {
    createEvent,
    getEvents,
    knownEvents,
    knownEventTypes,
} from './eventsRepo';

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

    return createdGarden.id;
}

export async function getGardens() {
    return storage().query.gardens.findMany({
        orderBy: desc(gardens.createdAt),
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
                stacks: true,
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
}

export async function deleteGarden(gardenId: number) {
    await storage()
        .update(gardens)
        .set({ isDeleted: true })
        .where(eq(gardens.id, gardenId));
    await createEvent(knownEvents.gardens.deletedV1(gardenId.toString()));
}

export async function getGardenBlocks(gardenId: number) {
    return storage().query.gardenBlocks.findMany({
        where: and(
            eq(gardenBlocks.gardenId, gardenId),
            eq(gardenBlocks.isDeleted, false),
        ),
    });
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
    db: ReturnType<typeof storage> = storage(),
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

export async function deleteGardenBlock(gardenId: number, blockId: string) {
    await storage()
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

export async function createGardenStack(
    gardenId: number,
    { x, y }: { x: number; y: number },
    db: ReturnType<typeof storage> = storage(),
) {
    // Check if stack at location already exists
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

    await db
        .insert(gardenStacks)
        .values({ gardenId, positionX: x, positionY: y });
    return true;
}

export async function updateGardenStack(
    gardenId: number,
    stacks: Omit<UpdateGardenStack, 'id'> & { x: number; y: number },
    db: ReturnType<typeof storage> = storage(),
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
    return (
        await storage()
            .insert(raisedBeds)
            .values({
                ...raisedBed,
                orientation: raisedBed.orientation ?? 'vertical',
                name: generateRaisedBedName(),
            })
            .returning({ id: raisedBeds.id })
    )[0].id;
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

    // For each raised bed, fetch and attach fields with event-sourced info
    return Promise.all(
        beds.map(async (bed) => {
            const fields = await getRaisedBedFieldsWithEvents(bed.id);
            return {
                ...bed,
                fields,
            };
        }),
    );
}

export async function getRaisedBed(raisedBedId: number) {
    const [raisedBed, fields] = await Promise.all([
        storage().query.raisedBeds.findFirst({
            where: and(
                eq(raisedBeds.id, raisedBedId),
                eq(raisedBeds.isDeleted, false),
            ),
        }),
        getRaisedBedFieldsWithEvents(raisedBedId),
    ]);
    if (!raisedBed) return null;
    // Attach raised bed fields with event-sourced info
    return {
        ...raisedBed,
        fields,
    };
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
    const fieldAggregateIds = fields.map(
        (field) => `${field.raisedBedId}|${field.positionIndex}`,
    );
    const fieldsEvents = await getEvents(
        [
            knownEventTypes.raisedBedFields.create,
            knownEventTypes.raisedBedFields.delete,
            knownEventTypes.raisedBedFields.plantPlace,
            knownEventTypes.raisedBedFields.plantSchedule,
            knownEventTypes.raisedBedFields.plantUpdate,
            knownEventTypes.raisedBedFields.plantReplaceSort,
        ],
        fieldAggregateIds,
        0,
        100000,
    );

    // For each field, fetch and apply events
    return fields.map((field) => {
        const aggregateId = `${field.raisedBedId}|${field.positionIndex}`;
        const events = fieldsEvents.filter(
            (event) =>
                event.aggregateId === aggregateId &&
                // 5000ms is offset for events - because events and fields are created in parallel
                field.createdAt <= new Date(event.createdAt.getTime() + 5000),
        );

        // Reduce events to get latest status, plant info, etc.
        let plantStatus: string | undefined;
        let plantSortId: number | undefined;
        let plantScheduledDate: Date | undefined;
        let plantSowDate: Date | undefined;
        let plantGrowthDate: Date | undefined;
        let plantReadyDate: Date | undefined;
        let plantDeadDate: Date | undefined;
        let plantHarvestedDate: Date | undefined;
        let plantRemovedDate: Date | undefined;
        let active = true;
        let toBeRemoved = false;
        let stoppedDate: Date | undefined;

        for (const event of events) {
            const data = event.data as Record<string, unknown> | undefined;
            // Handle plant placement event
            if (event.type === knownEventTypes.raisedBedFields.plantPlace) {
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

                // Set status to new when plant is placed
                plantStatus = 'new';
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
            }
            // Handle plant status update event
            else if (
                event.type === knownEventTypes.raisedBedFields.plantUpdate
            ) {
                plantStatus =
                    typeof data?.status === 'string'
                        ? data?.status
                        : plantStatus;
                if (plantStatus === 'sowed') {
                    plantSowDate = event.createdAt;
                } else if (plantStatus === 'sprouted') {
                    plantGrowthDate = event.createdAt;
                } else if (plantStatus === 'notSprouted') {
                    plantDeadDate = event.createdAt;
                    stoppedDate = event.createdAt;
                    toBeRemoved = true;
                } else if (plantStatus === 'died') {
                    plantDeadDate = event.createdAt;
                    stoppedDate = event.createdAt;
                } else if (plantStatus === 'ready') {
                    plantReadyDate = event.createdAt;
                } else if (plantStatus === 'harvested') {
                    plantHarvestedDate = event.createdAt;
                    stoppedDate = event.createdAt;
                } else if (plantStatus === 'removed') {
                    plantRemovedDate = event.createdAt;
                    active = false;

                    // Don't process any newer events for this field
                    break;
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
            plantStatus,
            plantSortId,
            plantScheduledDate,
            plantSowDate,
            plantGrowthDate,
            plantReadyDate,
            plantDeadDate,
            plantHarvestedDate,
            plantRemovedDate,
            active,
            toBeRemoved,
            stoppedDate,
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
                knownEventTypes.raisedBeds.delete,
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
            return {
                id: event.id,
                name:
                    event.type === knownEventTypes.raisedBeds.create
                        ? 'Gredica stvorena'
                        : 'Gredica obrisana',
                description: '',
                status: null,
                timestamp: event.createdAt,
                imageUrls: Array.isArray(data?.imageUrls)
                    ? data.imageUrls.filter(
                          (url: unknown) => typeof url === 'string',
                      )
                    : typeof data?.imageUrl === 'string'
                      ? [data.imageUrl]
                      : undefined,
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
        }))
        .filter((op) => op.name)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return [...raisedBedsEventDiaryEntries, ...operationsDiaryEntries];
}

export async function updateRaisedBed(raisedBed: UpdateRaisedBed) {
    await storage()
        .update(raisedBeds)
        .set(raisedBed)
        .where(eq(raisedBeds.id, raisedBed.id));
}

export async function deleteRaisedBed(raisedBedId: number) {
    await storage()
        .update(raisedBeds)
        .set({ isDeleted: true })
        .where(eq(raisedBeds.id, raisedBedId));
}

export async function getAllRaisedBeds() {
    const allRaisedBeds = await storage().query.raisedBeds.findMany({
        where: and(eq(raisedBeds.isDeleted, false)),
    });
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
    const whereConditions = [eq(raisedBeds.isDeleted, false)];

    if (filters?.status) {
        whereConditions.push(eq(raisedBeds.status, filters.status));
    }

    const allRaisedBeds = await storage().query.raisedBeds.findMany({
        where: and(...whereConditions),
    });

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

function operationStatusToLabel(status: string) {
    switch (status) {
        case 'new':
            return 'Novo';
        case 'completed':
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
    const existingRaisedBedFields = await getRaisedBedFieldsWithEvents(
        field.raisedBedId,
    );
    const existingField = existingRaisedBedFields.find(
        (f) => f.positionIndex === field.positionIndex,
    );
    if (!existingField || !existingField.active) {
        await storage()
            .insert(raisedBedFields)
            .values(field)
            .onConflictDoNothing();
    } else {
        await storage()
            .update(raisedBedFields)
            .set({ ...field, updatedAt: new Date() })
            .where(
                and(
                    eq(raisedBedFields.raisedBedId, field.raisedBedId),
                    eq(raisedBedFields.positionIndex, field.positionIndex),
                    eq(raisedBedFields.isDeleted, false),
                ),
            );
    }
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
