'use server';

import { getRaisedBedCloseupUrl } from '@gredice/js/urls';
import {
    buildRaisedBedFieldPlantUpdatePayload,
    createEvent,
    createNotification,
    deleteRaisedBedField,
    earnSunflowers,
    getAssignableFarmUsersByRaisedBedFieldIds,
    getEntityFormatted,
    getFarmUserRaisedBeds,
    getRaisedBed,
    getRaisedBedFieldContext,
    getRaisedBedFieldsWithEvents,
    knownEvents,
    moveRaisedBedFieldPlantHistory,
    queueSeasonalSowingOfferOperations,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import type { EntityStandardized } from '../../lib/@types/EntityStandardized';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

async function revalidateRaisedBedPaths(
    raisedBed: NonNullable<Awaited<ReturnType<typeof getRaisedBed>>>,
) {
    revalidatePath(KnownPages.Schedule);
    if (raisedBed.accountId)
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    if (raisedBed.gardenId)
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    revalidatePath(KnownPages.RaisedBed(raisedBed.id));
}

async function applyRaisedBedFieldPlantUpdate({
    raisedBed,
    positionIndex,
    status,
    plantSortId,
}: {
    raisedBed: NonNullable<Awaited<ReturnType<typeof getRaisedBed>>>;
    positionIndex: number;
    status?: string;
    plantSortId?: number;
}) {
    const aggregateId = `${raisedBed.id.toString()}|${positionIndex.toString()}`;
    const existingField = raisedBed.fields.find(
        (field) => field.positionIndex === positionIndex && field.active,
    );
    if (plantSortId && existingField?.plantSortId !== plantSortId) {
        await createEvent(
            knownEvents.raisedBedFields.plantReplaceSortV1(aggregateId, {
                plantSortId: plantSortId.toString(),
            }),
        );
    }

    if (status) {
        await createEvent(
            knownEvents.raisedBedFields.plantUpdateV1(
                aggregateId,
                buildRaisedBedFieldPlantUpdatePayload(
                    status,
                    existingField?.assignedUserIds,
                ),
            ),
        );

        if (
            status === 'sowed' &&
            existingField?.plantStatus !== 'sowed' &&
            raisedBed.accountId
        ) {
            await queueSeasonalSowingOfferOperations({
                accountId: raisedBed.accountId,
                gardenId: raisedBed.gardenId,
                raisedBedId: raisedBed.id,
            });
        }
    }

    const sortIdToUse = plantSortId ?? existingField?.plantSortId;
    if (sortIdToUse && status) {
        const sortData =
            await getEntityFormatted<EntityStandardized>(sortIdToUse);
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
                        ? getRaisedBedCloseupUrl(raisedBed.name)
                        : undefined,
                    timestamp: new Date(),
                });
            }
        } else {
            console.warn(
                `No plant sort data found for raised bed ${raisedBed.id} at position ${positionIndex}.`,
            );
        }
    } else if (status && !sortIdToUse) {
        console.warn(
            `No plant sort found for raised bed ${raisedBed.id} at position ${positionIndex}.`,
        );
    }
}

async function assertFarmerCanUpdateRaisedBedField(
    userId: string,
    raisedBedId: number,
    positionIndex: number,
) {
    const raisedBeds = await getFarmUserRaisedBeds(userId);
    const raisedBed = raisedBeds.find((item) => item.id === raisedBedId);
    const field = raisedBed?.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );

    if (!raisedBed || !field) {
        throw new Error('Nemaš dozvolu za ažuriranje ovog sijanja.');
    }
}

export async function raisedBedPlanted(
    raisedBedId: number,
    positionIndex: number,
    plantSortId: number,
) {
    const {
        user: { role },
        userId,
    } = await auth(['admin', 'farmer']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    if (role === 'farmer') {
        await assertFarmerCanUpdateRaisedBedField(
            userId,
            raisedBedId,
            positionIndex,
        );
    }

    await applyRaisedBedFieldPlantUpdate({
        raisedBed,
        positionIndex,
        status: role === 'admin' ? 'sowed' : 'pendingVerification',
        plantSortId,
    });

    await revalidateRaisedBedPaths(raisedBed);

    return { success: true };
}

export async function raisedBedFieldUpdatePlant({
    raisedBedId,
    positionIndex,
    status,
    plantSortId,
}: {
    raisedBedId: number;
    positionIndex: number;
    status?: string;
    plantSortId?: number;
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
    });

    await revalidateRaisedBedPaths(raisedBed);

    return { success: true };
}

