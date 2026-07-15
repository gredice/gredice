'use server';

import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import {
    assignPlantingTaskUsers,
    cancelPlantingTaskWithRefund,
    createEvent,
    createNotification,
    getEntityFormatted,
    getRaisedBed,
    getRaisedBedFieldContext,
    getRaisedBedFieldsWithEvents,
    knownEvents,
    moveRaisedBedFieldPlantHistory,
    type RaisedBedFieldSowingLocation,
    type RaisedBedWeedStateLevel,
    setRaisedBedFieldWeedState as setRaisedBedFieldWeedStateInStorage,
    submitPlantingTaskCompletion,
    verifyPlantingTaskCompletion,
    withPlantingScheduleTaskTransaction,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import type { EntityStandardized } from '../../lib/@types/EntityStandardized';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';
import {
    activePlantCycleEventId,
    activePlantCycleVersionEventId,
    canAcceptPlantingTask,
    canReschedulePlantingTask,
    canSwitchPlantingTaskSort,
    canUpdatePlantingTaskStatus,
} from '../admin/schedule/scheduleShared';

function assertPlantCycleVersionEventId(value: number) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error('Trenutna verzija sijanja nije ispravna.');
    }

    return value;
}

function parsePlantCycleVersionEventId(formData: FormData) {
    const value = formData.get('expectedPlantCycleVersionEventId');
    const parsed = typeof value === 'string' ? Number(value) : NaN;
    return assertPlantCycleVersionEventId(parsed);
}

async function revalidateRaisedBedPaths(raisedBed: {
    id: number;
    accountId?: string | null;
    gardenId?: number | null;
}) {
    revalidatePath(KnownPages.Schedule);
    revalidatePath(KnownPages.Greenhouse);
    if (raisedBed.accountId)
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    if (raisedBed.gardenId)
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    revalidatePath(KnownPages.RaisedBed(raisedBed.id));
    revalidatePath(KnownPages.Greenhouse);
}

async function notifyCompletedPlanting({
    completionEventId,
    completedAt,
    plantSortId,
    positionIndex,
    raisedBed,
}: {
    completionEventId: number;
    completedAt: Date;
    plantSortId: number;
    positionIndex: number;
    raisedBed: NonNullable<Awaited<ReturnType<typeof getRaisedBed>>>;
}) {
    if (!raisedBed.accountId) {
        return;
    }

    const sortData = await getEntityFormatted<EntityStandardized>(plantSortId);
    if (!sortData) {
        console.warn(
            `No plant sort data found for raised bed ${raisedBed.id} at position ${positionIndex}.`,
        );
        return;
    }

    await createNotification(
        {
            accountId: raisedBed.accountId,
            gardenId: raisedBed.gardenId,
            raisedBedId: raisedBed.id,
            header: `Biljka ${sortData.information?.name} je posijana!`,
            content: `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** posijana je biljka **${sortData.information?.name}**.`,
            linkUrl: raisedBed.name
                ? getRaisedBedCloseupUrl(raisedBed.name, { positionIndex })
                : undefined,
            timestamp: completedAt,
        },
        {
            idempotencyKey: `schedule-task:planting-completed:${completionEventId.toString()}`,
        },
    );
}

