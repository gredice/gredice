'use server';

import {
    getAttributeDefinitions,
    getEntityRaw,
    upsertAttributeValue,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../../lib/auth/auth';
import { revalidatePublicDirectoryPagesForEntityType } from '../../../../lib/revalidation/publicDirectoryPages';
import { KnownPages } from '../../../../src/KnownPages';

const maxEntityImportSizeBytes = 1024 * 1024;

export async function importEntityData(
    entityType: string,
    entityId: number,
    formData: FormData,
) {
    await auth(['admin']);

    const file = formData.get('entityJson');
    if (!file || typeof file === 'string') {
        throw new Error('No file uploaded');
    }
    if (file.size > maxEntityImportSizeBytes) {
        throw new Error('Import file must not exceed 1 MB');
    }
    const text = await file.text();
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('Invalid JSON');
    }
    const entity = await getEntityRaw(entityId);
    if (!entity) {
        throw new Error('Entity not found');
    }
    if (entity.entityTypeName !== entityType) {
        throw new Error('Entity type does not match the requested entity');
    }

    const attributeDefinitions = await getAttributeDefinitions(entityType);
    const definitionByName = new Map(
        attributeDefinitions.map((def) => [def.name, def]),
    );

    // Only support object format: { attributeName: value, ... }
    if (typeof data !== 'object' || data === null) {
        throw new Error(
            'Invalid attribute values format: only object format is supported',
        );
    }

    for (const [name, value] of Object.entries(data)) {
        const definition = definitionByName.get(name);
        if (!definition) {
            continue;
        }
        const stringValue = value != null ? String(value) : null;
        if (
            stringValue !== null &&
            definition.dataType.startsWith('ref:') &&
            !/^\d+$/.test(stringValue.trim())
        ) {
            throw new Error(
                `Attribute "${name}" is a ${definition.dataType} reference and must be a numeric entity ID.`,
            );
        }
        await upsertAttributeValue({
            entityId,
            entityTypeName: entityType,
            attributeDefinitionId: definition.id,
            value: stringValue,
            order: '0',
        });
    }

    revalidatePath(KnownPages.DirectoryEntity(entityType, entityId));
    revalidatePath(KnownPages.DirectoryEntityType(entityType));
    await revalidatePublicDirectoryPagesForEntityType(
        entityType,
        'entity.import',
    );

    return { success: true };
}
