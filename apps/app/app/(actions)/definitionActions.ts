'use server';

import {
    InsertAttributeDefinition,
    createAttributeDefinition as storageCreateAttributeDefinition,
    updateAttributeDefinition as storageUpdateAttributeDefinition,
    deleteAttributeDefinition as storageDeleteAttributeDefinition,
    createAttributeDefinitionCategory as storageCreateAttributeDefinitionCategory,
    updateAttributeDefinitionCategory as storageUpdateAttributeDefinitionCategory,
    InsertAttributeDefinitionCategory
} from "@gredice/storage";
import { auth } from "../../lib/auth/auth";
import { KnownPages } from "../../src/KnownPages";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function upsertAttributeDefinition(definition: InsertAttributeDefinition) {
    await auth(['admin']);

    const id = definition.id;
    if (id) {
        await storageUpdateAttributeDefinition({
            ...definition,
            id
        });
    } else {
        await storageCreateAttributeDefinition(definition);
    }
    revalidatePath(KnownPages.DirectoryEntityTypeAttributeDefinitions(definition.entityTypeName));
}

export async function deleteAttributeDefinition(entityTypeName: string, definitionId: number) {
    await auth(['admin']);

    await storageDeleteAttributeDefinition(definitionId);
    revalidatePath(KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName));
    redirect(KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName));
}

export async function upsertAttributeDefinitionCategory(category: InsertAttributeDefinitionCategory) {
    await auth(['admin']);

    const id = category.id;
    if (id) {
        await storageUpdateAttributeDefinitionCategory({
            ...category,
            id
        });
    } else {
        await storageCreateAttributeDefinitionCategory(category);
    }
    revalidatePath(KnownPages.DirectoryEntityTypeAttributeDefinitions(category.entityTypeName));
}