'use server';

import {
    deleteAttributeValue,
    deleteEntity,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
    createEntity as storageCreateEntity,
    duplicateEntity as storageDuplicateEntity,
    updateEntity as storageUpdateEntity,
    type UpdateEntity,
    upsertAttributeValue,
    upsertEntityType,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function createEntityType(
    entityTypeName: string,
    label: string,
    categoryId?: number,
) {
    await auth(['admin']);

    await upsertEntityType({ name: entityTypeName, label: label, categoryId });
    revalidatePath(KnownPages.Directories);
    redirect(
        KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName),
    );
}

export async function updateEntityType(
    id: number,
    entityTypeName: string,
    label: string,
    categoryId?: number,
) {
    await auth(['admin']);

    await upsertEntityType({ id, name: entityTypeName, label, categoryId });
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(entityTypeName));
}

export async function deleteEntityType(id: number) {
    await auth(['admin']);

    const { deleteEntityType: storageDeleteEntityType } = await import(
        '@gredice/storage'
    );
    await storageDeleteEntityType(id);
    revalidatePath(KnownPages.Directories);
    redirect(KnownPages.Directories);
}

export async function updateEntityTypeFromEditPage(formData: FormData) {
    await auth(['admin']);

    const id = parseInt(formData.get('id') as string, 10);
    const name = formData.get('name') as string;
    const label = formData.get('label') as string;
    const categoryId =
        (formData.get('categoryId') as string) === 'none'
            ? undefined
            : (formData.get('categoryId') as string);
    const originalName = formData.get('originalName') as string;

    await updateEntityType(
        id,
        name,
        label,
        categoryId ? parseInt(categoryId, 10) : undefined,
    );

    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(originalName));
    revalidatePath(KnownPages.DirectoryEntityType(name));
    redirect(KnownPages.DirectoryEntityType(name));
}

export async function deleteEntityTypeFromEditPage(formData: FormData) {
    await auth(['admin']);

    const id = parseInt(formData.get('id') as string, 10);
    await deleteEntityType(id);
}

export async function createEntity(entityTypeName: string) {
    await auth(['admin']);

    const entityId = await storageCreateEntity(entityTypeName);
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(entityTypeName));
    revalidatePath(KnownPages.DirectoryEntity(entityTypeName, entityId));
    redirect(KnownPages.DirectoryEntity(entityTypeName, entityId));
}

export async function updateEntity(entity: UpdateEntity) {
    await auth(['admin']);

    await storageUpdateEntity(entity);
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityPath, 'page');
    revalidatePath(KnownPages.DirectoryEntityPath, 'layout');
}

export async function duplicateEntity(
    entityTypeName: string,
    entityId: number,
) {
    await auth(['admin']);

    const newEntityId = await storageDuplicateEntity(entityId);
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(entityTypeName));
    redirect(KnownPages.DirectoryEntity(entityTypeName, newEntityId));
}

export async function handleValueSave(
    entityTypeName: string,
    entityId: number,
    attributeDefinition: SelectAttributeDefinition,
    attributeValueId?: number,
    newValue?: string | null,
) {
    await auth(['admin']);

    const newAttributeValueValue =
        (newValue?.length ?? 0) <= 0 ? null : newValue;
    await upsertAttributeValue({
        id: !attributeValueId ? undefined : attributeValueId,
        attributeDefinitionId: attributeDefinition.id,
        entityTypeName: entityTypeName,
        entityId: entityId,
        value: newAttributeValueValue,
    });
    revalidatePath(KnownPages.DirectoryEntity(entityTypeName, entityId));
}

export async function handleValueDelete(attributeValue: SelectAttributeValue) {
    await auth(['admin']);

    await deleteAttributeValue(attributeValue.id);
    revalidatePath(
        `/admin/directories/${attributeValue.entityTypeName}/${attributeValue.entityId}`,
    );
}

export async function handleEntityDelete(
    entityTypeName: string,
    entityId: number,
) {
    await auth(['admin']);

    await deleteEntity(entityId);
    revalidatePath(KnownPages.Directories);
    redirect(KnownPages.DirectoryEntityType(entityTypeName));
}