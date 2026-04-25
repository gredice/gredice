'use server';

import { getEntitiesFormatted, getEntitiesRaw } from '@gredice/storage';
import { unstable_cache } from 'next/cache';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import {
    entityAttributeValue,
    entityDisplayName,
} from '../../../../src/entities/entityAttributes';

export async function getEntities(entityTypeName: string) {
    return getEntitiesFormatted<EntityStandardized>(entityTypeName);
}

export async function getRefEntities(entityTypeName: string) {
    return unstable_cache(
        async () => {
            const entities = await getEntitiesRaw(entityTypeName);
            return entities.flatMap((entity) => {
                const name = entityAttributeValue(
                    entity,
                    'information',
                    'name',
                );
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
        },
        ['ref-entities', entityTypeName],
        {
            revalidate: 60 * 60,
        },
    )();
}
