'use server';

import {
    getAnalyticsTotals,
    getEntitiesRaw,
    getEntityTypes,
} from '@gredice/storage';

export async function getAnalyticsData(days: number) {
    const [analyticsResult, entityTypes] = await Promise.all([
        getAnalyticsTotals(days),
        getEntityTypes(),
    ]);

    const entitiesCounts = await Promise.all(
        entityTypes.map(async (entityType) => {
            const entities = await getEntitiesRaw(entityType.name);
            return {
                entityTypeName: entityType.name,
                label: entityType.label,
                count: entities.length,
            };
        }),
    );

    return {
        analytics: analyticsResult,
        entities: entitiesCounts,
    };
}
