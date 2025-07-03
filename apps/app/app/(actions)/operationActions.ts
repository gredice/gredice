"use server";

import { auth } from "../../lib/auth/auth";
import { revalidatePath } from "next/cache";
import { KnownPages } from "../../src/KnownPages";
import { createOperation, InsertOperation } from "@gredice/storage";

export async function createOperationAction(formData: FormData) {
    await auth(["admin"]);
    const entityId = formData.get("entityId") ? Number(formData.get("entityId")) : undefined;
    if (!entityId) {
        throw new Error("Entity ID is required");
    }
    const accountId = formData.get("accountId") as string;
    if (!accountId) {
        throw new Error("Account ID is required");
    }

    const operation: InsertOperation = {
        entityId,
        entityTypeName: formData.get("entityTypeName") as string,
        accountId,
        gardenId: formData.get("gardenId") ? Number(formData.get("gardenId")) : undefined,
        raisedBedId: formData.get("raisedBedId") ? Number(formData.get("raisedBedId")) : undefined,
        raisedBedFieldId: formData.get("raisedBedFieldId") ? Number(formData.get("raisedBedFieldId")) : undefined,
        timestamp: formData.get("timestamp") ? new Date(formData.get("timestamp") as string) : undefined,
    };
    await createOperation(operation);
    if (operation.accountId)
        revalidatePath(KnownPages.Account(operation.accountId));
    if (operation.gardenId)
        revalidatePath(KnownPages.Garden(operation.gardenId));
    if (operation.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(operation.raisedBedId));
    return { success: true };
}
