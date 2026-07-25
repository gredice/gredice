import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { slugify } from '@gredice/js/slug';
import { and, eq } from 'drizzle-orm';
import {
    type PlantHealthDirectoryIssue,
    plantHealthDirectoryDataset,
    plantHealthDirectorySources,
} from '../src/data/plantHealthDirectory';
import {
    attributeDefinitionCategories,
    attributeDefinitions,
    attributeValues,
    closeStorage,
    createAttributeDefinition,
    createAttributeDefinitionCategory,
    createAttributeValueMutationSideEffects,
    createEntity,
    deleteAttributeValue,
    entityTypeCategories,
    entityTypes,
    flushAttributeValueMutationSideEffects,
    getAttributeDefinitions,
    getEntitiesRaw,
    getEntityTypeByName,
    plantHealthAffectedPlantsAttributeName,
    plantHealthIssueTypeNames,
    plantHealthOperationAttributeNames,
    plantHealthOperationCategory,
    plantHealthRelationshipCategory,
    type SelectAttributeDefinition,
    storage,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
} from '../src/index';

type HealthEntityTypeName =
    (typeof plantHealthIssueTypeNames)[keyof typeof plantHealthIssueTypeNames];

type AttributeConfig = {
    category: string;
    name: string;
    label: string;
    dataType: string;
    description?: string;
    order: string;
    multiple?: boolean;
    required?: boolean;
    display?: boolean;
};

type ImportIssueResult = {
    entry: PlantHealthDirectoryIssue;
    entityTypeName: HealthEntityTypeName;
    entityId: number | null;
    created: boolean;
    updatedFields: string[];
    skippedExistingRefs: string[];
    removedExistingRefs: string[];
    missingPlants: string[];
    missingOperations: string[];
};

type PublishedPlant = {
    id: number;
    name: string;
};

type PlantCoverage = {
    plant: PublishedPlant;
    diseaseIssues: Set<string>;
    pestIssues: Set<string>;
};

type PreflightProblem = {
    kind:
        | 'duplicate-issue-identity'
        | 'duplicate-affected-plant'
        | 'insufficient-disease-coverage'
        | 'insufficient-pest-coverage'
        | 'missing-plant'
        | 'missing-operation'
        | 'missing-recommendation';
    issueName: string;
    value: string;
    message: string;
};

const apply = process.argv.includes('--apply');
const backfillActor = {
    name: 'Plant health directory backfill',
};
const reportPath = resolve(
    process.cwd(),
    '..',
    '..',
    'docs',
    'plant-health-directory-coverage.md',
);

const healthEntityTypeConfig = {
    plantDisease: {
        label: 'Bolesti biljaka',
        icon: 'microscope',
        order: 'xa',
    },
    plantPest: {
        label: 'Štetnici biljaka',
        icon: 'bug',
        order: 'xb',
    },
} as const satisfies Record<
    HealthEntityTypeName,
    {
        label: string;
        icon: string;
        order: string;
    }
>;

const categoryConfigs = [
    { name: 'information', label: 'Informacije', order: 'a' },
    { name: 'symptoms', label: 'Simptomi i znakovi', order: 'b' },
    { name: 'conditions', label: 'Uvjeti i ozbiljnost', order: 'c' },
    {
        name: plantHealthRelationshipCategory,
        label: 'Povezane biljke',
        order: 'd',
    },
    {
        name: plantHealthOperationCategory,
        label: 'Preporučene radnje',
        order: 'e',
    },
    { name: 'review', label: 'Izvori i pregled', order: 'z' },
] as const;

const attributeConfigs: AttributeConfig[] = [
    {
        category: 'information',
        name: 'name',
        label: 'Naziv',
        dataType: 'text',
        order: 'aa',
        required: true,
        display: true,
    },
    {
        category: 'information',
        name: 'label',
        label: 'Javni naziv',
        dataType: 'text',
        order: 'ab',
        display: true,
    },
    {
        category: 'information',
        name: 'shortDescription',
        label: 'Kratki opis',
        dataType: 'text',
        order: 'ac',
        required: true,
        display: true,
    },
    {
        category: 'information',
        name: 'description',
        label: 'Opis',
        dataType: 'markdown',
        order: 'ad',
    },
    {
        category: 'symptoms',
        name: 'symptoms',
        label: 'Simptomi',
        dataType: 'markdown',
        order: 'ba',
        required: true,
    },
    {
        category: 'conditions',
        name: 'favorableConditions',
        label: 'Povoljni uvjeti',
        dataType: 'markdown',
        order: 'ca',
        required: true,
    },
    {
        category: 'conditions',
        name: 'severity',
        label: 'Ozbiljnost',
        dataType: 'text',
        order: 'cb',
        display: true,
    },
    {
        category: plantHealthRelationshipCategory,
        name: plantHealthAffectedPlantsAttributeName,
        label: 'Pogođene biljke',
        dataType: 'ref:plant',
        description:
            'Biljke na koje se bolest ili štetnik odnosi. Veza se održava na ovom zapisu, a javne biljke dobiju izvedeni prikaz.',
        order: 'da',
        multiple: true,
        required: true,
        display: true,
    },
    {
        category: plantHealthOperationCategory,
        name: plantHealthOperationAttributeNames.prevention,
        label: 'Prevencija',
        dataType: 'ref:operation',
        order: 'ea',
        multiple: true,
        display: true,
    },
    {
        category: plantHealthOperationCategory,
        name: plantHealthOperationAttributeNames.reduction,
        label: 'Smanjenje pritiska',
        dataType: 'ref:operation',
        order: 'eb',
        multiple: true,
        display: true,
    },
    {
        category: plantHealthOperationCategory,
        name: plantHealthOperationAttributeNames.alleviation,
        label: 'Ublažavanje i oporavak',
        dataType: 'ref:operation',
        order: 'ec',
        multiple: true,
        display: true,
    },
    {
        category: 'review',
        name: 'sources',
        label: 'Izvori',
        dataType: 'json|label:string,url:string',
        order: 'za',
        multiple: true,
    },
    {
        category: 'review',
        name: 'reviewNotes',
        label: 'Napomene za pregled',
        dataType: 'markdown',
        order: 'zb',
    },
];

