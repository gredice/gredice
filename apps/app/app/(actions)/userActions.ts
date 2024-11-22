'use server';

import { revalidatePath } from "next/cache";
import { auth } from "../../lib/auth/auth";
import { KnownPages } from "../../src/KnownPages";
import { updateUserRole as storageUpdateUserRole } from "@gredice/storage";

export async function updateUserRole(userId: string, newRole: string) {
    const { user } = await auth();
    if (user.role !== 'admin') {
        throw new Error('Unauthorized');
    }

    await storageUpdateUserRole(userId, newRole);

    revalidatePath(KnownPages.Users);
}