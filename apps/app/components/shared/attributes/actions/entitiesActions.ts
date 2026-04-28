'use server';

import { getEntitiesFormatted, getEntitiesRaw } from '@gredice/storage';
import { cache } from 'react';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import {
    entityAttributeValue,
    entityDisplayName,
} from '../../../../src/entities/entityAttributes';

export async function getEntities(entityTypeName: string) {
    return getEntitiesFormatted<EntityStandardized>(entityTypeName);
}

export const getRefEntities = cache(async (entityTypeName: string) => {
    const entities = await getEntitiesRaw(entityTypeName);
    return entities.flatMap((entity) => {
        const name = entityAttributeValue(entity, 'information', 'name');
        if (!name) {
            return [];
        }

        return [
            {
                id: entity.id,
                name,
                label: entityDisplayName(entity),
                state: entity.state,
            },
        ];
    });
});
