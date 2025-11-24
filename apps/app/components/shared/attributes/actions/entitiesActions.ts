'use server';

import {
    type EntityStandardized,
    getEntitiesFormatted,
} from '@gredice/storage';

export async function getEntities(entityTypeName: string) {
    return await getEntitiesFormatted<EntityStandardized>(entityTypeName);
}
