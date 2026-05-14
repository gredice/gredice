'use server';

import {
    getAttributeDefinitions,
    getEntityRaw,
    upsertAttributeValue,
} from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { revalidatePublicDirectoryPagesForEntityType } from '../../../../lib/revalidation/publicDirectoryPages';
import { KnownPages } from '../../../../src/KnownPages';

export async function importEntityData(
    entityType: string,
    entityId: number,
    formData: FormData,
) {
    console.debug(
        `Importing data for entity: ${entityId} of type: ${entityType}`,
    );

    const file = formData.get('entityJson');
    if (!file || typeof file === 'string') {
        throw new Error('No file uploaded');
    }
    const text = await file.text();
    console.debug(`File content: ${text}`);
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.error('Failed to parse JSON:', e);
        throw new Error('Invalid JSON');
    }
    const entity = await getEntityRaw(entityId);
    if (!entity) {
        throw new Error('Entity not found');
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
            console.warn(`Attribute definition not found for name: ${name}`);
            continue;
        }
        const stringValue = value != null ? String(value) : null;
        if (
            stringValue !== null &&
            definition.dataType.startsWith('ref:') &&
            !/^\d+$/.test(stringValue.trim())
        ) {
            throw new Error(
                `Attribute "${name}" is a ${definition.dataType} reference and must be a numeric entity ID; received: ${JSON.stringify(value)}.`,
            );
        }
        await upsertAttributeValue({
            entityId,
            entityTypeName: entityType,
            attributeDefinitionId: definition.id,
            value: stringValue,
            order: '0',
        });
        console.debug(
            `Imported attribute: ${name} with value: ${value} for entity: ${entityId}`,
        );
    }

    revalidatePath(KnownPages.DirectoryEntity(entityType, entityId));
    revalidatePath(KnownPages.DirectoryEntityType(entityType));
    await revalidatePublicDirectoryPagesForEntityType(
        entityType,
        'entity.import',
    );

    return { success: true };
}
