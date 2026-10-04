import { and, eq, inArray } from 'drizzle-orm';
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

type OperationPreflight = {
    application: string;
    entityId: number;
    technicalName: string;
    targetValue: 'false' | 'true';
};

type PlannedOperation = OperationPreflight & {
    action: 'create' | 'unchanged' | 'update';
    existingValue: ExistingAttributeValue | null;
};

const actor = {
    id: 'codex',
    name: 'Codex',
};

const entityTypeName = 'operation';
const technicalNamePath = 'information.name';
const applicationPath = 'attributes.application';
const targetPath = 'attributes.appliesToEmptyFields';

const emptyFieldOperationTechnicalNames = new Set([
    'malchStrawPlant',
    'pullingWeedsPlant',
    'removeMalchStrawPlant',
]);

const targetDefinitionConfig = {
    category: 'attributes',
    dataType: 'boolean',
    defaultValue: 'false',
    description:
        'When true, the operation can be offered for an empty raised-bed field without a planted crop.',
    display: false,
    entityTypeName,
    label: 'Primjenjivo na prazna polja',
    multiple: false,
    name: 'appliesToEmptyFields',
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
            `Expected exactly one active ${entityTypeName} ${path} definition, found ${matches.length.toString()}.`,
        );
    }
    return matches[0];
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

async function getValuesByEntityId({
    attributeDefinitionId,
    entityIds,
}: {
    attributeDefinitionId: number;
    entityIds: number[];
}) {
    const rows = await storage()
        .select({
            entityId: attributeValues.entityId,
            id: attributeValues.id,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(
                    attributeValues.attributeDefinitionId,
                    attributeDefinitionId,
                ),
                eq(attributeValues.entityTypeName, entityTypeName),
                eq(attributeValues.isDeleted, false),
                inArray(attributeValues.entityId, entityIds),
            ),
        );

    const rowsByEntityId = new Map<number, ExistingAttributeValue[]>();
    for (const row of rows) {
        if (!row.entityId) {
            throw new Error(
                `Found ${targetPath} value #${row.id.toString()} without an entity ID.`,
            );
        }
        const entityRows = rowsByEntityId.get(row.entityId) ?? [];
        entityRows.push({ id: row.id, value: row.value });
        rowsByEntityId.set(row.entityId, entityRows);
    }

    return rowsByEntityId;
}

function requireSingleValue(
    rowsByEntityId: Map<number, ExistingAttributeValue[]>,
    entityId: number,
    path: string,
) {
    const rows = rowsByEntityId.get(entityId) ?? [];
    if (rows.length !== 1) {
        throw new Error(
            `Expected exactly one active ${path} value for operation #${entityId.toString()}, found ${rows.length.toString()}.`,
        );
    }
    if (rows[0].value === null) {
        throw new Error(
            `Expected a non-null ${path} value for operation #${entityId.toString()}.`,
        );
    }
    return rows[0].value;
}

async function preflightOperations({
    applicationDefinition,
    nameDefinition,
}: {
    applicationDefinition: SelectAttributeDefinition;
    nameDefinition: SelectAttributeDefinition;
}) {
    const operationEntities = await storage()
        .select({ id: entities.id })
        .from(entities)
        .where(
            and(
                eq(entities.entityTypeName, entityTypeName),
                eq(entities.isDeleted, false),
            ),
        )
        .orderBy(entities.id);

    if (operationEntities.length === 0) {
        throw new Error('Expected at least one active operation entity.');
    }

    const entityIds = operationEntities.map((operation) => operation.id);
    const [applicationValues, nameValues] = await Promise.all([
        getValuesByEntityId({
            attributeDefinitionId: applicationDefinition.id,
            entityIds,
        }),
        getValuesByEntityId({
            attributeDefinitionId: nameDefinition.id,
            entityIds,
        }),
    ]);
    const operations = operationEntities.map(({ id: entityId }) => {
        const technicalName = requireSingleValue(
            nameValues,
            entityId,
            technicalNamePath,
        );
        const application = requireSingleValue(
            applicationValues,
            entityId,
            applicationPath,
        );
        return {
            application,
            entityId,
            technicalName,
            targetValue: emptyFieldOperationTechnicalNames.has(technicalName)
                ? 'true'
                : 'false',
        } satisfies OperationPreflight;
    });

    const operationByTechnicalName = new Map<string, OperationPreflight>();
    for (const operation of operations) {
        if (operationByTechnicalName.has(operation.technicalName)) {
            throw new Error(
                `Expected unique operation technical names, found duplicate ${operation.technicalName}.`,
            );
        }
        operationByTechnicalName.set(operation.technicalName, operation);
    }

    for (const technicalName of emptyFieldOperationTechnicalNames) {
        const operation = operationByTechnicalName.get(technicalName);
        if (!operation) {
            throw new Error(
                `Expected exactly one active operation with technical name ${technicalName}.`,
            );
        }
        if (operation.application !== 'plant') {
            throw new Error(
                `Expected empty-field operation ${technicalName} (#${operation.entityId.toString()}) to have ${applicationPath}=plant, found ${JSON.stringify(operation.application)}.`,
            );
        }
    }

    return operations;
}

