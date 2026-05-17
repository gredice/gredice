import { searchDirectoryEntities } from '@gredice/storage';

export type SearchEntitiesInput = {
    query: string;
    entityTypes?: string[];
    limit: number;
};

function normalizeEntityTypeName(entityTypeName: string) {
    switch (entityTypeName) {
        case 'sort':
        case 'plant-sort':
        case 'plant_sort':
            return 'plantSort';
        default:
            return entityTypeName;
    }
}

export async function handleSearchEntities(
    input: SearchEntitiesInput,
    signal?: AbortSignal,
) {
    signal?.throwIfAborted();
    const entityTypeNames = input.entityTypes?.length
        ? input.entityTypes.map(normalizeEntityTypeName)
        : undefined;
    const rows = await getSearchRows({
        query: input.query,
        entityTypeNames,
        limit: input.limit,
    });
    signal?.throwIfAborted();

    const results = rows.map((row) => ({
        id: row.entityId.toString(),
        type: row.entityTypeName,
        publicCategory: row.publicCategory,
        publicCategoryLabel: row.publicCategoryLabel,
        name: row.title,
        description: row.summary ?? '',
        url: row.publicUrl,
        imageUrl: row.imageUrl,
        imageAlt: row.imageAlt,
        relevance: row.score,
    }));

    return {
        results,
        total: results.length,
        query: input.query,
        limit: input.limit,
        entityTypes: input.entityTypes ?? null,
    };
}

async function getSearchRows(input: {
    query: string;
    entityTypeNames: string[] | undefined;
    limit: number;
}) {
    try {
        return await searchDirectoryEntities(input);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Directory search data not available: ${message}`);
        return [];
    }
}
