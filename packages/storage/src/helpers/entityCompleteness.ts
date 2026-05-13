export type EntityCompletenessAttributeDefinition = {
    id: number;
    category: string;
    label: string;
    required: boolean;
    defaultValue: string | null;
};

export type EntityCompletenessAttribute = {
    attributeDefinitionId: number;
    value: string | null;
};

export type EntityCompletenessEntity = {
    attributes: EntityCompletenessAttribute[];
    state?: string;
};

export type EntityCompletenessFilter = 'complete' | 'incomplete' | '';
export type EntityPublishStateFilter = 'draft' | 'published' | '';

export type EntityCompleteness = {
    requiredCount: number;
    completedRequiredCount: number;
    missingRequiredDefinitions: EntityCompletenessAttributeDefinition[];
    progress: number;
    isComplete: boolean;
};

export function getEntityCompleteness(
    entity: EntityCompletenessEntity,
    definitions: EntityCompletenessAttributeDefinition[],
): EntityCompleteness {
    const requiredDefinitions = definitions.filter(
        (definition) => definition.required,
    );

    if (!requiredDefinitions.length) {
        return {
            requiredCount: 0,
            completedRequiredCount: 0,
            missingRequiredDefinitions: [],
            progress: 100,
            isComplete: true,
        };
    }

    const missingRequiredDefinitions = requiredDefinitions.filter(
        (definition) =>
            !definition.defaultValue &&
            !entity.attributes.some(
                (attribute) =>
                    attribute.attributeDefinitionId === definition.id &&
                    (attribute.value?.length ?? 0) > 0,
            ),
    );
    const completedRequiredCount =
        requiredDefinitions.length - missingRequiredDefinitions.length;
    const progress =
        (completedRequiredCount / requiredDefinitions.length) * 100;

    return {
        requiredCount: requiredDefinitions.length,
        completedRequiredCount,
        missingRequiredDefinitions,
        progress,
        isComplete: progress >= 99.99,
    };
}

export function filterEntitiesByCompletionAndState<
    TEntity extends EntityCompletenessEntity,
>(
    entities: TEntity[],
    definitions: EntityCompletenessAttributeDefinition[],
    filters: {
        completion?: string;
        state?: string;
    },
) {
    return entities.filter((entity) => {
        if (
            filters.state &&
            (filters.state === 'draft' || filters.state === 'published') &&
            entity.state !== filters.state
        ) {
            return false;
        }

        if (filters.completion === 'complete') {
            return getEntityCompleteness(entity, definitions).isComplete;
        }

        if (filters.completion === 'incomplete') {
            return !getEntityCompleteness(entity, definitions).isComplete;
        }

        return true;
    });
}

export function getIncompleteEntityCountsByState<
    TEntity extends EntityCompletenessEntity,
>(entities: TEntity[], definitions: EntityCompletenessAttributeDefinition[]) {
    return {
        draft: filterEntitiesByCompletionAndState(entities, definitions, {
            completion: 'incomplete',
            state: 'draft',
        }).length,
        published: filterEntitiesByCompletionAndState(entities, definitions, {
            completion: 'incomplete',
            state: 'published',
        }).length,
    };
}
