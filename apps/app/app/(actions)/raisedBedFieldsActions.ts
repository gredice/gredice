"use server";

import { createEvent, knownEvents } from "@gredice/storage";
import { auth } from "../../lib/auth/auth";
import { KnownPages } from "../../src/KnownPages";
import { revalidatePath } from "next/cache";

export async function raisedBedFieldUpdatePlant({ raisedBedId, positionIndex, status }:
    { raisedBedId: number, positionIndex: number, status: string }) {
    await auth(["admin"]);

    await createEvent(knownEvents.raisedBedFields.plantUpdateV1(
        `${raisedBedId.toString()}|${positionIndex.toString()}`,
        { status: status }
    ));

    revalidatePath(KnownPages.RaisedBed(raisedBedId));
}
