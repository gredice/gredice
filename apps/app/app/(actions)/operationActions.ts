"use server";

import { auth } from "../../lib/auth/auth";
import { revalidatePath } from "next/cache";
import { KnownPages } from "../../src/KnownPages";
import { createEvent, createNotification, createOperation, getEntityFormatted, getOperationById, getRaisedBed, InsertOperation, knownEvents } from "@gredice/storage";
import { EntityStandardized } from "../../lib/@types/EntityStandardized";

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

export async function completeOperationAction(formData: FormData) {
    await auth(["admin"]);
    const operationId = formData.get("operationId") ? Number(formData.get("operationId")) : undefined;
    if (!operationId) {
        throw new Error("Operation ID is required");
    }
    const completedBy = formData.get("completedBy") as string;
    if (!completedBy) {
        throw new Error("Completed By is required");
    }

    const operation = await getOperationById(operationId);
    if (!operation) {
        throw new Error(`Operation with ID ${operationId} not found.`);
    }

    let header: string | null = null;
    let content: string | null = null;
    if (operation.raisedBedId && !operation.raisedBedFieldId) {
        const raisedBed = await getRaisedBed(operation.raisedBedId);
        const operationData = await getEntityFormatted<EntityStandardized>(operation.entityId);
        if (!raisedBed) {
            console.error(`Raised bed with ID ${operation.raisedBedId} not found.`);
        } else {
            // TODO: Add operation icon
            header = `${operationData?.information?.label}`;
            content = `Danas je na gredici **${raisedBed.name}** odrađeno ${operationData?.information?.label}.`;
        }
    }

    await Promise.all([
        createEvent(knownEvents.operations.completedV1(operationId.toString(), {
            completedBy
        })),
        (header && content) ?
            createNotification({
                accountId: operation.accountId,
                gardenId: operation.gardenId,
                raisedBedId: operation.raisedBedId,
                header,
                content,
                timestamp: new Date(),
            }) : undefined
    ]);
}