function syntheticAttributeDefinition(
    entityTypeName: HealthEntityTypeName,
    config: AttributeConfig,
    id: number,
): SelectAttributeDefinition {
    const now = new Date();
    return {
        id,
        category: config.category,
        name: config.name,
        label: config.label,
        description: config.description ?? null,
        entityTypeName,
        dataType: config.dataType,
        defaultValue: null,
        unit: null,
        order: config.order,
        multiple: config.multiple ?? false,
        required: config.required ?? false,
        display: config.display ?? false,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
    };
}

function normalizedName(value: string) {
    return slugify(value.trim());
}

function preflightDataset({
    operationIdsByName,
    plantIdsByName,
    publishedPlants,
}: {
    operationIdsByName: Map<string, number>;
    plantIdsByName: Map<string, number>;
    publishedPlants: PublishedPlant[];
}) {
    const problems: PreflightProblem[] = [];
    const issueIdentities = new Map<string, string>();
    const diseaseCoverage = new Map<string, Set<string>>();
    const pestCoverage = new Map<string, Set<string>>();

    for (const entry of plantHealthDirectoryDataset) {
        const issueIdentity = `${entry.kind}:${normalizedName(entry.name)}`;
        for (const identityName of [entry.name, ...(entry.legacyNames ?? [])]) {
            const candidateIdentity = `${entry.kind}:${normalizedName(identityName)}`;
            const existingIssueName = issueIdentities.get(candidateIdentity);
            if (existingIssueName && existingIssueName !== entry.name) {
                problems.push({
                    kind: 'duplicate-issue-identity',
                    issueName: entry.name,
                    value: candidateIdentity,
                    message: `Duplicate ${entry.kind} identity "${identityName}" on "${entry.name}" (already used by "${existingIssueName}").`,
                });
            } else {
                issueIdentities.set(candidateIdentity, entry.name);
            }
        }

        const affectedPlantNames = new Set<string>();
        for (const plantName of entry.affectedPlants) {
            const normalizedPlantName = normalizedName(plantName);
            if (affectedPlantNames.has(normalizedPlantName)) {
                problems.push({
                    kind: 'duplicate-affected-plant',
                    issueName: entry.name,
                    value: plantName,
                    message: `Duplicate affected plant "${plantName}" on "${entry.name}".`,
                });
            } else {
                affectedPlantNames.add(normalizedPlantName);
            }

            const coverage =
                entry.kind === 'disease' ? diseaseCoverage : pestCoverage;
            const plantIssues = coverage.get(normalizedPlantName) ?? new Set();
            plantIssues.add(issueIdentity);
            coverage.set(normalizedPlantName, plantIssues);

            if (!plantIdsByName.has(normalizedPlantName)) {
                problems.push({
                    kind: 'missing-plant',
                    issueName: entry.name,
                    value: plantName,
                    message: `Missing published plant "${plantName}" referenced by "${entry.name}".`,
                });
            }
        }

        const recommendedOperationNames = Object.values(
            entry.operations ?? {},
        ).flat();
        if (recommendedOperationNames.length === 0) {
            problems.push({
                kind: 'missing-recommendation',
                issueName: entry.name,
                value: entry.name,
                message: `"${entry.name}" has no recommended operation.`,
            });
        }

        for (const operationName of recommendedOperationNames) {
            if (!operationIdsByName.has(operationName)) {
                problems.push({
                    kind: 'missing-operation',
                    issueName: entry.name,
                    value: operationName,
                    message: `Missing published operation "${operationName}" referenced by "${entry.name}".`,
                });
            }
        }
    }

    for (const plant of publishedPlants) {
        const normalizedPlantName = normalizedName(plant.name);
        const diseaseCount =
            diseaseCoverage.get(normalizedPlantName)?.size ?? 0;
        if (diseaseCount < 2) {
            problems.push({
                kind: 'insufficient-disease-coverage',
                issueName: plant.name,
                value: plant.name,
                message: `Published plant "${plant.name}" has ${diseaseCount} disease entries; at least 2 are required.`,
            });
        }

        const pestCount = pestCoverage.get(normalizedPlantName)?.size ?? 0;
        if (pestCount < 2) {
            problems.push({
                kind: 'insufficient-pest-coverage',
                issueName: plant.name,
                value: plant.name,
                message: `Published plant "${plant.name}" has ${pestCount} pest entries; at least 2 are required.`,
            });
        }
    }

    return problems;
}

