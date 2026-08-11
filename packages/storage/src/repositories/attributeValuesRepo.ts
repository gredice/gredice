import 'server-only';
import { getAdvancedSowingLayoutOptions } from '@gredice/js/plants';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { storage } from '..';
import {
    bustCached,
    bustCachedByPrefixes,
    cacheKeys,
} from '../cache/directoriesCached';
import {
    attributeDefinitionPath,
    generatedImageAttributeValue,
    parseGeneratedImageUrlDefaultValue,
} from '../helpers/generatedAttributeValues';
import {
    isPlantHealthAffectedPlantAttributeDefinition,
    isPlantHealthIssueEntityTypeName,
    parsePlantHealthReferenceTargetId,
    plantHealthAffectedPlantsAttributeName,
    plantHealthRelationshipCategory,
} from '../helpers/plantHealth';
import {
    isPlantRelationshipAttributeDefinition,
    plantRelationshipTargetIdForAttributeValue,
} from '../helpers/plantRelationships';
import {
    attributeDefinitions,
    attributeValues,
    entityRevisions,
    type InsertAttributeValue,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
} from '../schema';
import { assertOperationDefinitionCanBecomePlantScoped } from './operationsRepo';

type StorageClient = ReturnType<typeof storage>;
type TransactionClient = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = TransactionClient | StorageClient;

const advancedSowingAttributeNames = [
    'seedingDistance',
    'seedingDistanceMin',
    'seedingDistanceMax',
] as const;

type AdvancedSowingAttributeName =
    (typeof advancedSowingAttributeNames)[number];

const advancedSowingAttributeNameSet = new Set<string>(
    advancedSowingAttributeNames,
);

function isAdvancedSowingAttributeName(
    value: string,
): value is AdvancedSowingAttributeName {
    return advancedSowingAttributeNameSet.has(value);
}

function isOperationApplicationAttributeDefinition(
    definition:
        | Awaited<ReturnType<typeof getAttributeDefinitionForMutation>>
        | undefined,
) {
    return (
        definition?.entityTypeName === 'operation' &&
        definition.category === 'attributes' &&
        definition.name === 'application'
    );
}

type AttributeValueMutationOptions = {
    db?: DatabaseClient;
    sideEffects?: AttributeValueMutationSideEffects;
};

type InternalAttributeValueMutationOptions = AttributeValueMutationOptions & {
    /**
     * Private escape hatch used only by the atomic batch API, which owns the
     * surrounding transaction, plant locks, and final-state validation.
     */
    advancedSowingValidation?: 'deferred-by-batch';
};

export type AdvancedSowingAttributeValueExpectedCurrent =
    | { state: 'absent' }
    | {
          state: 'present';
          attributeValueId: number;
          value: string | null;
      };

export type AdvancedSowingAttributeValueBatchMutation = (
    | {
          action: 'upsert';
          attributeValue: InsertAttributeValue;
      }
    | {
          action: 'delete';
          attributeValueId: number;
      }
) & {
    expectedCurrent?: AdvancedSowingAttributeValueExpectedCurrent;
};

type AdvancedSowingAttributeValueBatchOptions =
    | {
          db?: undefined;
          sideEffects?: AttributeValueMutationSideEffects;
      }
    | {
          db: DatabaseClient;
          sideEffects: AttributeValueMutationSideEffects;
      };

export type AttributeValueMutationSideEffects = {
    dashboardAdmin: boolean;
    entityIds: Set<number>;
    entityTypeNames: Set<string>;
    searchEntityIds: Set<number>;
};

export function createAttributeValueMutationSideEffects(): AttributeValueMutationSideEffects {
    return {
        dashboardAdmin: false,
        entityIds: new Set(),
        entityTypeNames: new Set(),
        searchEntityIds: new Set(),
    };
}

function addAttributeValueMutationSideEffects(
    sideEffects: AttributeValueMutationSideEffects,
    input: {
        entityId?: number | null;
        entityTypeName?: string | null;
        relatedEntityIds?: number[];
    },
) {
    if (input.entityId) {
        sideEffects.entityIds.add(input.entityId);
        sideEffects.searchEntityIds.add(input.entityId);
    }
    if (input.entityTypeName) {
        sideEffects.entityTypeNames.add(input.entityTypeName);
    }
    for (const entityId of input.relatedEntityIds ?? []) {
        sideEffects.entityIds.add(entityId);
        sideEffects.searchEntityIds.add(entityId);
    }
    sideEffects.dashboardAdmin = true;
}

