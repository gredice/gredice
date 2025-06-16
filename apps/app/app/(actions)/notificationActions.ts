"use server";

import { createNotification, InsertNotification } from "@gredice/storage";
import { auth } from "../../lib/auth/auth";

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
        blockId: formData.get("blockId") as string || undefined,
        readAt: null,
        readWhere: undefined,
    };
    await createNotification(notification);
    return { success: true };
}
