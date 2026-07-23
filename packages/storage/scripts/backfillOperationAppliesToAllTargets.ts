import { and, eq } from 'drizzle-orm';
import {
    attributeValues,
    closeStorage,
    createAttributeDefinition,
    createAttributeValueMutationSideEffects,
    entities,
    flushAttributeValueMutationSideEffects,
    getAttributeDefinitions,
    type SelectAttributeDefinition,
    storage,
    updateAttributeDefinition,
    upsertAttributeValue,
} from '../src';

type ExistingAttributeValue = {
    id: number;
    value: string | null;
};

type CandidatePreflight = {
    application: 'plant';
    entityId: number;
    technicalName: string;
};

type PlannedCandidate = CandidatePreflight & {
    action: 'create' | 'update' | 'unchanged';
    existingValue: ExistingAttributeValue | null;
};

const actor = {
    id: 'codex',
    name: 'Codex',
};

const entityTypeName = 'operation';
const technicalNamePath = 'information.name';
const applicationPath = 'attributes.application';
const targetPath = 'attributes.appliesToAllTargets';
const targetValue = 'true';

// Keep crop-, harvest-, pruning-, support-, and health-specific actions linked
// explicitly; these generic plant actions can be offered for every plant.
const candidateTechnicalNames = [
    'plantPhoto',
    'malchStrawPlant',
    'pullingWeedsPlant',
    'plantRemoval',
    'removeMalchStrawPlant',
] as const;

const targetDefinitionConfig = {
    category: 'attributes',
    dataType: 'boolean',
    defaultValue: 'false',
    description:
        'When true, the operation applies to every target covered by its application (for example, every plant when application is plant).',
    display: false,
    entityTypeName,
    label: 'Primjenjivo na sve ciljeve',
    multiple: false,
    name: 'appliesToAllTargets',
    order: null,
    required: false,
    unit: null,
};

function parseArgs(argv: string[]) {
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
) {
    const matches = definitionsAtPath(definitions, path);
    if (matches.length !== 1) {
        throw new Error(
            `Expected exactly one active ${entityTypeName} ${path} definition, found ${matches.length}.`,
        );
    }
    return matches[0];
}

async function findOperationByExactTechnicalName({
    nameDefinition,
    technicalName,
}: {
    nameDefinition: SelectAttributeDefinition;
    technicalName: string;
}) {
    const matches = await storage()
        .select({
            entityId: entities.id,
            nameValueId: attributeValues.id,
        })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, entityTypeName),
                eq(entities.isDeleted, false),
                eq(attributeValues.entityTypeName, entityTypeName),
                eq(attributeValues.attributeDefinitionId, nameDefinition.id),
                eq(attributeValues.value, technicalName),
                eq(attributeValues.isDeleted, false),
            ),
        );

    if (matches.length !== 1) {
        throw new Error(
            `Expected exactly one active operation with technical name ${technicalName}, found ${matches.length}.`,
        );
    }

    return matches[0];
}

async function requirePlantApplication({
    applicationDefinition,
    entityId,
    technicalName,
}: {
    applicationDefinition: SelectAttributeDefinition;
    entityId: number;
    technicalName: string;
}) {
    const applicationValues = await storage()
        .select({
            id: attributeValues.id,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, entityId),
                eq(attributeValues.entityTypeName, entityTypeName),
                eq(
                    attributeValues.attributeDefinitionId,
                    applicationDefinition.id,
                ),
                eq(attributeValues.isDeleted, false),
            ),
        );

    if (applicationValues.length !== 1) {
        throw new Error(
            `Expected exactly one active ${applicationPath} value for ${technicalName} (#${entityId}), found ${applicationValues.length}.`,
        );
    }
    if (applicationValues[0].value !== 'plant') {
        throw new Error(
            `Expected ${technicalName} (#${entityId}) to have ${applicationPath}=plant, found ${JSON.stringify(applicationValues[0].value)}.`,
        );
    }
}