export async function flushAttributeValueMutationSideEffects(
    sideEffects: AttributeValueMutationSideEffects,
) {
    await Promise.all([
        ...Array.from(sideEffects.entityIds).map((entityId) =>
            bustCached(cacheKeys.entity(entityId)),
        ),
        ...Array.from(sideEffects.entityTypeNames).map((entityTypeName) =>
            bustCached(cacheKeys.entityTypeName(entityTypeName)),
        ),
        sideEffects.dashboardAdmin
            ? bustCachedByPrefixes(['dashboard:admin:'])
            : undefined,
    ]);

    await Promise.all(
        Array.from(sideEffects.searchEntityIds).map((entityId) =>
            refreshEntitySearchDocumentAfterMutation(entityId),
        ),
    );
}

async function getAttributeDefinitionForMutation(
    db: DatabaseClient,
    id: number,
) {
    return db.query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.id, id),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });
}

async function refreshEntitySearchDocumentAfterMutation(
    entityId: number | undefined,
) {
    if (!entityId) {
        return;
    }
    try {
        const { refreshImpactedEntitySearchDocuments } = await import(
            './entitySearchRepo'
        );
        await refreshImpactedEntitySearchDocuments(entityId);
    } catch (error) {
        console.error('Failed to refresh entity search document', {
            entityId,
            error,
        });
    }
}

async function getExistingAttributeValue({
    db,
    attributeDefinitionId,
    entityId,
}: {
    db: DatabaseClient;
    attributeDefinitionId: number;
    entityId: number;
}) {
    return db.query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.attributeDefinitionId, attributeDefinitionId),
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.isDeleted, false),
        ),
    });
}

async function upsertGeneratedAttributeValue({
    db,
    entityId,
    definition,
    existingValue,
    nextValue,
    missingValueBehavior = 'clear',
    actor,
}: {
    db: DatabaseClient;
    entityId: number;
    definition: SelectAttributeDefinition;
    existingValue: SelectAttributeValue | undefined;
    nextValue: string | null;
    missingValueBehavior?: 'clear' | 'delete';
    actor?: { id?: string; name?: string };
}) {
    if (nextValue === null && missingValueBehavior === 'delete') {
        if (!existingValue) {
            return false;
        }

        await Promise.all([
            db
                .update(attributeValues)
                .set({ isDeleted: true })
                .where(eq(attributeValues.id, existingValue.id)),
            db.insert(entityRevisions).values({
                entityId,
                entityTypeName: definition.entityTypeName,
                action: 'attribute.deleted',
                actorId: actor?.id,
                actorName: actor?.name,
                attributeValueId: existingValue.id,
                attributeDefinitionId: definition.id,
                previousValue: existingValue.value,
                nextValue: null,
            }),
        ]);
        return true;
    }

    if (existingValue?.value === nextValue) {
        return false;
    }

    if (!existingValue && nextValue === null) {
        return false;
    }

    if (existingValue) {
        await Promise.all([
            db
                .update(attributeValues)
                .set({
                    order: definition.order,
                    value: nextValue,
                })
                .where(eq(attributeValues.id, existingValue.id)),
            db.insert(entityRevisions).values({
                entityId,
                entityTypeName: definition.entityTypeName,
                action: 'attribute.updated',
                actorId: actor?.id,
                actorName: actor?.name,
                attributeValueId: existingValue.id,
                attributeDefinitionId: definition.id,
                previousValue: existingValue.value,
                nextValue,
            }),
        ]);
        return true;
    }

    const [createdValue] = await db
        .insert(attributeValues)
        .values({
            attributeDefinitionId: definition.id,
            entityId,
            entityTypeName: definition.entityTypeName,
            order: definition.order,
            value: nextValue,
        })
        .returning({ id: attributeValues.id });
    await db.insert(entityRevisions).values({
        entityId,
        entityTypeName: definition.entityTypeName,
        action: 'attribute.created',
        actorId: actor?.id,
        actorName: actor?.name,
        attributeValueId: createdValue.id,
        attributeDefinitionId: definition.id,
        previousValue: null,
        nextValue,
    });
    return true;
}

async function generatedAttributeValueForMutation({
    db,
    definition,
    entityId,
}: {
    db: DatabaseClient;
    definition: SelectAttributeDefinition;
    entityId: number | null | undefined;
}) {
    const config = parseGeneratedImageUrlDefaultValue(definition.defaultValue);
    if (!config) {
        return definition.defaultValue ?? null;
    }
    if (!entityId || definition.dataType !== 'image') {
        return null;
    }

    const [sourceCategory, ...sourceNameParts] = config.source.split('.');
    const sourceName = sourceNameParts.join('.');
    if (!sourceCategory || !sourceName) {
        return null;
    }

    const sourceDefinition = await db.query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.entityTypeName, definition.entityTypeName),
            eq(attributeDefinitions.category, sourceCategory),
            eq(attributeDefinitions.name, sourceName),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });
    if (!sourceDefinition) {
        return null;
    }

    const sourceValue = await getExistingAttributeValue({
        db,
        attributeDefinitionId: sourceDefinition.id,
        entityId,
    });
    return generatedImageAttributeValue(config, sourceValue?.value);
}