async function planOperations({
    operations,
    targetDefinition,
}: {
    operations: OperationPreflight[];
    targetDefinition: SelectAttributeDefinition | null;
}) {
    const existingValues = targetDefinition
        ? await getValuesByEntityId({
              attributeDefinitionId: targetDefinition.id,
              entityIds: operations.map((operation) => operation.entityId),
          })
        : new Map<number, ExistingAttributeValue[]>();

    return operations.map((operation) => {
        const entityValues = existingValues.get(operation.entityId) ?? [];
        if (entityValues.length > 1) {
            throw new Error(
                `Expected at most one active ${targetPath} value for ${operation.technicalName} (#${operation.entityId.toString()}), found ${entityValues.length.toString()}.`,
            );
        }
        const existingValue = entityValues[0] ?? null;
        return {
            ...operation,
            action:
                existingValue?.value === operation.targetValue
                    ? 'unchanged'
                    : existingValue
                      ? 'update'
                      : 'create',
            existingValue,
        } satisfies PlannedOperation;
    });
}

async function verifyOperations({
    operations,
    targetDefinition,
}: {
    operations: OperationPreflight[];
    targetDefinition: SelectAttributeDefinition;
}) {
    const persistedValues = await getValuesByEntityId({
        attributeDefinitionId: targetDefinition.id,
        entityIds: operations.map((operation) => operation.entityId),
    });

    for (const operation of operations) {
        const values = persistedValues.get(operation.entityId) ?? [];
        if (values.length !== 1 || values[0].value !== operation.targetValue) {
            throw new Error(
                `Failed to verify ${targetPath}=${operation.targetValue} for ${operation.technicalName} (#${operation.entityId.toString()}).`,
            );
        }
    }
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
            `Expected at most one active ${entityTypeName} ${targetPath} definition, found ${targetDefinitions.length.toString()}.`,
        );
    }
    const existingTargetDefinition = targetDefinitions[0] ?? null;

    // Complete every catalogue check before applying definition or value writes.
    const operations = await preflightOperations({
        applicationDefinition,
        nameDefinition,
    });
    const planned = await planOperations({
        operations,
        targetDefinition: existingTargetDefinition,
    });
    const definitionResult = await ensureTargetDefinition({
        apply,
        existingDefinition: existingTargetDefinition,
    });

    if (apply) {
        if (!definitionResult.definition) {
            throw new Error(`Cannot apply without ${targetPath} definition.`);
        }
        if (targetDefinitionNeedsUpdate(definitionResult.definition)) {
            throw new Error(
                `${targetPath} does not match the expected definition after applying changes.`,
            );
        }

        const changedOperations = planned.filter(
            (operation) => operation.action !== 'unchanged',
        );
        const sideEffects = createAttributeValueMutationSideEffects();
        for (const operation of changedOperations) {
            sideEffects.entityIds.add(operation.entityId);
            sideEffects.entityTypeNames.add(entityTypeName);
            sideEffects.searchEntityIds.add(operation.entityId);
            sideEffects.dashboardAdmin = true;
        }

        await storage().transaction(async (tx) => {
            for (const operation of changedOperations) {
                await upsertAttributeValue(
                    {
                        id: operation.existingValue?.id,
                        attributeDefinitionId: definitionResult.definition.id,
                        entityId: operation.entityId,
                        entityTypeName,
                        order: definitionResult.definition.order,
                        value: operation.targetValue,
                    },
                    actor,
                    { db: tx, sideEffects },
                );
            }
        });
        await flushAttributeValueMutationSideEffects(sideEffects);
        await verifyOperations({
            operations,
            targetDefinition: definitionResult.definition,
        });
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
                totals: {
                    operations: planned.length,
                    eligible: planned.filter(
                        (operation) => operation.targetValue === 'true',
                    ).length,
                    ineligible: planned.filter(
                        (operation) => operation.targetValue === 'false',
                    ).length,
                    create: planned.filter(
                        (operation) => operation.action === 'create',
                    ).length,
                    update: planned.filter(
                        (operation) => operation.action === 'update',
                    ).length,
                    unchanged: planned.filter(
                        (operation) => operation.action === 'unchanged',
                    ).length,
                },
                eligibleOperations: planned
                    .filter((operation) => operation.targetValue === 'true')
                    .map((operation) => ({
                        entityId: operation.entityId,
                        technicalName: operation.technicalName,
                        application: operation.application,
                        action: operation.action,
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
