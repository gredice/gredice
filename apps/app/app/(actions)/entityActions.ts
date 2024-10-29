'use server';

import { deleteAttributeValue, deleteEntity, SelectAttributeDefinition, SelectAttributeValue, createEntity as storageCreateEntity, upsertAttributeValue, upsertEntityType } from "@gredice/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth/auth";
import { KnownPages } from "../../src/KnownPages";

export async function createEntityType(entityTypeName: string, label: string) {
    await auth();

    await upsertEntityType({ name: entityTypeName, label: label });
    revalidatePath(KnownPages.Directories);
    redirect(KnownPages.DirectoryEntityType(entityTypeName));
}

export async function createEntity(entityTypeName: string) {
    await auth();

    const entityId = await storageCreateEntity(entityTypeName);
    revalidatePath(KnownPages.Directories);
    revalidatePath(KnownPages.DirectoryEntityType(entityTypeName));
    revalidatePath(KnownPages.DirectoryEntity(entityTypeName, entityId));
    redirect(KnownPages.DirectoryEntity(entityTypeName, entityId));
}

export async function handleValueSave(
    entityTypeName: string,
    entityId: number,
    attributeDefinition: SelectAttributeDefinition,
    attributeValueId?: number,
    newValue?: string | null) {
    await auth();

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
    await auth();

    await deleteAttributeValue(attributeValue.id);
    revalidatePath(`/admin/directories/${attributeValue.entityTypeName}/${attributeValue.entityId}`);
    redirect(`/admin/directories/${attributeValue.entityTypeName}`);
}

export async function handleEntityDelete(entityTypeName: string, entityId: number) {
    await auth();

    await deleteEntity(entityId);
    revalidatePath(KnownPages.Directories);
    redirect(KnownPages.DirectoryEntityType(entityTypeName));
}