function attributeKey(category: string, name: string) {
    return `${category}.${name}`;
}

function textAttribute(
    entity: Awaited<ReturnType<typeof getEntitiesRaw>>[number],
    category: string,
    name: string,
) {
    return (
        entity.attributes
            .find(
                (attribute) =>
                    attribute.attributeDefinition.category === category &&
                    attribute.attributeDefinition.name === name,
            )
            ?.value?.trim() ?? null
    );
}

async function ensureEntityTypeCategory() {
    const existingCategories =
        await storage().query.entityTypeCategories.findMany({
            where: eq(entityTypeCategories.name, 'plant-health-directory'),
        });
    const activeCategory = existingCategories.find(
        (category) => !category.isDeleted,
    );
    if (activeCategory) {
        return activeCategory.id;
    }

    const deletedCategory = existingCategories[0];
    if (deletedCategory) {
        if (apply) {
            await storage()
                .update(entityTypeCategories)
                .set({
                    label: 'Zdravlje biljaka',
                    order: 'x',
                    isDeleted: false,
                })
                .where(eq(entityTypeCategories.id, deletedCategory.id));
        }
        return deletedCategory.id;
    }

    if (!apply) {
        return null;
    }

    await storage().insert(entityTypeCategories).values({
        name: 'plant-health-directory',
        label: 'Zdravlje biljaka',
        order: 'x',
    });
    const created = await storage().query.entityTypeCategories.findFirst({
        where: and(
            eq(entityTypeCategories.name, 'plant-health-directory'),
            eq(entityTypeCategories.isDeleted, false),
        ),
    });
    return created?.id ?? null;
}

async function ensureHealthEntityTypes(categoryId: number | null) {
    for (const [entityTypeName, config] of Object.entries(
        healthEntityTypeConfig,
    ) as Array<
        [
            HealthEntityTypeName,
            (typeof healthEntityTypeConfig)[HealthEntityTypeName],
        ]
    >) {
        const existing = await getEntityTypeByName(entityTypeName);
        if (existing) {
            if (apply) {
                await upsertEntityType({
                    id: existing.id,
                    name: entityTypeName,
                    label: config.label,
                    icon: config.icon,
                    categoryId,
                    order: config.order,
                    isRoot: true,
                    isDeleted: false,
                });
            }
            continue;
        }

        if (apply) {
            await storage().insert(entityTypes).values({
                name: entityTypeName,
                label: config.label,
                icon: config.icon,
                categoryId,
                order: config.order,
                isRoot: true,
            });
        }
    }
}

async function ensureAttributeCategories(entityTypeName: HealthEntityTypeName) {
    for (const category of categoryConfigs) {
        const existingCategories =
            await storage().query.attributeDefinitionCategories.findMany({
                where: and(
                    eq(
                        attributeDefinitionCategories.entityTypeName,
                        entityTypeName,
                    ),
                    eq(attributeDefinitionCategories.name, category.name),
                ),
            });
        const activeCategory = existingCategories.find(
            (entry) => !entry.isDeleted,
        );
        if (activeCategory) {
            if (apply) {
                await storage()
                    .update(attributeDefinitionCategories)
                    .set({
                        label: category.label,
                        order: category.order,
                        isDeleted: false,
                    })
                    .where(
                        eq(attributeDefinitionCategories.id, activeCategory.id),
                    );
            }
            continue;
        }

        const deletedCategory = existingCategories[0];
        if (deletedCategory) {
            if (apply) {
                await storage()
                    .update(attributeDefinitionCategories)
                    .set({
                        label: category.label,
                        order: category.order,
                        isDeleted: false,
                    })
                    .where(
                        eq(
                            attributeDefinitionCategories.id,
                            deletedCategory.id,
                        ),
                    );
            }
            continue;
        }

        if (apply) {
            await createAttributeDefinitionCategory({
                name: category.name,
                label: category.label,
                entityTypeName,
                order: category.order,
            });
        }
    }
}

