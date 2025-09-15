'use server';

import { lexinsert } from '@gredice/js/lexorder';
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

export async function reorderAttributeDefinitionCategory(
    entityTypeName: string,
    categoryId: number,
    prevOrder?: string | null,
    nextOrder?: string | null,
) {
    await auth(['admin']);
    const order = lexinsert(prevOrder ?? undefined, nextOrder ?? undefined);
    await storageUpdateAttributeDefinitionCategory({ id: categoryId, order });
    revalidatePath(
        KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName),
    );
}

export async function reorderAttributeDefinition(
    entityTypeName: string,
    definitionId: number,
    prevOrder?: string | null,
    nextOrder?: string | null,
) {
    await auth(['admin']);
    const order = lexinsert(prevOrder ?? undefined, nextOrder ?? undefined);
    await storageUpdateAttributeDefinition({ id: definitionId, order });
    revalidatePath(
        KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName),
    );
}

export async function createAttributeDefinitionFromForm(
    entityTypeName: string,
    categoryName: string,
    formData: FormData,
) {
    await auth(['admin']);

    const name = formData.get('name') as string;
    const label = formData.get('label') as string;
    const dataType = formData.get('dataType') as string;

    await upsertAttributeDefinition({
        name,
        label,
        dataType,
        entityTypeName,
        category: categoryName,
    });
}

export async function createAttributeDefinitionCategoryFromForm(
    entityTypeName: string,
    formData: FormData,
) {
    await auth(['admin']);

    const name = formData.get('name') as string;
    const label = formData.get('label') as string;

    await storageCreateAttributeDefinitionCategory({
        name,
        label,
        entityTypeName,
    });
}