async function applyRaisedBedFieldPlantUpdate({
    raisedBed,
    positionIndex,
    status,
    plantSortId,
    timestamp,
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    expectedPlantSortId,
}: {
    raisedBed: NonNullable<Awaited<ReturnType<typeof getRaisedBed>>>;
    positionIndex: number;
    status?: string;
    plantSortId?: number;
    timestamp?: string;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
}) {
    const validExpectedPlantCycleVersionEventId =
        assertPlantCycleVersionEventId(expectedPlantCycleVersionEventId);
    const aggregateId = `${raisedBed.id.toString()}|${positionIndex.toString()}`;
    const createdAt = timestamp ? new Date(timestamp) : undefined;
    if (createdAt && Number.isNaN(createdAt.getTime())) {
        throw new Error('Invalid plant status timestamp.');
    }

    const mutation = await withPlantingScheduleTaskTransaction(
        raisedBed.id,
        positionIndex,
        async (transaction) => {
            const expectedField = raisedBed.fields.find(
                (field) =>
                    field.positionIndex === positionIndex && field.active,
            );
            const existingField = (
                await getRaisedBedFieldsWithEvents(raisedBed.id, transaction)
            ).find(
                (field) =>
                    field.positionIndex === positionIndex && field.active,
            );
            if (
                !existingField ||
                existingField.id !== expectedField?.id ||
                activePlantCycleEventId(existingField) !==
                    expectedPlantCycleEventId ||
                activePlantCycleVersionEventId(existingField) !==
                    validExpectedPlantCycleVersionEventId ||
                existingField.plantSortId !== expectedPlantSortId ||
                existingField?.plantStatusEventId !==
                    expectedField?.plantStatusEventId
            ) {
                throw new Error(
                    'Biljka se u međuvremenu promijenila. Osvježi stranicu i pokušaj ponovno.',
                );
            }

            if (plantSortId && existingField.plantSortId !== plantSortId) {
                if (!canSwitchPlantingTaskSort(existingField.plantStatus)) {
                    throw new Error(
                        'Sorta biljke više se ne može promijeniti nakon završetka ili prijave prepreke.',
                    );
                }
                await createEvent(
                    knownEvents.raisedBedFields.plantReplaceSortV1(
                        aggregateId,
                        {
                            plantSortId: plantSortId.toString(),
                        },
                    ),
                    transaction,
                );
            }

            const statusChanged = Boolean(
                status && existingField.plantStatus !== status,
            );
            if (status) {
                if (
                    !canUpdatePlantingTaskStatus(
                        existingField.plantStatus,
                        status,
                    )
                ) {
                    throw new Error(
                        'Stanje biljke ne može se vratiti na zadatak koji je već dovršen ili blokiran.',
                    );
                }
                if (statusChanged || createdAt) {
                    await createEvent(
                        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
                            status,
                            ...(createdAt
                                ? { effectiveDate: createdAt.toISOString() }
                                : {}),
                        }),
                        transaction,
                    );
                }
            }

            return {
                sortIdToUse: plantSortId ?? existingField.plantSortId,
                statusChanged,
            };
        },
    );

    if (mutation.sortIdToUse && status && mutation.statusChanged) {
        const sortData = await getEntityFormatted<EntityStandardized>(
            mutation.sortIdToUse,
        );
        if (sortData) {
            let header: string | null = null;
            let content: string | null = null;
            if (status === 'planned') {
                header = `📅 Biljka ${sortData.information?.name} je na rasporedu!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** je na rasporedu za sijanje.`;
            } else if (status === 'sowed') {
                header = `Biljka ${sortData.information?.name} je posijana!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** posijana je biljka **${sortData.information?.name}**.`;
            } else if (status === 'sprouted') {
                header = `🌱 Proklijala je biljka ${sortData.information?.name}!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** proklijala je biljka **${sortData.information?.name}**.`;
            } else if (status === 'notSprouted') {
                header = `😢 Biljka ${sortData.information?.name} nije proklijala!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** nije proklijala. Polje je spremno za nove biljke.`;
            } else if (status === 'died') {
                header = `😢 Biljka ${sortData.information?.name} nije uspjela!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** nije uspjela. Veselimo se novim biljkama koje će rasti na ovom mestu.`;
            } else if (status === 'firstFlowers') {
                header = `🌸 Biljka ${sortData.information?.name} je procvjetala!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** je razvila prve cvjetove.`;
            } else if (status === 'firstFruitSet') {
                header = `🍅 Biljka ${sortData.information?.name} ima prve plodove!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** je razvila prve plodove.`;
            } else if (status === 'ready') {
                header = `🌿 Biljka ${sortData.information?.name} je spremna za berbu!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** je spremna za berbu.`;
            } else if (status === 'harvested') {
                header = `🌾 Biljka ${sortData.information?.name} je ubrana!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** je ubrana. Polje je spremno za nove biljke.`;
            } else if (status === 'removed') {
                header = `🧹 Biljka ${sortData.information?.name} je uklonjena!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** je uklonjena. Polje je spremno za nove biljke.`;
            }

            if (header && content && raisedBed.accountId) {
                await createNotification({
                    accountId: raisedBed.accountId,
                    gardenId: raisedBed.gardenId,
                    raisedBedId: raisedBed.id,
                    header,
                    content,
                    linkUrl: raisedBed.name
                        ? getRaisedBedCloseupUrl(raisedBed.name, {
                              positionIndex,
                          })
                        : undefined,
                    timestamp: new Date(),
                });
            }
        } else {
            console.warn(
                `No plant sort data found for raised bed ${raisedBed.id} at position ${positionIndex}.`,
            );
        }
    } else if (status && !mutation.sortIdToUse) {
        console.warn(
            `No plant sort found for raised bed ${raisedBed.id} at position ${positionIndex}.`,
        );
    }
}