async function preflightCandidates({
    applicationDefinition,
    nameDefinition,
}: {
    applicationDefinition: SelectAttributeDefinition;
    nameDefinition: SelectAttributeDefinition;
}) {
    const candidates: CandidatePreflight[] = [];

    for (const technicalName of candidateTechnicalNames) {
        const operation = await findOperationByExactTechnicalName({
            nameDefinition,
            technicalName,
        });
        await requirePlantApplication({
            applicationDefinition,
            entityId: operation.entityId,
            technicalName,
        });
        candidates.push({
            application: 'plant',
            entityId: operation.entityId,
            technicalName,
        });
    }

    const uniqueEntityIds = new Set(
        candidates.map((candidate) => candidate.entityId),
    );
    if (uniqueEntityIds.size !== candidates.length) {
        throw new Error(
            'Expected each candidate technical name to resolve to a distinct operation entity.',
        );
    }

    return candidates;
}

function targetDefinitionNeedsUpdate(definition: SelectAttributeDefinition) {
    return (
        definition.dataType !== targetDefinitionConfig.dataType ||
        definition.defaultValue !== targetDefinitionConfig.defaultValue ||
        definition.description !== targetDefinitionConfig.description ||
        definition.display !== targetDefinitionConfig.display ||
        definition.label !== targetDefinitionConfig.label ||
        definition.multiple !== targetDefinitionConfig.multiple ||
        definition.order !== targetDefinitionConfig.order ||
        definition.required !== targetDefinitionConfig.required ||
        definition.unit !== targetDefinitionConfig.unit
    );
}

async function ensureTargetDefinition({
    apply,
    existingDefinition,
}: {
    apply: boolean;
    existingDefinition: SelectAttributeDefinition | null;
}) {
    if (existingDefinition) {
        const needsUpdate = targetDefinitionNeedsUpdate(existingDefinition);
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
            ...targetDefinitionConfig,
        });
        const definitions = await getAttributeDefinitions(entityTypeName);
        const updatedDefinition = requireExactlyOneDefinition(
            definitions,
            targetPath,
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

    const id = await createAttributeDefinition(targetDefinitionConfig);
    const definitions = await getAttributeDefinitions(entityTypeName);
    const createdDefinition = requireExactlyOneDefinition(
        definitions,
        targetPath,
    );
    if (createdDefinition.id !== id) {
        throw new Error(`Failed to create ${targetPath}.`);
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
    entityId,
    technicalName,
}: {
    attributeDefinitionId: number | null;
    entityId: number;
    technicalName: string;
}): Promise<ExistingAttributeValue | null> {
    if (!attributeDefinitionId) {
        return null;
    }

    const existingValues = await storage()
        .select({
            id: attributeValues.id,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, entityId),
                eq(attributeValues.entityTypeName, entityTypeName),
                eq(
                    attributeValues.attributeDefinitionId,
                    attributeDefinitionId,
                ),
                eq(attributeValues.isDeleted, false),
            ),
        );

    if (existingValues.length > 1) {
        throw new Error(
            `Expected at most one active ${targetPath} value for ${technicalName} (#${entityId}), found ${existingValues.length}.`,
        );
    }

    return existingValues[0] ?? null;
}

async function planCandidates({
    candidates,
    targetDefinition,
}: {
    candidates: CandidatePreflight[];
    targetDefinition: SelectAttributeDefinition | null;
}) {
    const planned: PlannedCandidate[] = [];

    for (const candidate of candidates) {
        const existingValue = await getExistingTargetValue({
            attributeDefinitionId: targetDefinition?.id ?? null,
            entityId: candidate.entityId,
            technicalName: candidate.technicalName,
        });
        planned.push({
            ...candidate,
            action:
                existingValue?.value === targetValue
                    ? 'unchanged'
                    : existingValue
                      ? 'update'
                      : 'create',
            existingValue,
        });
    }

    return planned;
}

