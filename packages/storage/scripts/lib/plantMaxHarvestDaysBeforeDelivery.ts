import { slugify } from '@gredice/js/slug';
import { and, eq, inArray } from 'drizzle-orm';
import {
    attributeDefinitionCategories,
    attributeValues,
    createAttributeDefinition,
    createAttributeValueMutationSideEffects,
    entities,
    flushAttributeValueMutationSideEffects,
    getAttributeDefinitions,
    type SelectAttributeDefinition,
    storage,
    updateAttributeDefinition,
    upsertAttributeValue,
} from '../../src';

export type PlantMaxHarvestDaysEntry = {
    name: string;
    maxHarvestDaysBeforeDelivery: number;
};

// This is a freshness policy, not the plant's harvest window. Zero means that
// the plant must be harvested on the delivery or pickup date.
export const plantMaxHarvestDaysBeforeDelivery = [
    { name: 'Kelj pupčar', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Jagoda', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Bamija', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Tikva', maxHarvestDaysBeforeDelivery: 3 },
    { name: 'Raštika', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Korijandar', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Kopar', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Dinja', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Ljupčac', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Timijan', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Kadulja', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Matičnjak', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Čili', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Artičoka', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Kamilica', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Origano', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Bosiljak', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Bob', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Repa', maxHarvestDaysBeforeDelivery: 2 },
    { name: 'Koraba', maxHarvestDaysBeforeDelivery: 2 },
    { name: 'Matovilac', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Luk vlasac', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Cvjetača', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Brokula', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Grašak', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Paprika', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Poriluk', maxHarvestDaysBeforeDelivery: 2 },
    { name: 'Celer', maxHarvestDaysBeforeDelivery: 2 },
    { name: 'Cikla', maxHarvestDaysBeforeDelivery: 2 },
    { name: 'Špinat', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Komorač', maxHarvestDaysBeforeDelivery: 2 },
    { name: 'Rotkvica', maxHarvestDaysBeforeDelivery: 2 },
    { name: 'Rajčica', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Rukola', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Salata', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Kelj', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Kupus', maxHarvestDaysBeforeDelivery: 3 },
    { name: 'Grah', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Mahuna', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Tikvice', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Krastavac', maxHarvestDaysBeforeDelivery: 1 },
    { name: 'Češnjak', maxHarvestDaysBeforeDelivery: 3 },
    { name: 'Peršin', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Luk', maxHarvestDaysBeforeDelivery: 3 },
    { name: 'Blitva', maxHarvestDaysBeforeDelivery: 0 },
    { name: 'Mrkva', maxHarvestDaysBeforeDelivery: 2 },
    { name: 'Patlidžan', maxHarvestDaysBeforeDelivery: 1 },
] satisfies PlantMaxHarvestDaysEntry[];

const actor = {
    id: 'plant-harvest-delivery-backfill',
    name: 'Plant harvest delivery backfill',
};

const namePath = 'information.name';
export const maxHarvestDaysBeforeDeliveryPath =
    'attributes.maxHarvestDaysBeforeDelivery';

type ExistingAttributeValue = {
    id: number;
    value: string | null;
};

type PlantCandidate = {
    entityId: number;
    name: string;
    normalizedName: string;
    state: string;
    maxHarvestDaysBeforeDelivery: number;
};

type PlannedPlant = PlantCandidate & {
    action: 'create' | 'update' | 'unchanged';
    existingValue: ExistingAttributeValue | null;
};

export function parsePlantMaxHarvestDaysBackfillArgs(argv: string[]) {
    let apply = false;

    for (const arg of argv) {
        if (arg === '--') {
            continue;
        }
        if (arg === '--apply') {
            apply = true;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }

    return { apply };
}

export function normalizePlantName(value: string) {
    return slugify(value.trim());
}

export function plantMaxHarvestDaysByNormalizedName(
    entries: readonly PlantMaxHarvestDaysEntry[],
) {
    const result = new Map<string, PlantMaxHarvestDaysEntry>();

    for (const entry of entries) {
        const normalizedName = normalizePlantName(entry.name);
        if (!normalizedName) {
            throw new Error('Plant freshness policy contains an empty name.');
        }
        if (
            !Number.isInteger(entry.maxHarvestDaysBeforeDelivery) ||
            entry.maxHarvestDaysBeforeDelivery < 0
        ) {
            throw new Error(
                `Expected a non-negative integer for ${entry.name}, found ${entry.maxHarvestDaysBeforeDelivery}.`,
            );
        }
        if (result.has(normalizedName)) {
            throw new Error(
                `Plant freshness policy contains duplicate normalized name ${normalizedName}.`,
            );
        }
        result.set(normalizedName, entry);
    }

    return result;
}

export function maxHarvestDaysBeforeDeliveryDefinitionConfig(
    entityTypeName = 'plant',
) {
    return {
        category: 'attributes',
        dataType: 'number',
        defaultValue: '0',
        description:
            'Maksimalan broj cijelih dana prije datuma dostave ili preuzimanja kada se biljka smije ubrati. 0 znači da se mora ubrati isti kalendarski dan.',
        display: false,
        entityTypeName,
        label: 'Maksimalno dana prije dostave',
        multiple: false,
        name: 'maxHarvestDaysBeforeDelivery',
        order: null,
        required: true,
        unit: 'dana',
    };
}

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

function definitionsAtPath(
    definitions: SelectAttributeDefinition[],
    path: string,
) {
    return definitions.filter(
        (definition) => attributePath(definition) === path,
    );
}

function requireExactlyOneDefinition(
    definitions: SelectAttributeDefinition[],
    path: string,
    entityTypeName: string,
) {
    const matches = definitionsAtPath(definitions, path);
    if (matches.length !== 1) {
        throw new Error(
            `Expected exactly one active ${entityTypeName} ${path} definition, found ${matches.length}.`,
        );
    }
    const definition = matches[0];
    if (!definition) {
        throw new Error(`Missing active ${entityTypeName} ${path} definition.`);
    }
    return definition;
}

async function requireAttributesCategory(entityTypeName: string) {
    const categories = await storage()
        .select({ id: attributeDefinitionCategories.id })
        .from(attributeDefinitionCategories)
        .where(
            and(
                eq(
                    attributeDefinitionCategories.entityTypeName,
                    entityTypeName,
                ),
                eq(attributeDefinitionCategories.name, 'attributes'),
                eq(attributeDefinitionCategories.isDeleted, false),
            ),
        );

    if (categories.length !== 1) {
        throw new Error(
            `Expected exactly one active ${entityTypeName} attributes category, found ${categories.length}.`,
        );
    }
}

async function preflightPlants({
    entityTypeName,
    matrix,
    nameDefinition,
}: {
    entityTypeName: string;
    matrix: readonly PlantMaxHarvestDaysEntry[];
    nameDefinition: SelectAttributeDefinition;
}) {
    const policyByName = plantMaxHarvestDaysByNormalizedName(matrix);
    const activeEntities = await storage()
        .select({
            entityId: entities.id,
            state: entities.state,
        })
        .from(entities)
        .where(
            and(
                eq(entities.entityTypeName, entityTypeName),
                eq(entities.isDeleted, false),
            ),
        )
        .orderBy(entities.id);

    if (activeEntities.length === 0) {
        throw new Error(`No active ${entityTypeName} entities found.`);
    }

    const entityIds = activeEntities.map((entity) => entity.entityId);
    const nameValues = await storage()
        .select({
            entityId: attributeValues.entityId,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityTypeName, entityTypeName),
                eq(attributeValues.attributeDefinitionId, nameDefinition.id),
                eq(attributeValues.isDeleted, false),
                inArray(attributeValues.entityId, entityIds),
            ),
        );

    const namesByEntityId = new Map<number, Array<{ value: string | null }>>();
    for (const nameValue of nameValues) {
        const values = namesByEntityId.get(nameValue.entityId) ?? [];
        values.push({ value: nameValue.value });
        namesByEntityId.set(nameValue.entityId, values);
    }

    const candidates: PlantCandidate[] = [];
    const seenNormalizedNames = new Map<string, number>();
    for (const entity of activeEntities) {
        const values = namesByEntityId.get(entity.entityId) ?? [];
        if (values.length !== 1) {
            throw new Error(
                `Expected exactly one active ${namePath} value for ${entityTypeName} #${entity.entityId}, found ${values.length}.`,
            );
        }
        const value = values[0]?.value?.trim();
        if (!value) {
            throw new Error(
                `Expected a non-empty ${namePath} value for ${entityTypeName} #${entity.entityId}.`,
            );
        }

        const normalizedName = normalizePlantName(value);
        const duplicateEntityId = seenNormalizedNames.get(normalizedName);
        if (duplicateEntityId !== undefined) {
            throw new Error(
                `Plant name ${JSON.stringify(value)} resolves to the same normalized name as entity #${duplicateEntityId}.`,
            );
        }
        seenNormalizedNames.set(normalizedName, entity.entityId);

        const policy = policyByName.get(normalizedName);
        if (!policy) {
            throw new Error(
                `Missing maxHarvestDaysBeforeDelivery policy for ${value} (#${entity.entityId}).`,
            );
        }
        candidates.push({
            entityId: entity.entityId,
            name: value,
            normalizedName,
            state: entity.state,
            maxHarvestDaysBeforeDelivery: policy.maxHarvestDaysBeforeDelivery,
        });
    }

    return {
        candidates,
        catalogEntriesWithoutEntity: Array.from(policyByName.entries())
            .filter(
                ([normalizedName]) => !seenNormalizedNames.has(normalizedName),
            )
            .map(([, entry]) => entry.name),
    };
}

function targetDefinitionNeedsUpdate(
    definition: SelectAttributeDefinition,
    expected: ReturnType<typeof maxHarvestDaysBeforeDeliveryDefinitionConfig>,
) {
    return (
        definition.category !== expected.category ||
        definition.dataType !== expected.dataType ||
        definition.defaultValue !== expected.defaultValue ||
        definition.description !== expected.description ||
        definition.display !== expected.display ||
        definition.entityTypeName !== expected.entityTypeName ||
        definition.label !== expected.label ||
        definition.multiple !== expected.multiple ||
        definition.name !== expected.name ||
        definition.order !== expected.order ||
        definition.required !== expected.required ||
        definition.unit !== expected.unit
    );
}

async function ensureTargetDefinition({
    apply,
    entityTypeName,
    existingDefinition,
}: {
    apply: boolean;
    entityTypeName: string;
    existingDefinition: SelectAttributeDefinition | null;
}) {
    const expected =
        maxHarvestDaysBeforeDeliveryDefinitionConfig(entityTypeName);
    if (existingDefinition) {
        const needsUpdate = targetDefinitionNeedsUpdate(
            existingDefinition,
            expected,
        );
        if (!apply || !needsUpdate) {
            return {
                created: false,
                definition: existingDefinition,
                updated: false,
                wouldCreate: false,
                wouldUpdate: !apply && needsUpdate,
            };
        }

        await updateAttributeDefinition({
            id: existingDefinition.id,
            ...expected,
        });
        const definitions = await getAttributeDefinitions(entityTypeName);
        const updatedDefinition = requireExactlyOneDefinition(
            definitions,
            maxHarvestDaysBeforeDeliveryPath,
            entityTypeName,
        );
        return {
            created: false,
            definition: updatedDefinition,
            updated: true,
            wouldCreate: false,
            wouldUpdate: false,
        };
    }

    if (!apply) {
        return {
            created: false,
            definition: null,
            updated: false,
            wouldCreate: true,
            wouldUpdate: false,
        };
    }

    const id = await createAttributeDefinition(expected);
    const definitions = await getAttributeDefinitions(entityTypeName);
    const createdDefinition = requireExactlyOneDefinition(
        definitions,
        maxHarvestDaysBeforeDeliveryPath,
        entityTypeName,
    );
    if (createdDefinition.id !== id) {
        throw new Error(
            `Failed to create ${entityTypeName} ${maxHarvestDaysBeforeDeliveryPath}.`,
        );
    }

    return {
        created: true,
        definition: createdDefinition,
        updated: false,
        wouldCreate: false,
        wouldUpdate: false,
    };
}

async function getExistingTargetValue({
    attributeDefinitionId,
    candidate,
    entityTypeName,
}: {
    attributeDefinitionId: number | null;
    candidate: PlantCandidate;
    entityTypeName: string;
}): Promise<ExistingAttributeValue | null> {
    if (!attributeDefinitionId) {
        return null;
    }

    const values = await storage()
        .select({
            id: attributeValues.id,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, candidate.entityId),
                eq(attributeValues.entityTypeName, entityTypeName),
                eq(
                    attributeValues.attributeDefinitionId,
                    attributeDefinitionId,
                ),
                eq(attributeValues.isDeleted, false),
            ),
        );

    if (values.length > 1) {
        throw new Error(
            `Expected at most one active ${maxHarvestDaysBeforeDeliveryPath} value for ${candidate.name} (#${candidate.entityId}), found ${values.length}.`,
        );
    }

    return values[0] ?? null;
}

async function planPlants({
    candidates,
    entityTypeName,
    targetDefinition,
}: {
    candidates: PlantCandidate[];
    entityTypeName: string;
    targetDefinition: SelectAttributeDefinition | null;
}) {
    const planned: PlannedPlant[] = [];

    for (const candidate of candidates) {
        const existingValue = await getExistingTargetValue({
            attributeDefinitionId: targetDefinition?.id ?? null,
            candidate,
            entityTypeName,
        });
        const nextValue = candidate.maxHarvestDaysBeforeDelivery.toString();
        planned.push({
            ...candidate,
            action:
                existingValue?.value === nextValue
                    ? 'unchanged'
                    : existingValue
                      ? 'update'
                      : 'create',
            existingValue,
        });
    }

    return planned;
}

export async function backfillPlantMaxHarvestDaysBeforeDelivery({
    apply = false,
    entityTypeName = 'plant',
    matrix = plantMaxHarvestDaysBeforeDelivery,
}: {
    apply?: boolean;
    entityTypeName?: string;
    matrix?: readonly PlantMaxHarvestDaysEntry[];
} = {}) {
    const definitions = await getAttributeDefinitions(entityTypeName);
    const nameDefinition = requireExactlyOneDefinition(
        definitions,
        namePath,
        entityTypeName,
    );
    const targetDefinitions = definitionsAtPath(
        definitions,
        maxHarvestDaysBeforeDeliveryPath,
    );
    if (targetDefinitions.length > 1) {
        throw new Error(
            `Expected at most one active ${entityTypeName} ${maxHarvestDaysBeforeDeliveryPath} definition, found ${targetDefinitions.length}.`,
        );
    }
    const existingTargetDefinition = targetDefinitions[0] ?? null;

    // Complete every catalog, definition, and value check before any write.
    await requireAttributesCategory(entityTypeName);
    const preflight = await preflightPlants({
        entityTypeName,
        matrix,
        nameDefinition,
    });
    const planned = await planPlants({
        candidates: preflight.candidates,
        entityTypeName,
        targetDefinition: existingTargetDefinition,
    });
    const definitionResult = await ensureTargetDefinition({
        apply,
        entityTypeName,
        existingDefinition: existingTargetDefinition,
    });

    const verifiedPlants: Array<{
        entityId: number;
        name: string;
        valueId: number;
        value: number;
    }> = [];

    if (apply) {
        const definition = definitionResult.definition;
        if (!definition) {
            throw new Error(
                `Cannot apply without ${maxHarvestDaysBeforeDeliveryPath} definition.`,
            );
        }
        const expectedDefinition =
            maxHarvestDaysBeforeDeliveryDefinitionConfig(entityTypeName);
        if (targetDefinitionNeedsUpdate(definition, expectedDefinition)) {
            throw new Error(
                `${maxHarvestDaysBeforeDeliveryPath} does not match the expected definition after applying changes.`,
            );
        }

        const sideEffects = createAttributeValueMutationSideEffects();
        for (const candidate of preflight.candidates) {
            sideEffects.entityIds.add(candidate.entityId);
            sideEffects.entityTypeNames.add(entityTypeName);
            sideEffects.searchEntityIds.add(candidate.entityId);
            sideEffects.dashboardAdmin = true;
        }
        await storage().transaction(async (tx) => {
            for (const plant of planned) {
                if (plant.action === 'unchanged') {
                    continue;
                }
                await upsertAttributeValue(
                    {
                        id: plant.existingValue?.id,
                        attributeDefinitionId: definition.id,
                        entityId: plant.entityId,
                        entityTypeName,
                        order: definition.order,
                        value: plant.maxHarvestDaysBeforeDelivery.toString(),
                    },
                    actor,
                    { db: tx, sideEffects },
                );
            }
        });
        await flushAttributeValueMutationSideEffects(sideEffects);

        for (const candidate of preflight.candidates) {
            const persistedValue = await getExistingTargetValue({
                attributeDefinitionId: definition.id,
                candidate,
                entityTypeName,
            });
            const expectedValue =
                candidate.maxHarvestDaysBeforeDelivery.toString();
            if (persistedValue?.value !== expectedValue) {
                throw new Error(
                    `Failed to verify ${maxHarvestDaysBeforeDeliveryPath}=${expectedValue} for ${candidate.name} (#${candidate.entityId}).`,
                );
            }
            verifiedPlants.push({
                entityId: candidate.entityId,
                name: candidate.name,
                valueId: persistedValue.id,
                value: candidate.maxHarvestDaysBeforeDelivery,
            });
        }
    }

    return {
        mode: apply ? 'apply' : 'dry-run',
        attribute: {
            path: maxHarvestDaysBeforeDeliveryPath,
            definitionId: definitionResult.definition?.id ?? null,
            created: definitionResult.created,
            updated: definitionResult.updated,
            wouldCreate: definitionResult.wouldCreate,
            wouldUpdate: definitionResult.wouldUpdate,
        },
        preflight: {
            entityTypeName,
            namePath,
            activePlants: preflight.candidates.length,
            policyEntries: matrix.length,
            catalogEntriesWithoutEntity: preflight.catalogEntriesWithoutEntity,
        },
        verification: apply
            ? {
                  plants: verifiedPlants,
              }
            : null,
        totals: {
            create: planned.filter((plant) => plant.action === 'create').length,
            update: planned.filter((plant) => plant.action === 'update').length,
            unchanged: planned.filter((plant) => plant.action === 'unchanged')
                .length,
        },
        plants: planned.map((plant) => ({
            entityId: plant.entityId,
            name: plant.name,
            normalizedName: plant.normalizedName,
            state: plant.state,
            existingValueId: plant.existingValue?.id ?? null,
            previousValue: plant.existingValue?.value ?? null,
            nextValue: plant.maxHarvestDaysBeforeDelivery,
            action: plant.action,
        })),
    };
}
