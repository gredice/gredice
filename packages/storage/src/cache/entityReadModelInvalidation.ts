import 'server-only';
import { like } from 'drizzle-orm';
import { attributeDefinitions } from '../schema';
import { storage } from '../storage';
import { bustCached, cacheKeys } from './directoriesCached';

export type EntityReadModelReferenceDependency = {
    entityTypeName: string;
    dataType: string;
};

const derivedReadModelDependencies = [
    { dependency: 'brand', dependent: 'seed' },
    { dependency: 'plantDisease', dependent: 'plant' },
    { dependency: 'plantPest', dependent: 'plant' },
    { dependency: 'plantStage', dependent: 'operation' },
    { dependency: 'operation', dependent: 'plant' },
    { dependency: 'plant', dependent: 'plantSort' },
    { dependency: 'plantSort', dependent: 'seed' },
] as const;

export function entityReadModelInvalidationClosure(
    mutatedEntityTypeNames: Iterable<string>,
    referenceDependencies: Iterable<EntityReadModelReferenceDependency>,
) {
    const dependentsByDependency = new Map<string, Set<string>>();
    const addDependency = (dependency: string, dependent: string) => {
        const dependents = dependentsByDependency.get(dependency) ?? new Set();
        dependents.add(dependent);
        dependentsByDependency.set(dependency, dependents);
    };

    for (const { entityTypeName, dataType } of referenceDependencies) {
        if (!dataType.startsWith('ref:')) continue;

        const dependency = dataType.slice('ref:'.length);
        if (dependency) {
            addDependency(dependency, entityTypeName);
        }
    }
    for (const { dependency, dependent } of derivedReadModelDependencies) {
        addDependency(dependency, dependent);
    }

    const closure = new Set<string>();
    const pending = Array.from(mutatedEntityTypeNames);
    while (pending.length > 0) {
        const entityTypeName = pending.shift();
        if (!entityTypeName || closure.has(entityTypeName)) continue;

        closure.add(entityTypeName);
        for (const dependent of dependentsByDependency.get(entityTypeName) ??
            []) {
            if (!closure.has(dependent)) {
                pending.push(dependent);
            }
        }
    }

    return Array.from(closure);
}

async function referenceDependencies() {
    try {
        return await storage()
            .select({
                entityTypeName: attributeDefinitions.entityTypeName,
                dataType: attributeDefinitions.dataType,
            })
            .from(attributeDefinitions)
            .where(like(attributeDefinitions.dataType, 'ref:%'));
    } catch (error) {
        console.warn(
            'Failed to load entity read-model reference dependencies',
            { error },
        );
        return [];
    }
}

export async function bustEntityReadModelsForMutatedTypes(
    entityTypeNames: Iterable<string>,
) {
    const invalidatedEntityTypeNames = entityReadModelInvalidationClosure(
        entityTypeNames,
        await referenceDependencies(),
    );

    await Promise.all(
        invalidatedEntityTypeNames.map((entityTypeName) =>
            bustCached(cacheKeys.entityTypeName(entityTypeName)),
        ),
    );

    return invalidatedEntityTypeNames;
}
