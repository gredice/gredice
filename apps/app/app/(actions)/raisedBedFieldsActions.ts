"use server";

import { createEvent, createNotification, getEntityFormatted, getRaisedBed, knownEvents } from "@gredice/storage";
import { auth } from "../../lib/auth/auth";
import { KnownPages } from "../../src/KnownPages";
import { revalidatePath } from "next/cache";
import { EntityStandardized } from "../../lib/@types/EntityStandardized";

export async function raisedBedPlantedFormHandler(formData: FormData) {
    await auth(["admin"]);

    const raisedBedId = formData.get("raisedBedId") ? Number(formData.get("raisedBedId")) : undefined;
    if (!raisedBedId) {
        throw new Error("Raised bed ID is required");
    }

    const positionIndex = formData.get("positionIndex") ? Number(formData.get("positionIndex")) : undefined;
    if (positionIndex === undefined || positionIndex < 0) {
        throw new Error("Position index is required and must be a non-negative number");
    }

    await raisedBedFieldUpdatePlant({
        raisedBedId,
        positionIndex,
        status: 'sowed',
    });

    revalidatePath(KnownPages.Schedule);
}

export async function raisedBedFieldUpdatePlant({ raisedBedId, positionIndex, status }:
    { raisedBedId: number, positionIndex: number, status: string }) {
    await auth(["admin"]);

    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        throw new Error(`Raised bed with ID ${raisedBedId} not found.`);
    }

    await createEvent(knownEvents.raisedBedFields.plantUpdateV1(
        `${raisedBedId.toString()}|${positionIndex.toString()}`,
        { status: status }
    ));

    const field = raisedBed.fields.find(field => field.positionIndex === positionIndex);
    if (field?.plantSortId) {
        const sortData = await getEntityFormatted<EntityStandardized>(field.plantSortId);
        if (sortData) {
            // Create sprouted notification
            let header: string | null = null;
            let content: string | null = null;
            if (status === 'sowed') {
                // TODO: Add seed image
                header = `Biljka ${sortData.information?.name} je posijana!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** posijana je biljka **${sortData.information?.name}**.`;
            } else if (status === 'sprouted') {
                // TODO: Add sprouted image
                header = `🌱 Proklijala je biljka ${sortData.information?.name}!`;
                content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** proklijala je biljka **${sortData.information?.name}**.`;
            }

            if (header && content) {
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
            console.warn(`No plant sort data found for raised bed ${raisedBedId} at position ${positionIndex}.`);
        }
    } else {
        console.warn(`No plant sort found for raised bed ${raisedBedId} at position ${positionIndex}.`);
    }

    revalidatePath(KnownPages.RaisedBed(raisedBedId));
}