async function syncGeneratedAttributesForSource({
    db,
    sideEffects,
    entityId,
    sourceDefinition,
    sourceValue,
    missingValueBehavior,
    actor,
}: {
    db: DatabaseClient;
    sideEffects: AttributeValueMutationSideEffects;
    entityId: number | null | undefined;
    sourceDefinition: SelectAttributeDefinition;
    sourceValue: string | null | undefined;
    missingValueBehavior?: 'clear' | 'delete';
    actor?: { id?: string; name?: string };
}) {
    if (!entityId) {
        return;
    }

    const sourcePath = attributeDefinitionPath(sourceDefinition);
    const targetDefinitions = (
        await db.query.attributeDefinitions.findMany({
            where: and(
                eq(
                    attributeDefinitions.entityTypeName,
                    sourceDefinition.entityTypeName,
                ),
                eq(attributeDefinitions.dataType, 'image'),
                eq(attributeDefinitions.isDeleted, false),
            ),
        })
    ).filter((definition) => {
        const config = parseGeneratedImageUrlDefaultValue(
            definition.defaultValue,
        );
        return config?.source === sourcePath;
    });

    for (const definition of targetDefinitions) {
        const config = parseGeneratedImageUrlDefaultValue(
            definition.defaultValue,
        );
        if (!config) {
            continue;
        }

        const nextValue = generatedImageAttributeValue(config, sourceValue);

        const existingValue = await getExistingAttributeValue({
            db,
            attributeDefinitionId: definition.id,
            entityId,
        });
        const changed = await upsertGeneratedAttributeValue({
            db,
            entityId,
            definition,
            existingValue,
            nextValue,
            missingValueBehavior,
            actor,
        });

        if (changed) {
            addAttributeValueMutationSideEffects(sideEffects, {
                entityId,
                entityTypeName: definition.entityTypeName,
            });
        }
    }
}

async function plantHealthAffectedPlantIdsForMutation({
    db,
    definition,
    entityId,
    previousValue,
    nextValue,
}: {
    db: DatabaseClient;
    definition: Awaited<ReturnType<typeof getAttributeDefinitionForMutation>>;
    entityId: number | null | undefined;
    previousValue?: string | null;
    nextValue?: string | null;
}) {
    if (
        !definition ||
        !entityId ||
        !isPlantHealthIssueEntityTypeName(definition.entityTypeName)
    ) {
        return [];
    }

    const affectedPlantIds = new Set<number>();
    for (const value of [previousValue, nextValue]) {
        if (
            isPlantHealthAffectedPlantAttributeDefinition(definition) &&
            value
        ) {
            const targetId = parsePlantHealthReferenceTargetId(value);
            if (targetId) {
                affectedPlantIds.add(targetId);
            }
        }
    }

    const affectedPlantDefinitions =
        await db.query.attributeDefinitions.findMany({
            where: and(
                eq(attributeDefinitions.isDeleted, false),
                eq(
                    attributeDefinitions.entityTypeName,
                    definition.entityTypeName,
                ),
                eq(
                    attributeDefinitions.category,
                    plantHealthRelationshipCategory,
                ),
                eq(
                    attributeDefinitions.name,
                    plantHealthAffectedPlantsAttributeName,
                ),
                eq(attributeDefinitions.dataType, 'ref:plant'),
            ),
        });
    if (affectedPlantDefinitions.length === 0) {
        return Array.from(affectedPlantIds);
    }

    const affectedPlantValues = await db.query.attributeValues.findMany({
        where: and(
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.isDeleted, false),
            inArray(
                attributeValues.attributeDefinitionId,
                affectedPlantDefinitions.map(
                    (affectedPlantDefinition) => affectedPlantDefinition.id,
                ),
            ),
        ),
    });

    for (const affectedPlantValue of affectedPlantValues) {
        const targetId = parsePlantHealthReferenceTargetId(
            affectedPlantValue.value,
        );
        if (targetId) {
            affectedPlantIds.add(targetId);
        }
    }

    return Array.from(affectedPlantIds);
}

function isAdvancedSowingAttributeDefinition(
    definition: SelectAttributeDefinition | undefined,
): definition is SelectAttributeDefinition & {
    name: AdvancedSowingAttributeName;
} {
    return Boolean(
        definition &&
            definition.entityTypeName === 'plant' &&
            definition.category === 'attributes' &&
            isAdvancedSowingAttributeName(definition.name),
    );
}

