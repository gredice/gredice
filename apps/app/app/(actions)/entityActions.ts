'use server';

import { deleteAttributeValue, deleteEntity, SelectAttributeDefinition, SelectAttributeValue, createEntity as storageCreateEntity, upsertAttributeValue, upsertEntityType } from "@gredice/storage";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth/auth";

export async function createEntityType(entityTypeName: string, label: string) {
    await auth();

    await upsertEntityType({ name: entityTypeName, label: label });
    revalidatePath(`/admin/directories`);
    redirect(`/admin/directories/${entityTypeName}`);
}

export async function createEntity(entityType: string) {
    await auth();

    const entityId = await storageCreateEntity(entityType);
    revalidatePath(`/admin/directories/${entityType}`);
    redirect(`/admin/directories/${entityType}/${entityId}`);
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
    revalidatePath(`/admin/directories/${entityTypeName}/${entityId}`);
}

export async function handleValueDelete(attributeValue: SelectAttributeValue) {
    await auth();

    await deleteAttributeValue(attributeValue.id);
    revalidatePath(`/admin/directories/${attributeValue.entityTypeName}/${attributeValue.entityId}`);
    redirect(`/admin/directories/${attributeValue.entityTypeName}`);
}

export async function handleEntityDelete({ entityTypeName, entityId }: { entityTypeName: string, entityId: number }) {
    await auth();

    await deleteEntity(entityId);
    revalidatePath(`/admin/directories/${entityTypeName}`);
    redirect(`/admin/directories/${entityTypeName}`);
}