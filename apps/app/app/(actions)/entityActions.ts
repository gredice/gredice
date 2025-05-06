'use server';

import {
    deleteAttributeValue,
    deleteEntity,
    SelectAttributeDefinition,
    SelectAttributeValue,
    createEntity as storageCreateEntity,
    updateEntity as storageUpdateEntity,
    duplicateEntity as storageDuplicateEntity,
    UpdateEntity,
    upsertAttributeValue,
    upsertEntityType
} from "@gredice/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth/auth";
import { KnownPages } from "../../src/KnownPages";

export async function createEntityType(entityTypeName: string, label: string) {
    await auth(['admin']);

    await upsertEntityType({ name: entityTypeName, label: label });
    revalidatePath(KnownPages.Directories);
    redirect(KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName));
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

export async function duplicateEntity(entityTypeName: string, entityId: number) {
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
    newValue?: string | null) {
    await auth(['admin']);

    const newAttributeValueValue = (newValue?.length ?? 0) <= 0 ? null : newValue;
    await upsertAttributeValue({
        id: attributeValueId,
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
    revalidatePath(`/admin/directories/${attributeValue.entityTypeName}/${attributeValue.entityId}`);
}

export async function handleEntityDelete(entityTypeName: string, entityId: number) {
    await auth(['admin']);

    await deleteEntity(entityId);
    revalidatePath(KnownPages.Directories);
    redirect(KnownPages.DirectoryEntityType(entityTypeName));
}