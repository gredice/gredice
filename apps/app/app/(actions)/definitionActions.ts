'use server';

import {
    type InsertAttributeDefinition,
    type InsertAttributeDefinitionCategory,
    createAttributeDefinition as storageCreateAttributeDefinition,
    createAttributeDefinitionCategory as storageCreateAttributeDefinitionCategory,
    deleteAttributeDefinition as storageDeleteAttributeDefinition,
    getAttributeDefinition as storageGetAttributeDefinition,
    updateAttributeDefinition as storageUpdateAttributeDefinition,
    updateAttributeDefinitionCategory as storageUpdateAttributeDefinitionCategory,
    type UpdateAttributeDefinition,
    type UpdateAttributeDefinitionCategory,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '../../lib/auth/auth';
import { KnownPages } from '../../src/KnownPages';

export async function upsertAttributeDefinition(
    definition: InsertAttributeDefinition | UpdateAttributeDefinition,
) {
    await auth(['admin']);

    const id = definition.id;
    if (id) {
        await storageUpdateAttributeDefinition({
            ...definition,
            id,
        });
    } else {
        // Validate required fields
        const name = definition.name;
        const label = definition.label;
        const entityTypeName = definition.entityTypeName;
        const category = definition.category;
        const dataType = definition.dataType;
        if (!name || !label || !entityTypeName || !category || !dataType) {
            console.error('Missing required fields', {
                name,
                label,
                entityTypeName,
                category,
                dataType,
            });
            throw new Error('Missing required fields.');
        }

        await storageCreateAttributeDefinition({
            ...definition,
            name,
            label,
            entityTypeName,
            category,
            dataType,
        });
    }

    // Retrieve the entity type name from the definition
    const entityTypeName = definition.entityTypeName;
    if (entityTypeName) {
        revalidatePath(
            KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName),
        );
    } else if (!entityTypeName && id) {
        const definition = await storageGetAttributeDefinition(id);
        if (!definition) {
            throw new Error('Definition not found');
        }
        revalidatePath(
            KnownPages.DirectoryEntityTypeAttributeDefinitions(
                definition.entityTypeName,
            ),
        );
    }
}

export async function deleteAttributeDefinition(
    entityTypeName: string,
    definitionId: number,
) {
    await auth(['admin']);

    await storageDeleteAttributeDefinition(definitionId);
    revalidatePath(
        KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName),
    );
    redirect(
        KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName),
    );
}

export async function upsertAttributeDefinitionCategory(
    category:
        | InsertAttributeDefinitionCategory
        | UpdateAttributeDefinitionCategory,
) {
    await auth(['admin']);

    const id = category.id;
    if (id) {
        await storageUpdateAttributeDefinitionCategory({
            ...category,
            id,
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
            entityTypeName,
        });
    }
    if (category.entityTypeName) {
        revalidatePath(
            KnownPages.DirectoryEntityTypeAttributeDefinitions(
                category.entityTypeName,
            ),
        );
    }
}

export async function createAttributeDefinition(
    entityTypeName: string,
    categoryName: string,
    formData: FormData,
) {
    await upsertAttributeDefinition({
        name: formData.get('name') as string,
        label: formData.get('label') as string,
        dataType: formData.get('dataType') as string,
        entityTypeName,
        category: categoryName,
    });
}

export async function createAttributeDefinitionCategory(
    entityTypeName: string,
    formData: FormData,
) {
    await upsertAttributeDefinitionCategory({
        name: formData.get('name') as string,
        label: formData.get('label') as string,
        entityTypeName,
    });
}
