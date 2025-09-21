'use server';

import { getEntitiesFormatted } from '@gredice/storage';

export async function getEntities(entityTypeName: string) {
    return (await getEntitiesFormatted(entityTypeName)) as {
        id: number;
        information?: { name?: string; label?: string };
        // Note: other attributes may be present depending on entity type
        // For operations we rely on attributes.application to drive UI logic
        attributes?: {
            application?: 'garden' | 'raisedBedFull' | 'raisedBed1m' | 'plant';
            [key: string]: unknown;
        };
    }[];
}
