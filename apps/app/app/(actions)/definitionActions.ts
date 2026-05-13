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
import { revalidatePublicDirectoryPagesForEntityType } from '../../lib/revalidation/publicDirectoryPages';
import { KnownPages } from '../../src/KnownPages';

async function revalidateAttributeDefinitionPages(
    entityTypeName: string,
    reason: string,
) {
    revalidatePath(
        KnownPages.DirectoryEntityTypeAttributeDefinitions(entityTypeName),
    );
    await revalidatePublicDirectoryPagesForEntityType(entityTypeName, reason);
}

export async function upsertAttributeDefinition(
    definition: InsertAttributeDefinition | UpdateAttributeDefinition,
): Promise<{ id: number }> {
    await auth(['admin']);

    const id = definition.id;
    let resultId: number;
    if (id) {
        await storageUpdateAttributeDefinition({
            ...definition,
            id,
        });
        resultId = id;
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

        resultId = await storageCreateAttributeDefinition({
            ...definition,
            name,
            label,
            entityTypeName,
            category,
            dataType,
        });
    }

    let entityTypeName = definition.entityTypeName;
    if (!entityTypeName && id) {
        const storedDefinition = await storageGetAttributeDefinition(id);
        if (!storedDefinition) {
            throw new Error('Definition not found');
        }
        entityTypeName = storedDefinition.entityTypeName;
    }

    if (entityTypeName) {
        await revalidateAttributeDefinitionPages(
            entityTypeName,
            'attribute-definition.upsert',
        );
    }

    return { id: resultId };
}

export async function deleteAttributeDefinition(
    entityTypeName: string,
    definitionId: number,
) {
    await auth(['admin']);

    await storageDeleteAttributeDefinition(definitionId);
    await revalidateAttributeDefinitionPages(
        entityTypeName,
        'attribute-definition.delete',
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
        await revalidateAttributeDefinitionPages(
            category.entityTypeName,
            'attribute-definition-category.upsert',
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
    await revalidateAttributeDefinitionPages(
        entityTypeName,
        'attribute-definition-category.reorder',
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
    await revalidateAttributeDefinitionPages(
        entityTypeName,
        'attribute-definition.reorder',
    );
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
    await revalidateAttributeDefinitionPages(
        entityTypeName,
        'attribute-definition-category.create',
    );
}
