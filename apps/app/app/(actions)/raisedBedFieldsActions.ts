"use server";

import { createEvent, createNotification, getEntityFormatted, getRaisedBed, knownEvents } from "@gredice/storage";
import { auth } from "../../lib/auth/auth";
import { KnownPages } from "../../src/KnownPages";
import { revalidatePath } from "next/cache";

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
        const sortData = await getEntityFormatted(field.plantSortId);
        if (sortData) {
            // Create sprouted notification
            if (status === 'sprouted') {
                const header = `🌱 Proklijala je ${sortData.information.name}!`;
                const content = `U gredici **${raisedBed.name}** na poziciji **${positionIndex + 1}** proklijala je biljka **${sortData.information.name}**.`;
                await createNotification({
                    accountId: raisedBed.accountId,
                    gardenId: raisedBed.gardenId,
                    header,
                    content
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