async function ensureAttributeDefinitions(
    entityTypeName: HealthEntityTypeName,
) {
    await ensureAttributeCategories(entityTypeName);

    const definitionsByKey = new Map<string, SelectAttributeDefinition>();
    const existingDefinitions = await getAttributeDefinitions(entityTypeName);
    let syntheticId = -1;

    for (const config of attributeConfigs) {
        const existing = existingDefinitions.find(
            (definition) =>
                definition.category === config.category &&
                definition.name === config.name,
        );
        if (existing) {
            if (apply) {
                await storage()
                    .update(attributeDefinitions)
                    .set({
                        category: config.category,
                        name: config.name,
                        label: config.label,
                        description: config.description,
                        entityTypeName,
                        dataType: config.dataType,
                        multiple: config.multiple ?? false,
                        required: config.required ?? false,
                        display: config.display ?? false,
                        order: config.order,
                        isDeleted: false,
                    })
                    .where(eq(attributeDefinitions.id, existing.id));
            }
            definitionsByKey.set(attributeKey(config.category, config.name), {
                ...existing,
                ...config,
                entityTypeName,
                multiple: config.multiple ?? false,
                required: config.required ?? false,
                display: config.display ?? false,
                defaultValue: existing.defaultValue,
                unit: existing.unit,
                createdAt: existing.createdAt,
                updatedAt: existing.updatedAt,
                isDeleted: false,
            });
            continue;
        }

        if (!apply) {
            definitionsByKey.set(
                attributeKey(config.category, config.name),
                syntheticAttributeDefinition(
                    entityTypeName,
                    config,
                    syntheticId,
                ),
            );
            syntheticId -= 1;
            continue;
        }

        if (apply) {
            const id = await createAttributeDefinition({
                category: config.category,
                name: config.name,
                label: config.label,
                description: config.description,
                entityTypeName,
                dataType: config.dataType,
                multiple: config.multiple ?? false,
                required: config.required ?? false,
                display: config.display ?? false,
                order: config.order,
            });
            const created =
                await storage().query.attributeDefinitions.findFirst({
                    where: eq(attributeDefinitions.id, id),
                });
            if (created) {
                definitionsByKey.set(
                    attributeKey(config.category, config.name),
                    created,
                );
            }
        }
    }

    return definitionsByKey;
}

function definitionOrThrow(
    definitions: Map<string, SelectAttributeDefinition>,
    category: string,
    name: string,
) {
    const definition = definitions.get(attributeKey(category, name));
    if (!definition) {
        throw new Error(`Missing attribute definition ${category}.${name}.`);
    }
    return definition;
}

async function setSingleAttribute({
    definition,
    entityId,
    entityTypeName,
    sideEffects,
    value,
}: {
    definition: SelectAttributeDefinition;
    entityId: number;
    entityTypeName: HealthEntityTypeName;
    sideEffects: ReturnType<typeof createAttributeValueMutationSideEffects>;
    value: string | null;
}) {
    const existing = await storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.attributeDefinitionId, definition.id),
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.isDeleted, false),
        ),
    });
    if (existing?.value === value) {
        return false;
    }

    if (apply) {
        await upsertAttributeValue(
            {
                id: existing?.id,
                attributeDefinitionId: definition.id,
                entityTypeName,
                entityId,
                value,
            },
            backfillActor,
            { sideEffects },
        );
    }

    return true;
}

async function addMultipleAttributeValues({
    definition,
    entityId,
    entityTypeName,
    sideEffects,
    values,
}: {
    definition: SelectAttributeDefinition;
    entityId: number;
    entityTypeName: HealthEntityTypeName;
    sideEffects: ReturnType<typeof createAttributeValueMutationSideEffects>;
    values: string[];
}) {
    const existingValues = await storage().query.attributeValues.findMany({
        where: and(
            eq(attributeValues.attributeDefinitionId, definition.id),
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.isDeleted, false),
        ),
    });
    const existingValueSet = new Set(
        existingValues.map((attributeValue) => attributeValue.value),
    );
    const uniqueValues = Array.from(new Set(values));
    const createdValues: string[] = [];
    const skippedExistingValues: string[] = [];

    for (const value of uniqueValues) {
        if (existingValueSet.has(value)) {
            skippedExistingValues.push(value);
            continue;
        }

        if (apply) {
            await upsertAttributeValue(
                {
                    attributeDefinitionId: definition.id,
                    entityTypeName,
                    entityId,
                    value,
                },
                backfillActor,
                { sideEffects },
            );
        }
        createdValues.push(value);
    }

    return {
        createdValues,
        skippedExistingValues,
    };
}

async function removeUnexpectedMultipleAttributeValues({
    definition,
    desiredValues,
    entityId,
    sideEffects,
}: {
    definition: SelectAttributeDefinition;
    desiredValues: string[];
    entityId: number;
    sideEffects: ReturnType<typeof createAttributeValueMutationSideEffects>;
}) {
    const desiredValueSet = new Set(desiredValues);
    const existingValues = await storage().query.attributeValues.findMany({
        where: and(
            eq(attributeValues.attributeDefinitionId, definition.id),
            eq(attributeValues.entityId, entityId),
            eq(attributeValues.isDeleted, false),
        ),
    });
    const unexpectedValues = existingValues.filter(
        (attributeValue) =>
            attributeValue.value !== null &&
            !desiredValueSet.has(attributeValue.value),
    );

    if (apply) {
        for (const unexpectedValue of unexpectedValues) {
            await deleteAttributeValue(unexpectedValue.id, backfillActor, {
                sideEffects,
            });
        }
    }

    return unexpectedValues.flatMap((attributeValue) =>
        attributeValue.value === null ? [] : [attributeValue.value],
    );
}

async function existingIssueEntityId(
    entityTypeName: HealthEntityTypeName,
    nameDefinitionId: number,
    names: readonly string[],
) {
    const entities = await getEntitiesRaw(entityTypeName);
    const normalizedNames = new Set(names.map(normalizedName));
    return (
        entities.find((entity) =>
            entity.attributes.some(
                (attribute) =>
                    attribute.attributeDefinitionId === nameDefinitionId &&
                    normalizedNames.has(normalizedName(attribute.value)),
            ),
        )?.id ?? null
    );
}

