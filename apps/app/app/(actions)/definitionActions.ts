'use server';

import {
    InsertAttributeDefinition,
    getAttributeDefinition as storageGetAttributeDefinition,
    createAttributeDefinition as storageCreateAttributeDefinition,
    updateAttributeDefinition as storageUpdateAttributeDefinition,
    deleteAttributeDefinition as storageDeleteAttributeDefinition,
    createAttributeDefinitionCategory as storageCreateAttributeDefinitionCategory,
    updateAttributeDefinitionCategory as storageUpdateAttributeDefinitionCategory,
    InsertAttributeDefinitionCategory,
    UpdateAttributeDefinitionCategory,
    UpdateAttributeDefinition
} from "@gredice/storage";
import { auth } from "../../lib/auth/auth";
import { KnownPages } from "../../src/KnownPages";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function upsertAttributeDefinition(definition: InsertAttributeDefinition | UpdateAttributeDefinition) {
    await auth(['admin']);

    const id = definition.id;
    if (id) {
        await storageUpdateAttributeDefinition({
            ...definition,
            id
        });
    } else {
        // Validate required fields
        const name = definition.name;
        const label = definition.label;
        const entityTypeName = definition.entityTypeName;
        const category = definition.category;
        const dataType = definition.dataType;
        if (!name || !label || !entityTypeName || !category || !dataType) {
            console.error('Missing required fields', { name, label, entityTypeName, category, dataType });
            throw new Error('Missing required fields.');
        }

        await storageCreateAttributeDefinition({
            ...definition,
            name,
            label,
            entityTypeName,
            category,
            dataType
        });
    }

    // Retrieve the entity type name from the definition
    const entityTypeName = definition.entityTypeName;
    if (entityTypeName) {
        revalidatePath(KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName));
    } else if (!entityTypeName && id) {
        const definition = await storageGetAttributeDefinition(id);
        if (!definition) {
            throw new Error('Definition not found');
        }
        revalidatePath(KnownPages.DirectoryEntityTypeAttributeDefinitions(definition.entityTypeName));
    }
}

export async function deleteAttributeDefinition(entityTypeName: string, definitionId: number) {
    await auth(['admin']);

    await storageDeleteAttributeDefinition(definitionId);
    revalidatePath(KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName));
    redirect(KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName));
}

export async function upsertAttributeDefinitionCategory(category: InsertAttributeDefinitionCategory | UpdateAttributeDefinitionCategory) {
    await auth(['admin']);

    const id = category.id;
    if (id) {
        await storageUpdateAttributeDefinitionCategory({
            ...category,
            id
        });
    } else {
        const name = category.name;
        const label = category.label;
        const entityTypeName = category.entityTypeName;
        if (!name || !label || !entityTypeName) {
            throw new Error('Missing required fields');
        }

        await storageCreateAttributeDefinitionCategory({
            ...category,
            name,
            label,
            entityTypeName
        });
    }
    if (category.entityTypeName) {
        revalidatePath(KnownPages.DirectoryEntityTypeAttributeDefinitions(category.entityTypeName));
    }
}