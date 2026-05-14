'use server';

import {
    deleteEntityTypeCategory,
    upsertEntityTypeCategory,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function createEntityTypeCategory(
    name: string,
    label: string,
    icon?: string,
) {
    await auth(['admin']);

    await upsertEntityTypeCategory({ name, label, icon: icon || null });
    revalidatePath(KnownPages.Directories);
}

export async function createEntityTypeCategoryFromForm(formData: FormData) {
    const name = formData.get('name') as string;
    const label = formData.get('label') as string;
    const icon = (formData.get('icon') as string) || undefined;
    const resolvedIcon = icon === 'none' ? undefined : icon;

    await createEntityTypeCategory(name, label, resolvedIcon);
}

export async function updateEntityTypeCategoryFromForm(
    categoryId: number,
    formData: FormData,
) {
    const name = formData.get('name') as string;
    const label = formData.get('label') as string;
    const icon = (formData.get('icon') as string) || undefined;
    const resolvedIcon = icon === 'none' ? undefined : icon;

    await updateEntityTypeCategory(categoryId, name, label, resolvedIcon);
}

export async function removeEntityTypeCategoryById(categoryId: number) {
    await removeEntityTypeCategory(categoryId);
}

export async function updateEntityTypeCategory(
    id: number,
    name: string,
    label: string,
    icon?: string,
) {
    await auth(['admin']);

    await upsertEntityTypeCategory({ id, name, label, icon: icon || null });
    revalidatePath(KnownPages.Directories);
}

export async function removeEntityTypeCategory(id: number) {
    await auth(['admin']);

    await deleteEntityTypeCategory(id);
    revalidatePath(KnownPages.Directories);
}
