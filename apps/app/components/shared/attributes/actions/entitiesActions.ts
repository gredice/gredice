'use server';

import { getEntitiesRaw } from '@gredice/storage';
import {
    entityAttributeValue,
    entityDisplayName,
} from '../../../../src/entities/entityAttributes';

export async function getEntities(entityTypeName: string) {
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
}