function issueEntityTypeName(kind: PlantHealthDirectoryIssue['kind']) {
    return kind === 'disease'
        ? plantHealthIssueTypeNames.disease
        : plantHealthIssueTypeNames.pest;
}

async function importIssue({
    entry,
    definitions,
    operationIdsByName,
    plantIdsByName,
}: {
    entry: PlantHealthDirectoryIssue;
    definitions: Map<string, SelectAttributeDefinition>;
    operationIdsByName: Map<string, number>;
    plantIdsByName: Map<string, number>;
}): Promise<ImportIssueResult> {
    const entityTypeName = issueEntityTypeName(entry.kind);
    const nameDefinition = definitionOrThrow(
        definitions,
        'information',
        'name',
    );
    const existingId = await existingIssueEntityId(
        entityTypeName,
        nameDefinition.id,
        [entry.name, ...(entry.legacyNames ?? [])],
    );
    const created = !existingId;
    const result: ImportIssueResult = {
        entry,
        entityTypeName,
        entityId: existingId,
        created,
        updatedFields: [],
        skippedExistingRefs: [],
        removedExistingRefs: [],
        missingPlants: [],
        missingOperations: [],
    };

    const singleFields: Array<[string, string, string | null]> = [
        ['information', 'name', entry.name],
        ['information', 'label', entry.label ?? entry.name],
        ['information', 'shortDescription', entry.shortDescription],
        ['information', 'description', entry.description],
        ['symptoms', 'symptoms', entry.symptoms],
        ['conditions', 'favorableConditions', entry.favorableConditions],
        ['conditions', 'severity', entry.severity],
        ['review', 'reviewNotes', entry.reviewNotes?.join('\n') ?? null],
    ];

    const affectedPlantIds: string[] = [];
    for (const plantName of entry.affectedPlants) {
        const plantId = plantIdsByName.get(normalizedName(plantName));
        if (!plantId) {
            result.missingPlants.push(plantName);
            continue;
        }
        affectedPlantIds.push(String(plantId));
    }

    const operationIdsByAttributeName = new Map<string, string[]>();
    for (const [intent, attributeName] of Object.entries(
        plantHealthOperationAttributeNames,
    )) {
        const operationNames =
            entry.operations?.[
                intent as keyof typeof plantHealthOperationAttributeNames
            ] ?? [];
        const operationIds: string[] = [];
        for (const operationName of operationNames) {
            const operationId = operationIdsByName.get(operationName);
            if (!operationId) {
                result.missingOperations.push(operationName);
                continue;
            }
            operationIds.push(String(operationId));
        }
        operationIdsByAttributeName.set(attributeName, operationIds);
    }

    const sourceValues = entry.sources.map((sourceKey) =>
        JSON.stringify(plantHealthDirectorySources[sourceKey]),
    );
    const entityId =
        existingId ??
        (apply ? await createEntity(entityTypeName, backfillActor) : null);
    result.entityId = entityId;

    if (!entityId) {
        result.updatedFields.push(
            ...singleFields.map(([category, name]) =>
                attributeKey(category, name),
            ),
            ...Array.from(new Set(affectedPlantIds)).map(() =>
                attributeKey(
                    plantHealthRelationshipCategory,
                    plantHealthAffectedPlantsAttributeName,
                ),
            ),
            ...Array.from(operationIdsByAttributeName.entries()).flatMap(
                ([attributeName, operationIds]) =>
                    Array.from(new Set(operationIds)).map(() =>
                        attributeKey(
                            plantHealthOperationCategory,
                            attributeName,
                        ),
                    ),
            ),
            ...Array.from(new Set(sourceValues)).map(() =>
                attributeKey('review', 'sources'),
            ),
        );
        return result;
    }

    const sideEffects = createAttributeValueMutationSideEffects();
    for (const [category, name, value] of singleFields) {
        const changed = await setSingleAttribute({
            definition: definitionOrThrow(definitions, category, name),
            entityId,
            entityTypeName,
            sideEffects,
            value,
        });
        if (changed) {
            result.updatedFields.push(attributeKey(category, name));
        }
    }

    const affectedPlantResult = await addMultipleAttributeValues({
        definition: definitionOrThrow(
            definitions,
            plantHealthRelationshipCategory,
            plantHealthAffectedPlantsAttributeName,
        ),
        entityId,
        entityTypeName,
        sideEffects,
        values: affectedPlantIds,
    });
    result.updatedFields.push(
        ...affectedPlantResult.createdValues.map(() =>
            attributeKey(
                plantHealthRelationshipCategory,
                plantHealthAffectedPlantsAttributeName,
            ),
        ),
    );
    result.skippedExistingRefs.push(
        ...affectedPlantResult.skippedExistingValues.map(
            (value) => `plant#${value}`,
        ),
    );
    if (entry.reconcileAffectedPlants) {
        const removedAffectedPlantIds =
            await removeUnexpectedMultipleAttributeValues({
                definition: definitionOrThrow(
                    definitions,
                    plantHealthRelationshipCategory,
                    plantHealthAffectedPlantsAttributeName,
                ),
                desiredValues: affectedPlantIds,
                entityId,
                sideEffects,
            });
        result.updatedFields.push(
            ...removedAffectedPlantIds.map(() =>
                attributeKey(
                    plantHealthRelationshipCategory,
                    plantHealthAffectedPlantsAttributeName,
                ),
            ),
        );
        result.removedExistingRefs.push(
            ...removedAffectedPlantIds.map(
                (plantId) =>
                    `${plantHealthRelationshipCategory}.${plantHealthAffectedPlantsAttributeName}:plant#${plantId}`,
            ),
        );
    }

    for (const [attributeName, operationIds] of operationIdsByAttributeName) {
        const definition = definitionOrThrow(
            definitions,
            plantHealthOperationCategory,
            attributeName,
        );
        const operationResult = await addMultipleAttributeValues({
            definition,
            entityId,
            entityTypeName,
            sideEffects,
            values: operationIds,
        });
        result.updatedFields.push(
            ...operationResult.createdValues.map(() =>
                attributeKey(plantHealthOperationCategory, attributeName),
            ),
        );
        result.skippedExistingRefs.push(
            ...operationResult.skippedExistingValues.map(
                (value) => `operation#${value}`,
            ),
        );
        if (entry.reconcileOperations) {
            const removedOperationIds =
                await removeUnexpectedMultipleAttributeValues({
                    definition,
                    desiredValues: operationIds,
                    entityId,
                    sideEffects,
                });
            result.updatedFields.push(
                ...removedOperationIds.map(() =>
                    attributeKey(plantHealthOperationCategory, attributeName),
                ),
            );
            result.removedExistingRefs.push(
                ...removedOperationIds.map(
                    (operationId) =>
                        `${plantHealthOperationCategory}.${attributeName}:operation#${operationId}`,
                ),
            );
        }
    }

    const sourceResult = await addMultipleAttributeValues({
        definition: definitionOrThrow(definitions, 'review', 'sources'),
        entityId,
        entityTypeName,
        sideEffects,
        values: sourceValues,
    });
    result.updatedFields.push(
        ...sourceResult.createdValues.map(() =>
            attributeKey('review', 'sources'),
        ),
    );
    if (entry.reconcileSources) {
        const removedSourceValues =
            await removeUnexpectedMultipleAttributeValues({
                definition: definitionOrThrow(definitions, 'review', 'sources'),
                desiredValues: sourceValues,
                entityId,
                sideEffects,
            });
        result.updatedFields.push(
            ...removedSourceValues.map(() => attributeKey('review', 'sources')),
        );
        result.removedExistingRefs.push(
            ...removedSourceValues.map(() => 'review.sources'),
        );
    }

    if (apply) {
        await flushAttributeValueMutationSideEffects(sideEffects);
    }
    if (
        apply &&
        result.missingPlants.length === 0 &&
        result.missingOperations.length === 0
    ) {
        await updateEntity({ id: entityId, state: 'published' }, backfillActor);
    }

    return result;
}