export async function raisedBedPlanted(
    raisedBedId: number,
    positionIndex: number,
    expectedPlantCycleEventId: number,
    expectedPlantSortId: number,
    expectedPlantCycleVersionEventId: number,
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }
    const field = raisedBed.fields.find(
        (candidate) =>
            candidate.positionIndex === positionIndex && candidate.active,
    );
    if (!field?.plantSortId || field.plantSortId !== expectedPlantSortId) {
        throw new Error('Aktivno sijanje ne odgovara odabranoj biljci.');
    }
    const activePlantCycle = field.plantCycles.find(
        (plantCycle) => plantCycle.active,
    );
    if (
        !activePlantCycle ||
        activePlantCycle.plantPlaceEventId !== expectedPlantCycleEventId ||
        activePlantCycle.endedEventId !==
            assertPlantCycleVersionEventId(expectedPlantCycleVersionEventId)
    ) {
        throw new Error('Aktivni ciklus sijanja nije pronađen.');
    }

    const result = await submitPlantingTaskCompletion({
        actor: {
            role: role === 'admin' ? 'admin' : 'farmer',
            userId,
        },
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        positionIndex,
        raisedBedId,
    });
    if (result.status === 'sowed') {
        await notifyCompletedPlanting({
            completionEventId: result.eventId,
            completedAt: result.occurredAt,
            plantSortId: expectedPlantSortId,
            positionIndex,
            raisedBed,
        });
    }

    await revalidateRaisedBedPaths(raisedBed);

    return { success: true };
}

export async function raisedBedFieldUpdatePlant({
    raisedBedId,
    positionIndex,
    status,
    plantSortId,
    timestamp,
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    expectedPlantSortId,
}: {
    raisedBedId: number;
    positionIndex: number;
    status?: string;
    plantSortId?: number;
    timestamp?: string;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
}) {
    await auth(['admin']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    await applyRaisedBedFieldPlantUpdate({
        raisedBed,
        positionIndex,
        status,
        plantSortId,
        timestamp,
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
    });

    await revalidateRaisedBedPaths(raisedBed);

    return { success: true };
}

export async function setRaisedBedFieldWeedState({
    level,
    positionIndex,
    raisedBedId,
}: {
    level: RaisedBedWeedStateLevel;
    positionIndex: number;
    raisedBedId: number;
}) {
    await auth(['admin']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    const field = raisedBed.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );
    if (field?.weedState?.level === level) {
        return { success: true };
    }

    await setRaisedBedFieldWeedStateInStorage({
        level,
        positionIndex,
        raisedBedId,
        source: 'admin',
    });

    await revalidateRaisedBedPaths(raisedBed);

    return { success: true };
}

export async function verifyRaisedBedPlantingAction(
    raisedBedId: number,
    positionIndex: number,
    expectedPlantCycleEventId: number,
    expectedPlantSortId: number,
    expectedPlantCycleVersionEventId: number,
) {
    const { userId } = await auth(['admin']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    const field = raisedBed.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );
    if (
        !field?.plantSortId ||
        field.plantSortId !== expectedPlantSortId ||
        activePlantCycleEventId(field) !== expectedPlantCycleEventId ||
        activePlantCycleVersionEventId(field) !==
            assertPlantCycleVersionEventId(expectedPlantCycleVersionEventId)
    ) {
        throw new Error('Aktivno sijanje nije pronađeno.');
    }

    const result = await verifyPlantingTaskCompletion({
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        positionIndex,
        raisedBedId,
        verifiedBy: userId,
    });
    await notifyCompletedPlanting({
        completionEventId: result.eventId,
        completedAt: result.occurredAt,
        plantSortId: expectedPlantSortId,
        positionIndex,
        raisedBed,
    });

    await revalidateRaisedBedPaths(raisedBed);

    return { success: true };
}

export async function moveRaisedBedFieldPlantAction({
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
    await auth(['admin']);

    if (sourcePositionIndex === targetPositionIndex) {
        return {
            success: false,
            message: 'Izvorišno i ciljno polje moraju biti različiti.',
        };
    }

    if (sourcePositionIndex < 0 || targetPositionIndex < 0) {
        return {
            success: false,
            message: 'Pozicije polja moraju biti nula ili veće.',
        };
    }

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        return {
            success: false,
            message: `Gredica s ID-em ${raisedBedId} nije pronađena.`,
        };
    }

    const highestPositionIndex = Math.max(
        8,
        ...raisedBed.fields.map((field) => field.positionIndex),
    );
    if (targetPositionIndex > highestPositionIndex) {
        return {
            success: false,
            message: 'Ciljno polje nije dostupno u ovoj gredici.',
        };
    }

    try {
        await moveRaisedBedFieldPlantHistory({
            raisedBedId,
            sourcePositionIndex,
            targetPositionIndex,
            sourcePlantPlaceEventId,
        });
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : 'Premještanje biljke nije uspjelo.',
        };
    }

    revalidatePath(KnownPages.Schedule);
    if (raisedBed.accountId)
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    if (raisedBed.gardenId)
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    revalidatePath(KnownPages.RaisedBed(raisedBedId));

    return {
        success: true,
    };
}

