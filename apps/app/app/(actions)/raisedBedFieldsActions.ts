'use server';

import {
    createEvent,
    createNotification,
    getEntityFormatted,
    getRaisedBed,
    knownEvents,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import type { EntityStandardized } from '../../lib/@types/EntityStandardized';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function raisedBedPlanted(
    raisedBedId: number,
    positionIndex: number,
    plantSortId: number,
) {
    await raisedBedFieldUpdatePlant({
        raisedBedId,
        positionIndex,
        status: 'sowed',
        plantSortId,
    });

    revalidatePath(KnownPages.Schedule);
}

export async function raisedBedFieldUpdatePlant({
    raisedBedId,
    positionIndex,
    status,
    plantSortId,
}: {
    raisedBedId: number;
    positionIndex: number;
    status: string;
    plantSortId?: number;
}) {
    await auth(['admin']);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    // If a plant sort id is provided and differs from current field, place the plant
    const aggregateId = `${raisedBedId.toString()}|${positionIndex.toString()}`;
    const existingField = raisedBed.fields.find(
        (field) => field.positionIndex === positionIndex,
    );
    if (plantSortId && existingField?.plantSortId !== plantSortId) {
        await createEvent(
            knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
                plantSortId: plantSortId.toString(),
                scheduledDate: null,
            }),
        );
    }

    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: status,
        }),
    );

    const sortIdToUse = plantSortId ?? existingField?.plantSortId;
    if (sortIdToUse) {
        const sortData =
            await getEntityFormatted<EntityStandardized>(sortIdToUse);
        if (sortData) {
            // Create sprouted notification
            let header: string | null = null;
            let content: string | null = null;
            if (status === 'planned') {
                // TODO: Add not sprouted image
                header = `📅 Biljka ${sortData.information?.name} je na rasporedu!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** je na rasporedu za sijanje.`;
            } else if (status === 'sowed') {
                // TODO: Add seed image
                header = `Biljka ${sortData.information?.name} je posijana!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** posijana je biljka **${sortData.information?.name}**.`;
            } else if (status === 'sprouted') {
                // TODO: Add sprouted image
                header = `🌱 Proklijala je biljka ${sortData.information?.name}!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** proklijala je biljka **${sortData.information?.name}**.`;
            } else if (status === 'notSprouted') {
                // TODO: Add not sprouted image
                header = `😢 Biljka ${sortData.information?.name} nije proklijala!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** nije proklijala. Polje je spremno za nove biljke.`;
            } else if (status === 'died') {
                // TODO: Add died image
                header = `😢 Biljka ${sortData.information?.name} nije uspjela!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** nije uspjela. Veselimo se novim biljkama koje će rasti na ovom mestu.`;
            } else if (status === 'ready') {
                // TODO: Add ready image
                header = `🌿 Biljka ${sortData.information?.name} je spremna za berbu!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** biljka **${sortData.information?.name}** je spremna za berbu.`;
            } else if (status === 'harvested') {
                // TODO: Add harvested image
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
                    timestamp: new Date(),
                });
            }
        } else {
            console.warn(
                `No plant sort data found for raised bed ${raisedBedId} at position ${positionIndex}.`,
            );
        }
    } else {
        console.warn(
            `No plant sort found for raised bed ${raisedBedId} at position ${positionIndex}.`,
        );
    }

    revalidatePath(KnownPages.RaisedBed(raisedBedId));
}
