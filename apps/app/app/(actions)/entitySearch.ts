'use server';

import { getAttributeDefinitions, getEntitiesRaw } from '@gredice/storage';
import { auth } from '../../lib/auth/auth';
import { entityDisplayName } from '../../src/entities/entityAttributes';

export async function searchEntities(entityTypeName: string, search: string) {
    await auth(['admin']);
    const [entities, definitions] = await Promise.all([
        getEntitiesRaw(entityTypeName),
        getAttributeDefinitions(entityTypeName),
    ]);

    const requiredDefinitions = definitions.filter((d) => d.required);
    const numberOfRequiredAttributes = requiredDefinitions.length;
    const lowerSearch = search.toLowerCase();

    return entities
        .map((entity) => {
            const notPopulatedRequiredAttributes = requiredDefinitions.filter(
                (d) =>
                    !d.defaultValue &&
                    !entity.attributes.some(
                        (a) =>
                            a.attributeDefinitionId === d.id &&
                            (a.value?.length ?? 0) > 0,
                    ),
            );
            const progress =
                numberOfRequiredAttributes > 0
                    ? ((numberOfRequiredAttributes -
                          notPopulatedRequiredAttributes.length) /
                          numberOfRequiredAttributes) *
                      100
                    : 100;
            const statusLabel =
                entity.state === 'draft' ? 'U izradi' : 'Objavljeno';
            const searchString =
                `${entityDisplayName(entity)} ${progress.toFixed(0)}% ${statusLabel} ${entity.updatedAt}`.toLowerCase();

            return {
                id: entity.id,
                displayName: entityDisplayName(entity),
                progress,
                missingRequiredAttributes: notPopulatedRequiredAttributes.map(
                    (a) => a.label,
                ),
                state: entity.state,
                updatedAt: entity.updatedAt,
                match: searchString.includes(lowerSearch),
            };
        })
        .filter((e) => e.match)
        .map(({ match, ...rest }) => rest);
}