export async function acceptRaisedBedFieldAction(
    raisedBedId: number,
    positionIndex: number,
    expectedPlantCycleEventId: number,
    expectedPlantSortId: number,
    expectedPlantCycleVersionEventId: number,
) {
    await auth(['admin']);
    const validExpectedPlantCycleVersionEventId =
        assertPlantCycleVersionEventId(expectedPlantCycleVersionEventId);
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }
    const expectedField = raisedBed.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );
    await withPlantingScheduleTaskTransaction(
        raisedBedId,
        positionIndex,
        async (transaction) => {
            const field = (
                await getRaisedBedFieldsWithEvents(raisedBedId, transaction)
            ).find(
                (item) => item.positionIndex === positionIndex && item.active,
            );
            if (!field) {
                throw new Error('Polje za sijanje nije pronađeno.');
            }
            if (
                !expectedField ||
                field.id !== expectedField.id ||
                activePlantCycleEventId(field) !== expectedPlantCycleEventId ||
                activePlantCycleVersionEventId(field) !==
                    validExpectedPlantCycleVersionEventId ||
                field.plantSortId !== expectedPlantSortId ||
                field.plantStatusEventId !== expectedField.plantStatusEventId ||
                field.assignedUserId !== expectedField.assignedUserId
            ) {
                throw new Error(
                    'Sijanje se u međuvremenu promijenilo. Osvježi stranicu i pokušaj ponovno.',
                );
            }
            if (!field.assignedUserId) {
                throw new Error(
                    'Sijanje ne može biti potvrđeno prije nego što korisnik bude dodijeljen.',
                );
            }
            if (!canAcceptPlantingTask(field.plantStatus)) {
                throw new Error(
                    'Sijanje se više ne može potvrditi u trenutnom stanju.',
                );
            }
            if (field.plantStatus !== 'planned') {
                await createEvent(
                    knownEvents.raisedBedFields.plantUpdateV1(
                        `${raisedBedId}|${positionIndex}`,
                        { status: 'planned' },
                    ),
                    transaction,
                );
            }
        },
    );
    revalidatePath(KnownPages.Schedule);
}