async function main() {
    const { apply } = parseArgs(process.argv.slice(2));
    const definitions = await getAttributeDefinitions(entityTypeName);
    const nameDefinition = requireExactlyOneDefinition(
        definitions,
        technicalNamePath,
    );
    const applicationDefinition = requireExactlyOneDefinition(
        definitions,
        applicationPath,
    );
    const targetDefinitions = definitionsAtPath(definitions, targetPath);
    if (targetDefinitions.length > 1) {
        throw new Error(
            `Expected at most one active ${entityTypeName} ${targetPath} definition, found ${targetDefinitions.length}.`,
        );
    }
    const existingTargetDefinition = targetDefinitions[0] ?? null;

    // Complete every candidate check before applying definition or value writes.
    const candidates = await preflightCandidates({
        applicationDefinition,
        nameDefinition,
    });
    const planned = await planCandidates({
        candidates,
        targetDefinition: existingTargetDefinition,
    });
    const definitionResult = await ensureTargetDefinition({
        apply,
        existingDefinition: existingTargetDefinition,
    });
    const verifiedCandidates: Array<{
        entityId: number;
        technicalName: string;
        valueId: number;
    }> = [];

    if (apply) {
        if (!definitionResult.definition) {
            throw new Error(`Cannot apply without ${targetPath} definition.`);
        }
        if (targetDefinitionNeedsUpdate(definitionResult.definition)) {
            throw new Error(
                `${targetPath} does not match the expected definition after applying changes.`,
            );
        }

        const sideEffects = createAttributeValueMutationSideEffects();
        for (const candidate of candidates) {
            sideEffects.entityIds.add(candidate.entityId);
            sideEffects.entityTypeNames.add(entityTypeName);
            sideEffects.searchEntityIds.add(candidate.entityId);
            sideEffects.dashboardAdmin = true;
        }
        await storage().transaction(async (tx) => {
            for (const candidate of planned) {
                if (candidate.action === 'unchanged') {
                    continue;
                }
                await upsertAttributeValue(
                    {
                        id: candidate.existingValue?.id,
                        attributeDefinitionId: definitionResult.definition.id,
                        entityId: candidate.entityId,
                        entityTypeName,
                        order: definitionResult.definition.order,
                        value: targetValue,
                    },
                    actor,
                    { db: tx, sideEffects },
                );
            }
        });
        await flushAttributeValueMutationSideEffects(sideEffects);

        for (const candidate of candidates) {
            const persistedValue = await getExistingTargetValue({
                attributeDefinitionId: definitionResult.definition.id,
                entityId: candidate.entityId,
                technicalName: candidate.technicalName,
            });
            if (persistedValue?.value !== targetValue) {
                throw new Error(
                    `Failed to verify ${targetPath}=${targetValue} for ${candidate.technicalName} (#${candidate.entityId}).`,
                );
            }
            verifiedCandidates.push({
                entityId: candidate.entityId,
                technicalName: candidate.technicalName,
                valueId: persistedValue.id,
            });
        }
    }

    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                attribute: {
                    path: targetPath,
                    definitionId: definitionResult.definition?.id ?? null,
                    created: definitionResult.created,
                    updated: definitionResult.updated,
                    wouldCreate: definitionResult.wouldCreate,
                    wouldUpdate: definitionResult.wouldUpdate,
                },
                preflight: {
                    technicalNamePath,
                    applicationPath,
                    expectedApplication: 'plant',
                    candidates: candidates.length,
                },
                verification: apply
                    ? {
                          expectedValue: targetValue,
                          candidates: verifiedCandidates,
                      }
                    : null,
                totals: {
                    create: planned.filter(
                        (candidate) => candidate.action === 'create',
                    ).length,
                    update: planned.filter(
                        (candidate) => candidate.action === 'update',
                    ).length,
                    unchanged: planned.filter(
                        (candidate) => candidate.action === 'unchanged',
                    ).length,
                },
                candidates: planned.map((candidate) => ({
                    technicalName: candidate.technicalName,
                    entityId: candidate.entityId,
                    application: candidate.application,
                    existingValueId: candidate.existingValue?.id ?? null,
                    previousValue: candidate.existingValue?.value ?? null,
                    nextValue: targetValue,
                    action: candidate.action,
                })),
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