async function writeCoverageReport({
    operationIdsByName,
    plantIdsByName,
    preflightProblems,
    publishedPlants,
    results,
}: {
    operationIdsByName: Map<string, number>;
    plantIdsByName: Map<string, number>;
    preflightProblems: PreflightProblem[];
    publishedPlants: PublishedPlant[];
    results: ImportIssueResult[];
}) {
    const coverageByPlantId = new Map<number, PlantCoverage>();
    for (const plant of publishedPlants) {
        coverageByPlantId.set(plant.id, {
            plant,
            diseaseIssues: new Set<string>(),
            pestIssues: new Set<string>(),
        });
    }
    for (const entry of plantHealthDirectoryDataset) {
        const issueIdentity = `${entry.kind}:${normalizedName(entry.name)}`;
        const seenPlantIds = new Set<number>();
        for (const plantName of entry.affectedPlants) {
            const plantId = plantIdsByName.get(normalizedName(plantName));
            if (!plantId || seenPlantIds.has(plantId)) {
                continue;
            }
            seenPlantIds.add(plantId);

            const coverage = coverageByPlantId.get(plantId);
            if (!coverage) {
                continue;
            }
            if (entry.kind === 'disease') {
                coverage.diseaseIssues.add(issueIdentity);
            } else {
                coverage.pestIssues.add(issueIdentity);
            }
        }
    }

    const coverageRows = Array.from(coverageByPlantId.values()).sort(
        (left, right) =>
            left.plant.name.localeCompare(right.plant.name, 'hr') ||
            left.plant.id - right.plant.id,
    );
    const noCoverage = coverageRows.filter(
        ({ diseaseIssues, pestIssues }) =>
            diseaseIssues.size === 0 && pestIssues.size === 0,
    );
    const noDiseaseCoverage = coverageRows.filter(
        ({ diseaseIssues }) => diseaseIssues.size === 0,
    );
    const noPestCoverage = coverageRows.filter(
        ({ pestIssues }) => pestIssues.size === 0,
    );
    const issuesWithoutRecommendations = plantHealthDirectoryDataset.filter(
        (entry) => Object.values(entry.operations ?? {}).flat().length === 0,
    );
    const preflightMissingPlants = preflightProblems
        .filter((problem) => problem.kind === 'missing-plant')
        .map((problem) => problem.value);
    const preflightMissingOperations = preflightProblems
        .filter((problem) => problem.kind === 'missing-operation')
        .map((problem) => problem.value);
    const missingPlants = Array.from(
        new Set([
            ...preflightMissingPlants,
            ...results.flatMap((result) => result.missingPlants),
        ]),
    ).sort((left, right) => left.localeCompare(right, 'hr'));
    const missingOperations = Array.from(
        new Set([
            ...preflightMissingOperations,
            ...results.flatMap((result) => result.missingOperations),
        ]),
    ).sort((left, right) => left.localeCompare(right, 'hr'));
    const importStoppedByPreflight =
        apply && preflightProblems.length > 0 && results.length === 0;
    const formatCoverageGap = ({ plant }: PlantCoverage) =>
        `- ${plant.name} (#${plant.id})`;

    const lines = [
        '# Plant Health Directory Coverage',
        '',
        `Generated: ${new Date().toISOString()}`,
        `Mode: ${apply ? 'apply' : 'dry-run'}`,
        '',
        '## Source Notes',
        '',
        'This dataset imports only source-backed disease and pest entries that map to current published Gredice plant and operation entities. Broad host ranges are narrowed to current Gredice plants named by the reviewed sources.',
        '',
        ...Object.entries(plantHealthDirectorySources).map(
            ([key, source]) => `- ${key}: [${source.label}](${source.url})`,
        ),
        '',
        '## Import Summary',
        '',
        `- Dataset issues: ${plantHealthDirectoryDataset.length}`,
        `- Preflight problems: ${preflightProblems.length}`,
        `- Import stopped by preflight: ${importStoppedByPreflight ? 'yes' : 'no'}`,
        `- Created issue entities this run: ${importStoppedByPreflight ? 'not attempted' : results.filter((result) => result.created).length}`,
        `- Issue entities with field/ref changes planned or written: ${importStoppedByPreflight ? 'not attempted' : results.filter((result) => result.updatedFields.length > 0).length}`,
        `- Missing referenced plant names: ${missingPlants.length}`,
        `- Missing referenced operation names: ${missingOperations.length}`,
        `- Issues with at least one recommended operation: ${plantHealthDirectoryDataset.length - issuesWithoutRecommendations.length}/${plantHealthDirectoryDataset.length}`,
        `- Published plants in catalog: ${coverageRows.length}`,
        `- Published plants covered by disease dataset: ${coverageRows.filter(({ diseaseIssues }) => diseaseIssues.size > 0).length}`,
        `- Published plants covered by pest dataset: ${coverageRows.filter(({ pestIssues }) => pestIssues.size > 0).length}`,
        '',
        '## Preflight Problems',
        '',
        ...(preflightProblems.length > 0
            ? preflightProblems.map(
                  (problem) => `- [${problem.kind}] ${problem.message}`,
              )
            : ['- None']),
        '',
        '## Missing References',
        '',
        'Plants:',
        '',
        ...(missingPlants.length > 0
            ? missingPlants.map((name) => `- ${name}`)
            : ['- None']),
        '',
        'Operations:',
        '',
        ...(missingOperations.length > 0
            ? missingOperations.map((name) => `- ${name}`)
            : ['- None']),
        '',
        '## Recommendation Gaps',
        '',
        ...(issuesWithoutRecommendations.length > 0
            ? issuesWithoutRecommendations.map(
                  (entry) => `- ${entry.kind}: ${entry.name}`,
              )
            : ['- None']),
        '',
        '## Per-Plant Dataset Coverage',
        '',
        '| Plant ID | Plant | Diseases | Pests | Total |',
        '| ---: | --- | ---: | ---: | ---: |',
        ...coverageRows.map(({ plant, diseaseIssues, pestIssues }) => {
            const diseaseCount = diseaseIssues.size;
            const pestCount = pestIssues.size;
            return `| ${plant.id} | ${plant.name.replaceAll('|', '\\|')} | ${diseaseCount} | ${pestCount} | ${diseaseCount + pestCount} |`;
        }),
        '',
        '### No coverage',
        '',
        ...(noCoverage.length > 0
            ? noCoverage.map(formatCoverageGap)
            : ['- None']),
        '',
        '### No disease coverage',
        '',
        ...(noDiseaseCoverage.length > 0
            ? noDiseaseCoverage.map(formatCoverageGap)
            : ['- None']),
        '',
        '### No pest coverage',
        '',
        ...(noPestCoverage.length > 0
            ? noPestCoverage.map(formatCoverageGap)
            : ['- None']),
        '',
        '## Dataset Issues',
        '',
        ...(results.length > 0
            ? results.map((result) => {
                  const entityLabel = result.entityId
                      ? `${result.entry.name} (#${result.entityId})`
                      : result.entry.name;
                  const operations = Object.values(
                      result.entry.operations ?? {},
                  )
                      .flat()
                      .map((operationName) => {
                          const operationId =
                              operationIdsByName.get(operationName);
                          return operationId
                              ? `${operationName} (#${operationId})`
                              : operationName;
                      });
                  const plants = result.entry.affectedPlants.map(
                      (plantName) => {
                          const plantId = plantIdsByName.get(
                              normalizedName(plantName),
                          );
                          const resolvedPlantName = publishedPlants.find(
                              (plant) => plant.id === plantId,
                          )?.name;
                          return plantId
                              ? `${resolvedPlantName ?? plantName} (#${plantId})`
                              : plantName;
                      },
                  );
                  return [
                      `### ${entityLabel}`,
                      '',
                      `- Kind: ${result.entry.kind}`,
                      `- Affected plants: ${plants.join(', ')}`,
                      `- Helpful operations: ${operations.length > 0 ? operations.join(', ') : 'informational only'}`,
                      `- Sources: ${result.entry.sources.map((sourceKey) => plantHealthDirectorySources[sourceKey].label).join('; ')}`,
                      result.entry.reviewNotes?.length
                          ? `- Review notes: ${result.entry.reviewNotes.join(' ')}`
                          : null,
                      `- Fields/refs changed: ${result.updatedFields.length}`,
                      `- Existing refs skipped: ${result.skippedExistingRefs.length}`,
                      `- Existing refs removed: ${result.removedExistingRefs.length}`,
                      '',
                  ]
                      .filter((line): line is string => line !== null)
                      .join('\n');
              })
            : ['- Import was not attempted because preflight failed.']),
    ];

    await writeFile(reportPath, `${lines.join('\n').trimEnd()}\n`, 'utf8');
}