export async function rescheduleRaisedBedFieldAction(formData: FormData) {
    await auth(['admin']);
    const raisedBedId = formData.get('raisedBedId')
        ? Number(formData.get('raisedBedId'))
        : undefined;
    const positionIndex = formData.get('positionIndex')
        ? Number(formData.get('positionIndex'))
        : undefined;
    const scheduledDate = formData.get('scheduledDate') as string;
    const expectedPlantCycleEventId = formData.get('expectedPlantCycleEventId')
        ? Number(formData.get('expectedPlantCycleEventId'))
        : undefined;
    const expectedPlantSortId = formData.get('expectedPlantSortId')
        ? Number(formData.get('expectedPlantSortId'))
        : undefined;
    const expectedPlantCycleVersionEventId =
        parsePlantCycleVersionEventId(formData);
    if (
        raisedBedId === undefined ||
        positionIndex === undefined ||
        !scheduledDate ||
        !expectedPlantCycleEventId ||
        !expectedPlantSortId
    ) {
        throw new Error('Raised bed ID, position index and date are required');
    }

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }
    const expectedField = raisedBed.fields.find(
        (candidate) =>
            candidate.positionIndex === positionIndex && candidate.active,
    );
    const normalizedScheduledDate = new Date(scheduledDate).toISOString();
    await withPlantingScheduleTaskTransaction(
        raisedBedId,
        positionIndex,
        async (transaction) => {
            const field = (
                await getRaisedBedFieldsWithEvents(raisedBedId, transaction)
            ).find(
                (candidate) =>
                    candidate.positionIndex === positionIndex &&
                    candidate.active,
            );
            if (!field?.plantSortId) {
                throw new Error('Field or plant sort not found.');
            }
            if (
                !expectedField ||
                field.id !== expectedField.id ||
                activePlantCycleEventId(field) !== expectedPlantCycleEventId ||
                activePlantCycleVersionEventId(field) !==
                    expectedPlantCycleVersionEventId ||
                field.plantSortId !== expectedPlantSortId ||
                field.plantStatusEventId !== expectedField.plantStatusEventId
            ) {
                throw new Error(
                    'Sijanje se u međuvremenu promijenilo. Osvježi stranicu i pokušaj ponovno.',
                );
            }
            if (!canReschedulePlantingTask(field.plantStatus)) {
                throw new Error(
                    'Sijanje se više ne može zakazati ili prerasporediti.',
                );
            }

            const aggregateId = `${raisedBedId}|${positionIndex}`;
            await createEvent(
                knownEvents.raisedBedFields.plantScheduleV1(aggregateId, {
                    scheduledDate: normalizedScheduledDate,
                }),
                transaction,
            );

            if (field.plantStatus === 'blocked') {
                await createEvent(
                    knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
                        status: 'planned',
                    }),
                    transaction,
                );
            }
        },
    );

    revalidatePath(KnownPages.Schedule);
    if (raisedBed.accountId)
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    if (raisedBed.gardenId)
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    revalidatePath(KnownPages.RaisedBed(raisedBedId));

    return { success: true };
}

export async function setRaisedBedFieldSowingLocationAction(
    raisedBedId: number,
    positionIndex: number,
    expectedPlantCycleEventId: number,
    expectedPlantSortId: number,
    expectedPlantCycleVersionEventId: number,
    sowingLocation: RaisedBedFieldSowingLocation,
) {
    await auth(['admin']);
    if (sowingLocation !== 'direct' && sowingLocation !== 'greenhouse') {
        throw new Error('Nepoznata lokacija sijanja.');
    }
    const validExpectedPlantCycleVersionEventId =
        assertPlantCycleVersionEventId(expectedPlantCycleVersionEventId);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    const changed = await withPlantingScheduleTaskTransaction(
        raisedBedId,
        positionIndex,
        async (transaction) => {
            const field = (
                await getRaisedBedFieldsWithEvents(raisedBedId, transaction)
            ).find(
                (candidate) =>
                    candidate.positionIndex === positionIndex &&
                    candidate.active,
            );
            if (!field?.plantSortId) {
                throw new Error('Field or plant sort not found.');
            }
            if (
                activePlantCycleEventId(field) !== expectedPlantCycleEventId ||
                activePlantCycleVersionEventId(field) !==
                    validExpectedPlantCycleVersionEventId ||
                field.plantSortId !== expectedPlantSortId
            ) {
                throw new Error(
                    'Sijanje se u međuvremenu promijenilo. Osvježi stranicu i pokušaj ponovno.',
                );
            }
            if (field.sowingLocation === sowingLocation) {
                return false;
            }

            await createEvent(
                knownEvents.raisedBedFields.plantScheduleV1(
                    `${raisedBedId}|${positionIndex}`,
                    {
                        scheduledDate:
                            field.plantScheduledDate?.toISOString() ?? null,
                        sowingLocation,
                    },
                ),
                transaction,
            );
            return true;
        },
    );
    if (!changed) {
        return { success: true };
    }

    await revalidateRaisedBedPaths(raisedBed);

    return { success: true };
}