export async function verifyRaisedBedPlantingAction(
    raisedBedId: number,
    positionIndex: number,
) {
    await auth(['admin']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    const field = raisedBed.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );
    if (!field || field.plantStatus !== 'pendingVerification') {
        throw new Error('Sijanje ne čeka verifikaciju.');
    }

    await applyRaisedBedFieldPlantUpdate({
        raisedBed,
        positionIndex,
        status: 'sowed',
        plantSortId: field.plantSortId,
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
) {
    await auth(['admin']);
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }
    const field = raisedBed.fields.find(
        (item) => item.positionIndex === positionIndex && item.active,
    );
    if (!field) {
        throw new Error('Polje za sijanje nije pronađeno.');
    }
    if (!field.assignedUserId) {
        throw new Error(
            'Sijanje ne može biti potvrđeno prije nego što korisnik bude dodijeljen.',
        );
    }
    await raisedBedFieldUpdatePlant({
        raisedBedId,
        positionIndex,
        status: 'planned',
    });
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
    if (
        raisedBedId === undefined ||
        positionIndex === undefined ||
        !scheduledDate
    ) {
        throw new Error('Raised bed ID, position index and date are required');
    }

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }
    const field = raisedBed.fields.find(
        (f) => f.positionIndex === positionIndex && f.active,
    );
    if (!field?.plantSortId) {
        throw new Error('Field or plant sort not found.');
    }

    await createEvent(
        knownEvents.raisedBedFields.plantScheduleV1(
            `${raisedBedId}|${positionIndex}`,
            {
                scheduledDate: new Date(scheduledDate).toISOString(),
            },
        ),
    );

    revalidatePath(KnownPages.Schedule);
    if (raisedBed.accountId)
        revalidatePath(KnownPages.Account(raisedBed.accountId));
    if (raisedBed.gardenId)
        revalidatePath(KnownPages.Garden(raisedBed.gardenId));
    revalidatePath(KnownPages.RaisedBed(raisedBedId));

    return { success: true };
}

export async function cancelRaisedBedFieldAction(formData: FormData) {
    await auth(['admin']);
    const raisedBedId = formData.get('raisedBedId')
        ? Number(formData.get('raisedBedId'))
        : undefined;
    const positionIndex = formData.get('positionIndex')
        ? Number(formData.get('positionIndex'))
        : undefined;
    const reason = formData.get('reason') as string;
    if (
        raisedBedId === undefined ||
        positionIndex === undefined ||
        !reason ||
        reason.trim().length === 0
    ) {
        throw new Error(
            'Raised bed ID, position index and reason are required',
        );
    }

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }
    const field = raisedBed.fields.find(
        (f) => f.positionIndex === positionIndex && f.active,
    );
    if (!field) {
        throw new Error(
            `Field with position ${positionIndex} not found in raised bed ${raisedBedId}.`,
        );
    }

    let refundAmount = 0;
    let plantName = 'Nepoznato';
    if (field.plantSortId) {
        const sortData = await getEntityFormatted<EntityStandardized>(
            field.plantSortId,
        );
        plantName = sortData?.information?.name ?? plantName;
        refundAmount = sortData?.prices?.perPlant
            ? Math.round(sortData.prices.perPlant * 1000)
            : 0;
    }

    const header = 'Sijanje biljke je otkazano';
    let content = `Sijanje biljke **${plantName}** je otkazano.`;
    if (reason) content += `\nRazlog otkazivanja: ${reason}`;
    if (refundAmount > 0)
        content += `\nSredstva su ti vraćena u iznosu od ${refundAmount} 🌻.`;

    await Promise.all([
        createEvent(
            knownEvents.raisedBedFields.deletedV1(
                `${raisedBedId}|${positionIndex}`,
            ),
        ),
        deleteRaisedBedField(raisedBedId, positionIndex),
        refundAmount > 0 && raisedBed.accountId
            ? earnSunflowers(
                  raisedBed.accountId,
                  refundAmount,
                  `refund:raisedBedField:${raisedBedId}:${positionIndex}`,
              )
            : Promise.resolve(),
        raisedBed.accountId
            ? createNotification({
                  accountId: raisedBed.accountId,
                  gardenId: raisedBed.gardenId,
                  raisedBedId: raisedBed.id,
                  header,
                  content,
                  timestamp: new Date(),
              })
            : undefined,
    ]);

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

    const normalizedAssignedUserIds = Array.from(
        new Set(
            assignedUserIds
                .map((assignedUserId) => assignedUserId.trim())
                .filter((assignedUserId) => assignedUserId.length > 0),
        ),
    );
    const fieldAssignedUserIds = matchedField.assignedUserIds ?? [];
    if (
        normalizedAssignedUserIds.length === fieldAssignedUserIds.length &&
        normalizedAssignedUserIds.every((assignedUserId) =>
            fieldAssignedUserIds.includes(assignedUserId),
        )
    ) {
        return { success: true };
    }

    if (normalizedAssignedUserIds.length > 0) {
        const assignableFarmUsersByRaisedBedFieldId =
            await getAssignableFarmUsersByRaisedBedFieldIds([raisedBedFieldId]);
        const assignableFarmUsers =
            assignableFarmUsersByRaisedBedFieldId[raisedBedFieldId] ?? [];

        if (
            !normalizedAssignedUserIds.every((assignedUserId) =>
                assignableFarmUsers.some(
                    (farmUser) => farmUser.id === assignedUserId,
                ),
            )
        ) {
            throw new Error(
                'Jedan od odabranih korisnika nije dostupan za ovo sijanje.',
            );
        }
    }

    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(
            `${matchedRaisedBed.id.toString()}|${matchedField.positionIndex.toString()}`,
            {
                assignedUserId: normalizedAssignedUserIds[0] ?? null,
                assignedUserIds: normalizedAssignedUserIds,
                assignedBy: userId,
            },
        ),
    );

    await revalidateRaisedBedPaths(matchedRaisedBed);

    return { success: true };
}