function parseAdvancedSowingAttributeValue(
    name: AdvancedSowingAttributeName,
    value: string | null,
) {
    if (value === null) {
        return null;
    }

    const normalized = value.trim();
    const parsed = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(
        normalized,
    )
        ? Number(normalized)
        : Number.NaN;
    if (!Number.isFinite(parsed)) {
        throw new RangeError(
            `Advanced Sowing attributes.${name} must contain a finite number.`,
        );
    }

    return parsed;
}

type AdvancedSowingAttributeMutationEffect = {
    additions: Array<{
        name: AdvancedSowingAttributeName;
        value: string | null;
    }>;
    removedAttributeValueIds: Set<number>;
};

function advancedSowingMutationEffectForEntity(
    effects: Map<number, AdvancedSowingAttributeMutationEffect>,
    entityId: number,
) {
    const existing = effects.get(entityId);
    if (existing) {
        return existing;
    }

    const created: AdvancedSowingAttributeMutationEffect = {
        additions: [],
        removedAttributeValueIds: new Set(),
    };
    effects.set(entityId, created);
    return created;
}

async function assertProspectiveAdvancedSowingConfiguration(
    db: DatabaseClient,
    entityId: number,
    effect: AdvancedSowingAttributeMutationEffect,
) {
    const persistedValues = await db
        .select({
            id: attributeValues.id,
            name: attributeDefinitions.name,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .innerJoin(
            attributeDefinitions,
            eq(attributeValues.attributeDefinitionId, attributeDefinitions.id),
        )
        .where(
            and(
                eq(attributeValues.entityId, entityId),
                eq(attributeValues.isDeleted, false),
                eq(attributeDefinitions.isDeleted, false),
                eq(attributeDefinitions.entityTypeName, 'plant'),
                eq(attributeDefinitions.category, 'attributes'),
                inArray(attributeDefinitions.name, [
                    ...advancedSowingAttributeNames,
                ]),
            ),
        );

    const prospectiveValues = new Map<
        AdvancedSowingAttributeName,
        Array<string | null>
    >();
    for (const value of persistedValues) {
        if (
            effect.removedAttributeValueIds.has(value.id) ||
            !isAdvancedSowingAttributeName(value.name)
        ) {
            continue;
        }
        const values = prospectiveValues.get(value.name) ?? [];
        values.push(value.value);
        prospectiveValues.set(value.name, values);
    }
    for (const addition of effect.additions) {
        const values = prospectiveValues.get(addition.name) ?? [];
        values.push(addition.value);
        prospectiveValues.set(addition.name, values);
    }

    for (const [name, values] of prospectiveValues) {
        if (values.length > 1) {
            throw new RangeError(
                `Advanced Sowing attributes.${name} must have exactly one active value per plant.`,
            );
        }
    }

    const valueFor = (name: AdvancedSowingAttributeName) =>
        prospectiveValues.get(name)?.[0] ?? null;
    const hasConfiguredValue = advancedSowingAttributeNames.some(
        (name) => valueFor(name) !== null,
    );
    if (!hasConfiguredValue) {
        return;
    }

    const optimalDistanceCm = parseAdvancedSowingAttributeValue(
        'seedingDistance',
        valueFor('seedingDistance'),
    );
    if (optimalDistanceCm === null) {
        throw new RangeError(
            'Advanced Sowing attributes.seedingDistance is required when a spacing boundary is configured.',
        );
    }

    try {
        getAdvancedSowingLayoutOptions({
            optimalDistanceCm,
            minDistanceCm: parseAdvancedSowingAttributeValue(
                'seedingDistanceMin',
                valueFor('seedingDistanceMin'),
            ),
            maxDistanceCm: parseAdvancedSowingAttributeValue(
                'seedingDistanceMax',
                valueFor('seedingDistanceMax'),
            ),
        });
    } catch (error) {
        if (
            error instanceof RangeError &&
            error.message.startsWith('Advanced Sowing ')
        ) {
            throw error;
        }
        throw new RangeError(
            error instanceof Error
                ? `Invalid Advanced Sowing spacing: ${error.message}`
                : 'Invalid Advanced Sowing spacing.',
        );
    }
}

async function getAttributeDefinitionForExistingValue(
    db: DatabaseClient,
    existingValue: SelectAttributeValue | undefined,
) {
    if (!existingValue) {
        return undefined;
    }
    return getAttributeDefinitionForMutation(
        db,
        existingValue.attributeDefinitionId,
    );
}

async function upsertTouchesAdvancedSowingAttribute(
    db: DatabaseClient,
    attributeValue: InsertAttributeValue,
) {
    const targetDefinition = await getAttributeDefinitionForMutation(
        db,
        attributeValue.attributeDefinitionId,
    );
    if (isAdvancedSowingAttributeDefinition(targetDefinition)) {
        return true;
    }
    if (!attributeValue.id) {
        return false;
    }

    const existingValue = await db.query.attributeValues.findFirst({
        where: eq(attributeValues.id, attributeValue.id),
    });
    return isAdvancedSowingAttributeDefinition(
        await getAttributeDefinitionForExistingValue(db, existingValue),
    );
}

async function upsertMakesOperationPlantScoped(
    db: DatabaseClient,
    attributeValue: InsertAttributeValue,
) {
    const definition = await getAttributeDefinitionForMutation(
        db,
        attributeValue.attributeDefinitionId,
    );
    return (
        attributeValue.entityTypeName === 'operation' &&
        isOperationApplicationAttributeDefinition(definition) &&
        (attributeValue.value || definition?.defaultValue) === 'plant'
    );
}

async function deleteTouchesAdvancedSowingAttribute(
    db: DatabaseClient,
    id: number,
) {
    const existingValue = await db.query.attributeValues.findFirst({
        where: eq(attributeValues.id, id),
    });
    return isAdvancedSowingAttributeDefinition(
        await getAttributeDefinitionForExistingValue(db, existingValue),
    );
}

async function lockAdvancedSowingPlantMutations(
    db: DatabaseClient,
    entityIds: readonly number[],
) {
    for (const entityId of entityIds) {
        await db.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`advanced-sowing-spacing:${entityId.toString()}`}));`,
        );
    }
}

async function lockAndValidateAdvancedSowingMutation(
    db: DatabaseClient,
    effects: Map<number, AdvancedSowingAttributeMutationEffect>,
) {
    const entityIds = Array.from(effects.keys()).sort(
        (left, right) => left - right,
    );
    await lockAdvancedSowingPlantMutations(db, entityIds);
    for (const entityId of entityIds) {
        const effect = effects.get(entityId);
        if (effect) {
            await assertProspectiveAdvancedSowingConfiguration(
                db,
                entityId,
                effect,
            );
        }
    }
}

async function upsertAttributeValueInternal(
    attributeValue: InsertAttributeValue,
    actor?: { id?: string; name?: string },
    options?: InternalAttributeValueMutationOptions,
) {
    if (
        !options?.db &&
        options?.advancedSowingValidation !== 'deferred-by-batch'
    ) {
        const rootDb = storage();
        if (
            (await upsertTouchesAdvancedSowingAttribute(
                rootDb,
                attributeValue,
            )) ||
            (await upsertMakesOperationPlantScoped(rootDb, attributeValue))
        ) {
            const sideEffects =
                options?.sideEffects ??
                createAttributeValueMutationSideEffects();
            await rootDb.transaction((transaction) =>
                upsertAttributeValueInternal(attributeValue, actor, {
                    ...options,
                    db: transaction,
                    sideEffects,
                }),
            );
            if (!options?.sideEffects) {
                await flushAttributeValueMutationSideEffects(sideEffects);
            }
            return;
        }
    }

    const db = options?.db ?? storage();
    const sideEffects =
        options?.sideEffects ?? createAttributeValueMutationSideEffects();
    let value = attributeValue.value;
    const definition = await getAttributeDefinitionForMutation(
        db,
        attributeValue.attributeDefinitionId,
    );
    const existingValue = attributeValue.id
        ? await db.query.attributeValues.findFirst({
              where: eq(attributeValues.id, attributeValue.id),
          })
        : undefined;

    // Handle default value - assign default value if value is not provided
    if (!value && definition?.defaultValue) {
        value = await generatedAttributeValueForMutation({
            db,
            definition,
            entityId: attributeValue.entityId ?? existingValue?.entityId,
        });
    }

    if (options?.advancedSowingValidation !== 'deferred-by-batch') {
        const existingDefinition = await getAttributeDefinitionForExistingValue(
            db,
            existingValue,
        );
        const effects = new Map<
            number,
            AdvancedSowingAttributeMutationEffect
        >();

        if (
            existingValue &&
            !existingValue.isDeleted &&
            isAdvancedSowingAttributeDefinition(existingDefinition)
        ) {
            advancedSowingMutationEffectForEntity(
                effects,
                existingValue.entityId,
            ).removedAttributeValueIds.add(existingValue.id);
        }

        const finalIsDeleted =
            attributeValue.isDeleted ?? existingValue?.isDeleted ?? false;
        if (
            !finalIsDeleted &&
            isAdvancedSowingAttributeDefinition(definition)
        ) {
            if (attributeValue.entityTypeName !== 'plant') {
                throw new RangeError(
                    'Advanced Sowing spacing attributes can only be stored on plant entities.',
                );
            }
            advancedSowingMutationEffectForEntity(
                effects,
                attributeValue.entityId,
            ).additions.push({
                name: definition.name,
                value: value ?? null,
            });
        }

        if (effects.size > 0) {
            await lockAndValidateAdvancedSowingMutation(db, effects);
        }
    }

    if (
        attributeValue.entityTypeName === 'operation' &&
        isOperationApplicationAttributeDefinition(definition) &&
        value === 'plant'
    ) {
        await assertOperationDefinitionCanBecomePlantScoped(
            attributeValue.entityId,
            db,
        );
    }

    const previousRelationshipTargetId = definition
        ? plantRelationshipTargetIdForAttributeValue(
              definition,
              existingValue?.value,
          )
        : null;
    const nextRelationshipTargetId = definition
        ? plantRelationshipTargetIdForAttributeValue(definition, value)
        : null;
    const impactedRelationshipTargetIds = Array.from(
        new Set(
            [previousRelationshipTargetId, nextRelationshipTargetId].filter(
                (targetId): targetId is number =>
                    typeof targetId === 'number' &&
                    targetId !== attributeValue.entityId,
            ),
        ),
    );

    await Promise.all([
        db
            .insert(attributeValues)
            .values({
                ...attributeValue,
                value,
            })
            .onConflictDoUpdate({
                target: attributeValues.id,
                set: {
                    ...attributeValue,
                    value,
                },
            }),
        attributeValue.entityId
            ? db.insert(entityRevisions).values({
                  entityId: attributeValue.entityId,
                  entityTypeName: attributeValue.entityTypeName,
                  action: existingValue
                      ? 'attribute.updated'
                      : 'attribute.created',
                  actorId: actor?.id,
                  actorName: actor?.name,
                  attributeValueId: attributeValue.id,
                  attributeDefinitionId: attributeValue.attributeDefinitionId,
                  previousValue: existingValue?.value ?? null,
                  nextValue: value ?? null,
              })
            : undefined,
    ]);

    const affectedPlantHealthIds = await plantHealthAffectedPlantIdsForMutation(
        {
            db,
            definition,
            entityId: attributeValue.entityId ?? existingValue?.entityId,
            previousValue: existingValue?.value,
            nextValue: value,
        },
    );

    addAttributeValueMutationSideEffects(sideEffects, {
        entityId: attributeValue.entityId ?? existingValue?.entityId,
        entityTypeName:
            attributeValue.entityTypeName ?? existingValue?.entityTypeName,
        relatedEntityIds: [
            ...impactedRelationshipTargetIds,
            ...affectedPlantHealthIds,
        ],
    });
    if (
        definition &&
        isPlantHealthIssueEntityTypeName(definition.entityTypeName)
    ) {
        sideEffects.entityTypeNames.add('plant');
    }
    if (definition && isPlantRelationshipAttributeDefinition(definition)) {
        sideEffects.entityTypeNames.add('plantSort');
    }
    if (definition) {
        await syncGeneratedAttributesForSource({
            db,
            sideEffects,
            entityId: attributeValue.entityId ?? existingValue?.entityId,
            sourceDefinition: definition,
            sourceValue: value,
            actor,
        });
    }
    if (!options?.sideEffects) {
        await flushAttributeValueMutationSideEffects(sideEffects);
    }
}

async function deleteAttributeValueInternal(
    id: number,
    actor?: { id?: string; name?: string },
    options?: InternalAttributeValueMutationOptions,
) {
    if (
        !options?.db &&
        options?.advancedSowingValidation !== 'deferred-by-batch'
    ) {
        const rootDb = storage();
        if (await deleteTouchesAdvancedSowingAttribute(rootDb, id)) {
            const sideEffects =
                options?.sideEffects ??
                createAttributeValueMutationSideEffects();
            await rootDb.transaction((transaction) =>
                deleteAttributeValueInternal(id, actor, {
                    ...options,
                    db: transaction,
                    sideEffects,
                }),
            );
            if (!options?.sideEffects) {
                await flushAttributeValueMutationSideEffects(sideEffects);
            }
            return;
        }
    }

    const db = options?.db ?? storage();
    const sideEffects =
        options?.sideEffects ?? createAttributeValueMutationSideEffects();
    const existingValue = await db.query.attributeValues.findFirst({
        where: eq(attributeValues.id, id),
    });
    const definition = existingValue
        ? await getAttributeDefinitionForMutation(
              db,
              existingValue.attributeDefinitionId,
          )
        : undefined;
    const relationshipTargetId =
        definition && existingValue
            ? plantRelationshipTargetIdForAttributeValue(
                  definition,
                  existingValue.value,
              )
            : null;

    if (
        options?.advancedSowingValidation !== 'deferred-by-batch' &&
        existingValue &&
        !existingValue.isDeleted &&
        isAdvancedSowingAttributeDefinition(definition)
    ) {
        const effects = new Map<
            number,
            AdvancedSowingAttributeMutationEffect
        >();
        advancedSowingMutationEffectForEntity(
            effects,
            existingValue.entityId,
        ).removedAttributeValueIds.add(existingValue.id);
        await lockAndValidateAdvancedSowingMutation(db, effects);
    }

    await Promise.all([
        db
            .update(attributeValues)
            .set({ isDeleted: true })
            .where(eq(attributeValues.id, id)),
        existingValue
            ? db.insert(entityRevisions).values({
                  entityId: existingValue.entityId,
                  entityTypeName: existingValue.entityTypeName,
                  action: 'attribute.deleted',
                  actorId: actor?.id,
                  actorName: actor?.name,
                  attributeValueId: existingValue.id,
                  attributeDefinitionId: existingValue.attributeDefinitionId,
                  previousValue: existingValue.value,
                  nextValue: null,
              })
            : undefined,
    ]);

    const affectedPlantHealthIds = await plantHealthAffectedPlantIdsForMutation(
        {
            db,
            definition,
            entityId: existingValue?.entityId,
            previousValue: existingValue?.value,
            nextValue: null,
        },
    );

    addAttributeValueMutationSideEffects(sideEffects, {
        entityId: existingValue?.entityId,
        entityTypeName: existingValue?.entityTypeName,
        relatedEntityIds:
            relationshipTargetId &&
            relationshipTargetId !== existingValue?.entityId
                ? [relationshipTargetId, ...affectedPlantHealthIds]
                : affectedPlantHealthIds,
    });
    if (
        definition &&
        isPlantHealthIssueEntityTypeName(definition.entityTypeName)
    ) {
        sideEffects.entityTypeNames.add('plant');
    }
    if (definition && isPlantRelationshipAttributeDefinition(definition)) {
        sideEffects.entityTypeNames.add('plantSort');
    }
    if (definition) {
        await syncGeneratedAttributesForSource({
            db,
            sideEffects,
            entityId: existingValue?.entityId,
            sourceDefinition: definition,
            sourceValue: null,
            missingValueBehavior: 'delete',
            actor,
        });
    }
    if (!options?.sideEffects) {
        await flushAttributeValueMutationSideEffects(sideEffects);
    }
}

async function advancedSowingPlantIdsForBatchMutation(
    db: DatabaseClient,
    mutation: AdvancedSowingAttributeValueBatchMutation,
) {
    if (mutation.action === 'delete') {
        const existingValue = await db.query.attributeValues.findFirst({
            where: eq(attributeValues.id, mutation.attributeValueId),
        });
        const definition = await getAttributeDefinitionForExistingValue(
            db,
            existingValue,
        );
        if (
            !existingValue ||
            !isAdvancedSowingAttributeDefinition(definition)
        ) {
            throw new RangeError(
                'Advanced Sowing batch deletes may only target plant spacing attributes.',
            );
        }
        return [existingValue.entityId];
    }

    const { attributeValue } = mutation;
    const definition = await getAttributeDefinitionForMutation(
        db,
        attributeValue.attributeDefinitionId,
    );
    if (
        attributeValue.entityTypeName !== 'plant' ||
        !isAdvancedSowingAttributeDefinition(definition)
    ) {
        throw new RangeError(
            'Advanced Sowing batches may only upsert plant spacing attributes.',
        );
    }

    const entityIds = new Set([attributeValue.entityId]);
    if (attributeValue.id) {
        const existingValue = await db.query.attributeValues.findFirst({
            where: eq(attributeValues.id, attributeValue.id),
        });
        if (existingValue) {
            const existingDefinition =
                await getAttributeDefinitionForExistingValue(db, existingValue);
            if (!isAdvancedSowingAttributeDefinition(existingDefinition)) {
                throw new RangeError(
                    'Advanced Sowing batches cannot reassign a non-spacing attribute value.',
                );
            }
            entityIds.add(existingValue.entityId);
        }
    }
    return Array.from(entityIds);
}

async function advancedSowingBatchMutationSlot(
    db: DatabaseClient,
    mutation: AdvancedSowingAttributeValueBatchMutation,
) {
    if (mutation.action === 'upsert') {
        return {
            attributeDefinitionId:
                mutation.attributeValue.attributeDefinitionId,
            entityId: mutation.attributeValue.entityId,
        };
    }

    const existingValue = await db.query.attributeValues.findFirst({
        where: eq(attributeValues.id, mutation.attributeValueId),
    });
    if (!existingValue) {
        throw new RangeError(
            'Advanced Sowing batch current-value precondition failed because the target value no longer exists.',
        );
    }
    return {
        attributeDefinitionId: existingValue.attributeDefinitionId,
        entityId: existingValue.entityId,
    };
}

async function assertAdvancedSowingBatchMutationPrecondition(
    db: DatabaseClient,
    mutation: AdvancedSowingAttributeValueBatchMutation,
) {
    if (!mutation.expectedCurrent) {
        return;
    }

    const slot = await advancedSowingBatchMutationSlot(db, mutation);
    const currentValues = await db.query.attributeValues.findMany({
        where: and(
            eq(attributeValues.entityId, slot.entityId),
            eq(
                attributeValues.attributeDefinitionId,
                slot.attributeDefinitionId,
            ),
            eq(attributeValues.isDeleted, false),
        ),
    });
    const matches =
        mutation.expectedCurrent.state === 'absent'
            ? currentValues.length === 0
            : currentValues.length === 1 &&
              currentValues[0]?.id ===
                  mutation.expectedCurrent.attributeValueId &&
              currentValues[0]?.value === mutation.expectedCurrent.value;
    if (!matches) {
        throw new RangeError(
            'Advanced Sowing batch current-value precondition failed because persisted spacing changed after it was read.',
        );
    }
}

export async function applyAdvancedSowingAttributeValueBatch(
    mutations: readonly AdvancedSowingAttributeValueBatchMutation[],
    actor?: { id?: string; name?: string },
    options?: AdvancedSowingAttributeValueBatchOptions,
) {
    if (mutations.length === 0) {
        return;
    }

    const db = options?.db ?? storage();
    const sideEffects =
        options?.sideEffects ?? createAttributeValueMutationSideEffects();
    await db.transaction(async (transaction) => {
        const entityIds = new Set<number>();
        for (const mutation of mutations) {
            for (const entityId of await advancedSowingPlantIdsForBatchMutation(
                transaction,
                mutation,
            )) {
                entityIds.add(entityId);
            }
        }
        const orderedEntityIds = Array.from(entityIds).sort(
            (left, right) => left - right,
        );
        await lockAdvancedSowingPlantMutations(transaction, orderedEntityIds);

        const lockedEntityIds = new Set(orderedEntityIds);
        for (const mutation of mutations) {
            const currentEntityIds =
                await advancedSowingPlantIdsForBatchMutation(
                    transaction,
                    mutation,
                );
            if (
                currentEntityIds.some(
                    (entityId) => !lockedEntityIds.has(entityId),
                )
            ) {
                throw new RangeError(
                    'Advanced Sowing batch target changed before its plant lock was acquired.',
                );
            }
            await assertAdvancedSowingBatchMutationPrecondition(
                transaction,
                mutation,
            );
        }

        for (const mutation of mutations) {
            if (mutation.action === 'upsert') {
                await upsertAttributeValueInternal(
                    mutation.attributeValue,
                    actor,
                    {
                        advancedSowingValidation: 'deferred-by-batch',
                        db: transaction,
                        sideEffects,
                    },
                );
            } else {
                await deleteAttributeValueInternal(
                    mutation.attributeValueId,
                    actor,
                    {
                        advancedSowingValidation: 'deferred-by-batch',
                        db: transaction,
                        sideEffects,
                    },
                );
            }
        }

        for (const entityId of orderedEntityIds) {
            await assertProspectiveAdvancedSowingConfiguration(
                transaction,
                entityId,
                {
                    additions: [],
                    removedAttributeValueIds: new Set(),
                },
            );
        }
    });

    if (!options?.db && !options?.sideEffects) {
        await flushAttributeValueMutationSideEffects(sideEffects);
    }
}

export async function upsertAttributeValue(
    attributeValue: InsertAttributeValue,
    actor?: { id?: string; name?: string },
    options?: AttributeValueMutationOptions,
) {
    return upsertAttributeValueInternal(
        attributeValue,
        actor,
        options
            ? {
                  db: options.db,
                  sideEffects: options.sideEffects,
              }
            : undefined,
    );
}

export async function deleteAttributeValue(
    id: number,
    actor?: { id?: string; name?: string },
    options?: AttributeValueMutationOptions,
) {
    return deleteAttributeValueInternal(
        id,
        actor,
        options
            ? {
                  db: options.db,
                  sideEffects: options.sideEffects,
              }
            : undefined,
    );
}