export async function cancelRaisedBedFieldAction(formData: FormData) {
    const { userId } = await auth(['admin']);
    const raisedBedId = formData.get('raisedBedId')
        ? Number(formData.get('raisedBedId'))
        : undefined;
    const positionIndex = formData.get('positionIndex')
        ? Number(formData.get('positionIndex'))
        : undefined;
    const reasonValue = formData.get('reason');
    const reason = typeof reasonValue === 'string' ? reasonValue.trim() : '';
    const expectedPlantCycleEventId = formData.get('expectedPlantCycleEventId')
        ? Number(formData.get('expectedPlantCycleEventId'))
        : undefined;
    const expectedPlantSortId = formData.get('expectedPlantSortId')
        ? Number(formData.get('expectedPlantSortId'))
        : undefined;
    const expectedPlantCycleVersionEventId =
        parsePlantCycleVersionEventId(formData);
    if (
        raisedBedId === undefined ||
        positionIndex === undefined ||
        !reason ||
        !expectedPlantCycleEventId ||
        !expectedPlantSortId
    ) {
        throw new Error(
            'Raised bed ID, position index and reason are required',
        );
    }

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }
    const field =
        raisedBed.fields.find(
            (candidate) =>
                candidate.positionIndex === positionIndex && candidate.active,
        ) ??
        raisedBed.fields.find(
            (candidate) =>
                candidate.positionIndex === positionIndex &&
                candidate.plantCycles.some(
                    (plantCycle) =>
                        plantCycle.plantPlaceEventId ===
                        expectedPlantCycleEventId,
                ),
        );
    if (!field) {
        throw new Error(
            `Field with position ${positionIndex} not found in raised bed ${raisedBedId}.`,
        );
    }

    const sortData =
        await getEntityFormatted<EntityStandardized>(expectedPlantSortId);
    const plantName = sortData?.information?.name ?? 'Nepoznato';
    const perPlantPrice =
        sortData?.prices?.perPlant ??
        sortData?.information?.plant?.prices?.perPlant;

    const cancellation = await cancelPlantingTaskWithRefund({
        canceledBy: userId,
        expectedFieldId: field.id,
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId,
        expectedPlantSortId,
        expectedPlantStatus: field.plantStatus,
        expectedPlantStatusEventId: field.plantStatusEventId,
        fallbackRefundAmount:
            typeof perPlantPrice === 'number' && perPlantPrice > 0
                ? Math.round(perPlantPrice * 1000)
                : 0,
        notificationRequested: true,
        positionIndex,
        raisedBedId,
        reason,
        refundEnabled: true,
    });

    const header = 'Sijanje biljke je otkazano';
    let content = `Sijanje biljke **${plantName}** je otkazano.`;
    if (cancellation.reason)
        content += `\nRazlog otkazivanja: ${cancellation.reason}`;
    if (cancellation.refundAmount > 0)
        content += `\nSredstva su ti vraćena u iznosu od ${cancellation.refundAmount} 🌻.`;

    if (cancellation.notificationRequested && raisedBed.accountId) {
        await createNotification(
            {
                accountId: raisedBed.accountId,
                gardenId: raisedBed.gardenId,
                raisedBedId: raisedBed.id,
                header,
                content,
                linkUrl: raisedBed.name
                    ? getRaisedBedCloseupUrl(raisedBed.name, {
                          positionIndex,
                      })
                    : undefined,
                timestamp: cancellation.canceledAt,
            },
            {
                idempotencyKey: `admin:planting-canceled:${cancellation.cancellationEventId.toString()}`,
            },
        );
    }

    revalidatePath(KnownPages.Schedule);
    if (raisedBed.accountId)
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    if (raisedBed.gardenId)
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    revalidatePath(KnownPages.RaisedBed(raisedBedId));

    return { success: true };
}

export async function assignRaisedBedFieldUserAction(
    raisedBedFieldId: number,
    expectedPlantCycleEventId: number,
    expectedPlantSortId: number,
    expectedPlantCycleVersionEventId: number,
    assignedUserIds: string[],
) {
    const { userId } = await auth(['admin']);
    const matchedRaisedBed = await getRaisedBedFieldContext(raisedBedFieldId);
    const matchedField = matchedRaisedBed
        ? (await getRaisedBedFieldsWithEvents(matchedRaisedBed.id)).find(
              (field) => field.id === raisedBedFieldId,
          )
        : undefined;

    if (!matchedRaisedBed || !matchedField) {
        throw new Error('Polje za sijanje nije pronađeno.');
    }

    const assignment = await assignPlantingTaskUsers({
        assignedBy: userId,
        assignedUserIds,
        expectedPlantCycleEventId,
        expectedPlantCycleVersionEventId: assertPlantCycleVersionEventId(
            expectedPlantCycleVersionEventId,
        ),
        expectedPlantSortId,
        positionIndex: matchedField.positionIndex,
        raisedBedId: matchedRaisedBed.id,
    });
    if (!assignment.changed) {
        return { success: true };
    }

    await revalidateRaisedBedPaths(matchedRaisedBed);

    return { success: true };
}
