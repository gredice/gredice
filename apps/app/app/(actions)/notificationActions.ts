"use server";

import { createNotification, InsertNotification } from "@gredice/storage";
import { auth } from "../../lib/auth/auth";
import { revalidatePath } from "next/cache";
import { KnownPages } from "../../src/KnownPages";

export async function createNotificationAction(_prevState: unknown, formData: FormData) {
    await auth(["admin"]);

    const notification: InsertNotification = {
        header: formData.get("header") as string,
        content: formData.get("content") as string,
        imageUrl: formData.get("imageUrl") as string || undefined,
        linkUrl: formData.get("linkUrl") as string || undefined,
        accountId: formData.get("accountId") as string,
        userId: formData.get("userId") as string || undefined,
        gardenId: formData.get("gardenId") ? Number(formData.get("gardenId")) : undefined,
        raisedBedId: formData.get("raisedBedId") ? Number(formData.get("raisedBedId")) : undefined,
        blockId: formData.get("blockId") as string || undefined,
        timestamp: formData.get("timestamp") ? new Date(formData.get("timestamp") as string) : new Date(),
        readAt: null,
        readWhere: undefined,
    };
    await createNotification(notification);
    if (notification.userId)
        revalidatePath(KnownPages.User(notification.userId));
    if (notification.gardenId)
        revalidatePath(KnownPages.Garden(notification.gardenId));
    if (notification.raisedBedId)
        revalidatePath(KnownPages.RaisedBed(notification.raisedBedId));
    if (notification.accountId)
        revalidatePath(KnownPages.Account(notification.accountId));
    return { success: true };
}
