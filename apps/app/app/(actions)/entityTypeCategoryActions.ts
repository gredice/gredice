'use server';

import { auth } from "../../lib/auth/auth";
import { upsertEntityTypeCategory, deleteEntityTypeCategory } from "@gredice/storage";
import { revalidatePath } from "next/cache";
import { KnownPages } from "../../src/KnownPages";

export async function createEntityTypeCategory(name: string, label: string) {
    await auth(['admin']);

    await upsertEntityTypeCategory({ name, label });
    revalidatePath(KnownPages.Directories);
}

export async function createEntityTypeCategoryFromForm(formData: FormData) {
    const name = formData.get('name') as string;
    const label = formData.get('label') as string;

    await createEntityTypeCategory(name, label);
}

export async function updateEntityTypeCategoryFromForm(categoryId: number, formData: FormData) {
    const name = formData.get('name') as string;
    const label = formData.get('label') as string;

    await updateEntityTypeCategory(categoryId, name, label);
}

export async function removeEntityTypeCategoryById(categoryId: number) {
    await removeEntityTypeCategory(categoryId);
}

export async function updateEntityTypeCategory(id: number, name: string, label: string) {
    await auth(['admin']);

    await upsertEntityTypeCategory({ id, name, label });
    revalidatePath(KnownPages.Directories);
}

export async function removeEntityTypeCategory(id: number) {
    await auth(['admin']);

    await deleteEntityTypeCategory(id);
    revalidatePath(KnownPages.Directories);
}
