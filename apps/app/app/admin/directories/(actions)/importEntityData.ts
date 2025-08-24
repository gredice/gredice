'use server';

import {
    getAttributeDefinitions,
    getEntityRaw,
    upsertAttributeValue,
} from '@gredice/storage';

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
    const nameToId = Object.fromEntries(
        attributeDefinitions.map((def) => [def.name, def.id]),
    );

    // Only support object format: { attributeName: value, ... }
    if (typeof data !== 'object' || data === null) {
        throw new Error(
            'Invalid attribute values format: only object format is supported',
        );
    }

    for (const [name, value] of Object.entries(data)) {
        const attributeDefinitionId = nameToId[name];
        if (!attributeDefinitionId) {
            console.warn(`Attribute definition not found for name: ${name}`);
            continue;
        }
        await upsertAttributeValue({
            entityId,
            entityTypeName: entityType,
            attributeDefinitionId,
            value: value != null ? String(value) : null,
            order: '0',
        });
        console.debug(
            `Imported attribute: ${name} with value: ${value} for entity: ${entityId}`,
        );
    }

    return { success: true };
}