async function main() {
    const [plants, operations] = await Promise.all([
        getEntitiesRaw('plant', 'published'),
        getEntitiesRaw('operation', 'published'),
    ]);
    const publishedPlants = plants.flatMap((plant): PublishedPlant[] => {
        const name = textAttribute(plant, 'information', 'name');
        return name ? [{ id: plant.id, name: name.trim() }] : [];
    });
    const plantIdsByName = new Map<string, number>();
    for (const plant of publishedPlants) {
        plantIdsByName.set(normalizedName(plant.name), plant.id);
    }
    const operationIdsByName = new Map(
        operations
            .map(
                (operation) =>
                    [
                        textAttribute(operation, 'information', 'name'),
                        operation.id,
                    ] as const,
            )
            .filter((entry): entry is readonly [string, number] =>
                Boolean(entry[0]),
            ),
    );
    const preflightProblems = preflightDataset({
        operationIdsByName,
        plantIdsByName,
        publishedPlants,
    });

    if (apply && preflightProblems.length > 0) {
        await writeCoverageReport({
            operationIdsByName,
            plantIdsByName,
            preflightProblems,
            publishedPlants,
            results: [],
        });
        console.log(
            JSON.stringify(
                {
                    mode: 'apply',
                    issues: plantHealthDirectoryDataset.length,
                    importStoppedByPreflight: true,
                    preflightProblems: preflightProblems.map(
                        (problem) => problem.message,
                    ),
                    reportPath,
                },
                null,
                2,
            ),
        );
        throw new Error(
            `Plant health directory preflight failed with ${preflightProblems.length} problem(s). No schema or entity writes were attempted.`,
        );
    }

    const categoryId = await ensureEntityTypeCategory();
    await ensureHealthEntityTypes(categoryId);
    const [diseaseDefinitions, pestDefinitions] = await Promise.all([
        ensureAttributeDefinitions(plantHealthIssueTypeNames.disease),
        ensureAttributeDefinitions(plantHealthIssueTypeNames.pest),
    ]);

    const results: ImportIssueResult[] = [];
    for (const entry of plantHealthDirectoryDataset) {
        results.push(
            await importIssue({
                entry,
                definitions:
                    entry.kind === 'disease'
                        ? diseaseDefinitions
                        : pestDefinitions,
                operationIdsByName,
                plantIdsByName,
            }),
        );
    }

    await writeCoverageReport({
        operationIdsByName,
        plantIdsByName,
        preflightProblems,
        publishedPlants,
        results,
    });

    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                issues: results.length,
                created: results.filter((result) => result.created).length,
                changed: results.filter(
                    (result) => result.updatedFields.length > 0,
                ).length,
                preflightProblems: preflightProblems.map(
                    (problem) => problem.message,
                ),
                missingPlants: Array.from(
                    new Set([
                        ...preflightProblems
                            .filter(
                                (problem) => problem.kind === 'missing-plant',
                            )
                            .map((problem) => problem.value),
                        ...results.flatMap((result) => result.missingPlants),
                    ]),
                ).sort((left, right) => left.localeCompare(right, 'hr')),
                missingOperations: Array.from(
                    new Set([
                        ...preflightProblems
                            .filter(
                                (problem) =>
                                    problem.kind === 'missing-operation',
                            )
                            .map((problem) => problem.value),
                        ...results.flatMap(
                            (result) => result.missingOperations,
                        ),
                    ]),
                ).sort((left, right) => left.localeCompare(right, 'hr')),
                reportPath,
            },
            null,
            2,
        ),
    );
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
