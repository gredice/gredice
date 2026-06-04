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
    createEntity,
    entityTypeCategories,
    entityTypes,
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
    missingPlants: string[];
    missingOperations: string[];
};

const apply = process.argv.includes('--apply');
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
    value,
}: {
    definition: SelectAttributeDefinition;
    entityId: number;
    entityTypeName: HealthEntityTypeName;
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
        await upsertAttributeValue({
            id: existing?.id,
            attributeDefinitionId: definition.id,
            entityTypeName,
            entityId,
            value,
        });
    }

    return true;
}

async function addMultipleAttributeValues({
    definition,
    entityId,
    entityTypeName,
    values,
}: {
    definition: SelectAttributeDefinition;
    entityId: number;
    entityTypeName: HealthEntityTypeName;
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
            await upsertAttributeValue({
                attributeDefinitionId: definition.id,
                entityTypeName,
                entityId,
                value,
            });
        }
        createdValues.push(value);
    }

    return {
        createdValues,
        skippedExistingValues,
    };
}

async function existingIssueEntityId(
    entityTypeName: HealthEntityTypeName,
    nameDefinitionId: number,
    name: string,
) {
    const entities = await getEntitiesRaw(entityTypeName);
    return (
        entities.find((entity) =>
            entity.attributes.some(
                (attribute) =>
                    attribute.attributeDefinitionId === nameDefinitionId &&
                    attribute.value === name,
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
        entry.name,
    );
    const created = !existingId;
    const entityId =
        existingId ?? (apply ? await createEntity(entityTypeName) : null);
    const result: ImportIssueResult = {
        entry,
        entityTypeName,
        entityId,
        created,
        updatedFields: [],
        skippedExistingRefs: [],
        missingPlants: [],
        missingOperations: [],
    };

    if (!entityId) {
        return result;
    }

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

    for (const [category, name, value] of singleFields) {
        const changed = await setSingleAttribute({
            definition: definitionOrThrow(definitions, category, name),
            entityId,
            entityTypeName,
            value,
        });
        if (changed) {
            result.updatedFields.push(attributeKey(category, name));
        }
    }

    const affectedPlantIds: string[] = [];
    for (const plantName of entry.affectedPlants) {
        const plantId = plantIdsByName.get(normalizedName(plantName));
        if (!plantId) {
            result.missingPlants.push(plantName);
            continue;
        }
        affectedPlantIds.push(String(plantId));
    }
    const affectedPlantResult = await addMultipleAttributeValues({
        definition: definitionOrThrow(
            definitions,
            plantHealthRelationshipCategory,
            plantHealthAffectedPlantsAttributeName,
        ),
        entityId,
        entityTypeName,
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

        const operationResult = await addMultipleAttributeValues({
            definition: definitionOrThrow(
                definitions,
                plantHealthOperationCategory,
                attributeName,
            ),
            entityId,
            entityTypeName,
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
    }

    const sourceValues = entry.sources.map((sourceKey) =>
        JSON.stringify(plantHealthDirectorySources[sourceKey]),
    );
    const sourceResult = await addMultipleAttributeValues({
        definition: definitionOrThrow(definitions, 'review', 'sources'),
        entityId,
        entityTypeName,
        values: sourceValues,
    });
    result.updatedFields.push(
        ...sourceResult.createdValues.map(() =>
            attributeKey('review', 'sources'),
        ),
    );

    if (
        apply &&
        result.missingPlants.length === 0 &&
        result.missingOperations.length === 0
    ) {
        await updateEntity({ id: entityId, state: 'published' });
    }

    return result;
}

async function writeCoverageReport({
    operationIdsByName,
    plantIdsByName,
    results,
}: {
    operationIdsByName: Map<string, number>;
    plantIdsByName: Map<string, number>;
    results: ImportIssueResult[];
}) {
    const affectedPlants = new Map<
        string,
        { diseases: number; pests: number }
    >();
    for (const entry of plantHealthDirectoryDataset) {
        for (const plantName of entry.affectedPlants) {
            const key = normalizedName(plantName);
            const current = affectedPlants.get(key) ?? {
                diseases: 0,
                pests: 0,
            };
            if (entry.kind === 'disease') {
                current.diseases += 1;
            } else {
                current.pests += 1;
            }
            affectedPlants.set(key, current);
        }
    }

    const missingPlants = Array.from(
        new Set(results.flatMap((result) => result.missingPlants)),
    ).sort((left, right) => left.localeCompare(right, 'hr'));
    const missingOperations = Array.from(
        new Set(results.flatMap((result) => result.missingOperations)),
    ).sort((left, right) => left.localeCompare(right, 'hr'));

    const lines = [
        '# Plant Health Directory Coverage',
        '',
        `Generated: ${new Date().toISOString()}`,
        `Mode: ${apply ? 'apply' : 'dry-run'}`,
        '',
        '## Source Notes',
        '',
        'This first-release dataset imports only source-backed disease and pest entries that map to current published Gredice plant and operation entities. Broad host ranges are narrowed to current Gredice plants named by the reviewed sources.',
        '',
        ...Object.entries(plantHealthDirectorySources).map(
            ([key, source]) => `- ${key}: [${source.label}](${source.url})`,
        ),
        '',
        '## Import Summary',
        '',
        `- Dataset issues: ${plantHealthDirectoryDataset.length}`,
        `- Created issue entities this run: ${results.filter((result) => result.created).length}`,
        `- Issue entities with field/ref changes planned or written: ${results.filter((result) => result.updatedFields.length > 0).length}`,
        `- Missing referenced plant names: ${missingPlants.length}`,
        `- Missing referenced operation names: ${missingOperations.length}`,
        `- Published plants with disease coverage: ${Array.from(affectedPlants.values()).filter((coverage) => coverage.diseases > 0).length}`,
        `- Published plants with pest coverage: ${Array.from(affectedPlants.values()).filter((coverage) => coverage.pests > 0).length}`,
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
        '## Dataset Issues',
        '',
        ...results.map((result) => {
            const entityLabel = result.entityId
                ? `${result.entry.name} (#${result.entityId})`
                : result.entry.name;
            const operations = Object.values(result.entry.operations ?? {})
                .flat()
                .map((operationName) => {
                    const operationId = operationIdsByName.get(operationName);
                    return operationId
                        ? `${operationName} (#${operationId})`
                        : operationName;
                });
            const plants = result.entry.affectedPlants.map((plantName) => {
                const plantId = plantIdsByName.get(normalizedName(plantName));
                return plantId ? `${plantName} (#${plantId})` : plantName;
            });
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
                '',
            ]
                .filter((line): line is string => line !== null)
                .join('\n');
        }),
        '',
    ];

    await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
    const categoryId = await ensureEntityTypeCategory();
    await ensureHealthEntityTypes(categoryId);
    const [diseaseDefinitions, pestDefinitions, plants, operations] =
        await Promise.all([
            ensureAttributeDefinitions(plantHealthIssueTypeNames.disease),
            ensureAttributeDefinitions(plantHealthIssueTypeNames.pest),
            getEntitiesRaw('plant', 'published'),
            getEntitiesRaw('operation', 'published'),
        ]);

    const plantIdsByName = new Map(
        plants
            .map(
                (plant) =>
                    [
                        textAttribute(plant, 'information', 'name'),
                        plant.id,
                    ] as const,
            )
            .filter((entry): entry is readonly [string, number] =>
                Boolean(entry[0]),
            )
            .map(([name, id]) => [normalizedName(name), id]),
    );
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
                missingPlants: Array.from(
                    new Set(results.flatMap((result) => result.missingPlants)),
                ).sort((left, right) => left.localeCompare(right, 'hr')),
                missingOperations: Array.from(
                    new Set(
                        results.flatMap((result) => result.missingOperations),
                    ),
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
