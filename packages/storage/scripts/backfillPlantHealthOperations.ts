import { and, eq } from 'drizzle-orm';
import {
    attributeValues,
    closeStorage,
    createEntity,
    deleteAttributeValue,
    entities,
    getAttributeDefinitions,
    imageAttributeValueFromUrl,
    type SelectAttributeDefinition,
    storage,
    updateEntity,
    upsertAttributeValue,
} from '../src';
import {
    type PlantHealthOperationSpec,
    plantHealthMaintenanceStage,
    plantHealthOperationApplicabilityUpdates,
    plantHealthOperationCopyUpdates,
    plantHealthOperationSpecs,
} from '../src/data/plantHealthOperations';

/**
 * From the repository root, omit --apply for a read-only plan:
 * pnpm --filter @gredice/storage exec tsx --conditions=react-server
 *   --env-file=.env ./scripts/backfillPlantHealthOperations.ts [--apply]
 */
const operationEntityTypeName = 'operation';
const plantStageEntityTypeName = 'plantStage';

const actor = {
    id: 'plant-health-operation-backfill',
    name: 'Plant health operation backfill',
};

type ExistingEntity = {
    id: number;
    state: string;
};

type ExistingAttributeValue = {
    id: number;
    attributeDefinitionId: number;
    value: string | null;
};

type PlannedAttributeUpdate = {
    path: string;
    definition: SelectAttributeDefinition;
    existingValueId?: number;
    previousValue: string | null;
    nextValue: string | null;
};

type NewOperationPlan = {
    name: string;
    entity: ExistingEntity | null;
    create: boolean;
    attributeUpdates: PlannedAttributeUpdate[];
    publish: boolean;
};

type GuardedOperationPlan = {
    name: string;
    entity: ExistingEntity;
    attributeUpdates: PlannedAttributeUpdate[];
};

function attributePath(definition: SelectAttributeDefinition) {
    return `${definition.category}.${definition.name}`;
}

function valuesForOperationSpec(
    spec: PlantHealthOperationSpec,
): Record<string, string | null> {
    const values: Record<string, string | null> = {
        'information.name': spec.name,
        'information.label': spec.label,
        'information.shortDescription': spec.shortDescription,
        'information.description': spec.description,
        'information.instructions': spec.instructions,
        'attributes.application': spec.application,
        'attributes.appliesToAllTargets': String(spec.appliesToAllTargets),
        'attributes.duration': String(spec.durationMinutes),
        'attributes.frequency': spec.frequency,
        'attributes.deliverable': String(spec.deliverable),
        'attributes.internal': String(spec.internal),
        'attributes.printLabel': String(spec.printLabel),
        'attributes.stage': String(spec.stageId),
        'conditions.completionAttachImages': String(
            spec.completionAttachImages,
        ),
        'conditions.completionAttachImagesRequired': String(
            spec.completionAttachImagesRequired,
        ),
        'conditions.completionAttachNotes': String(spec.completionAttachNotes),
        'conditions.completionAttachNotesRequired': String(
            spec.completionAttachNotesRequired,
        ),
        'prices.perOperation': String(spec.pricePerOperation),
        'image.cover': imageAttributeValueFromUrl(spec.coverUrl),
    };

    if (spec.visualReward !== undefined) {
        values['attributes.visualReward'] = spec.visualReward;
    }

    return values;
}

function definitionsByPath(
    definitions: SelectAttributeDefinition[],
): Map<string, SelectAttributeDefinition> {
    const result = new Map<string, SelectAttributeDefinition>();

    for (const definition of definitions) {
        const path = attributePath(definition);
        if (result.has(path)) {
            throw new Error(
                `Expected one active attribute definition for ${path}.`,
            );
        }
        result.set(path, definition);
    }

    return result;
}

function requireDefinitions(
    definitions: Map<string, SelectAttributeDefinition>,
    paths: Iterable<string>,
) {
    const missingPaths = Array.from(new Set(paths)).filter(
        (path) => !definitions.has(path),
    );
    if (missingPaths.length > 0) {
        throw new Error(
            `Missing operation attribute definitions: ${missingPaths.join(', ')}.`,
        );
    }

    for (const path of paths) {
        const definition = definitions.get(path);
        if (definition?.multiple) {
            throw new Error(
                `Operation attribute definition ${path} must be single-valued.`,
            );
        }
    }
}

async function exactOperationNameMatches({
    name,
    nameDefinition,
}: {
    name: string;
    nameDefinition: SelectAttributeDefinition;
}): Promise<ExistingEntity[]> {
    return storage()
        .select({
            id: entities.id,
            state: entities.state,
        })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .where(
            and(
                eq(entities.entityTypeName, operationEntityTypeName),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeValues.attributeDefinitionId, nameDefinition.id),
                eq(attributeValues.value, name),
            ),
        )
        .limit(2);
}

async function findOperationByExactName({
    name,
    nameDefinition,
}: {
    name: string;
    nameDefinition: SelectAttributeDefinition;
}) {
    const matches = await exactOperationNameMatches({
        name,
        nameDefinition,
    });
    if (matches.length > 1) {
        throw new Error(
            `Expected at most one operation named "${name}", found ${matches.length}.`,
        );
    }

    return matches[0] ?? null;
}

async function activeAttributeValuesByDefinitionId(entityId: number) {
    const rows = await storage()
        .select({
            id: attributeValues.id,
            attributeDefinitionId: attributeValues.attributeDefinitionId,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, entityId),
                eq(attributeValues.isDeleted, false),
            ),
        );

    const result = new Map<number, ExistingAttributeValue[]>();
    for (const row of rows) {
        const values = result.get(row.attributeDefinitionId) ?? [];
        values.push(row);
        result.set(row.attributeDefinitionId, values);
    }
    return result;
}

function planAttributeUpdates({
    currentValues,
    definitions,
    entityName,
    desiredValues,
}: {
    currentValues: Map<number, ExistingAttributeValue[]>;
    definitions: Map<string, SelectAttributeDefinition>;
    entityName: string;
    desiredValues: Record<string, string | null>;
}) {
    const updates: PlannedAttributeUpdate[] = [];

    for (const [path, nextValue] of Object.entries(desiredValues)) {
        const definition = definitions.get(path);
        if (!definition) {
            throw new Error(`Missing operation attribute definition ${path}.`);
        }

        const matchingValues = currentValues.get(definition.id) ?? [];
        if (matchingValues.length > 1) {
            throw new Error(
                `Expected at most one active ${path} value on "${entityName}", found ${matchingValues.length}.`,
            );
        }

        const existingValue = matchingValues[0];
        if (!existingValue && nextValue === null) {
            continue;
        }
        if (existingValue?.value === nextValue) {
            continue;
        }

        updates.push({
            path,
            definition,
            existingValueId: existingValue?.id,
            previousValue: existingValue?.value ?? null,
            nextValue,
        });
    }

    return updates;
}

async function requireGuardedOperation({
    entityId,
    expectedName,
    nameDefinition,
}: {
    entityId: number;
    expectedName: string;
    nameDefinition: SelectAttributeDefinition;
}): Promise<ExistingEntity> {
    const [entity] = await storage()
        .select({
            id: entities.id,
            entityTypeName: entities.entityTypeName,
            isDeleted: entities.isDeleted,
            state: entities.state,
        })
        .from(entities)
        .where(eq(entities.id, entityId))
        .limit(1);

    if (!entity) {
        throw new Error(`Expected operation #${entityId} to exist.`);
    }
    if (entity.isDeleted || entity.entityTypeName !== operationEntityTypeName) {
        throw new Error(
            `Entity #${entityId} is not an active operation entity.`,
        );
    }
    if (entity.state !== 'published') {
        throw new Error(
            `Expected operation #${entityId} "${expectedName}" to be published.`,
        );
    }

    const matches = await exactOperationNameMatches({
        name: expectedName,
        nameDefinition,
    });
    if (matches.length !== 1 || matches[0]?.id !== entityId) {
        throw new Error(
            `Expected exactly one operation named "${expectedName}" and for it to be #${entityId}.`,
        );
    }

    const currentValues = await activeAttributeValuesByDefinitionId(entityId);
    const nameValues = currentValues.get(nameDefinition.id) ?? [];
    if (nameValues.length !== 1 || nameValues[0]?.value !== expectedName) {
        throw new Error(
            `Operation #${entityId} failed its information.name identity guard.`,
        );
    }

    return {
        id: entity.id,
        state: entity.state,
    };
}

async function assertMaintenanceStage(
    stageNameDefinition: SelectAttributeDefinition,
) {
    const [stage] = await storage()
        .select({
            id: entities.id,
            entityTypeName: entities.entityTypeName,
            isDeleted: entities.isDeleted,
            state: entities.state,
        })
        .from(entities)
        .where(eq(entities.id, plantHealthMaintenanceStage.id))
        .limit(1);

    if (
        !stage ||
        stage.isDeleted ||
        stage.entityTypeName !== plantStageEntityTypeName ||
        stage.state !== 'published'
    ) {
        throw new Error(
            `Expected published maintenance plant stage #${plantHealthMaintenanceStage.id}.`,
        );
    }

    const stageNameValues = await storage()
        .select({
            id: attributeValues.id,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.entityId, plantHealthMaintenanceStage.id),
                eq(attributeValues.isDeleted, false),
                eq(
                    attributeValues.attributeDefinitionId,
                    stageNameDefinition.id,
                ),
            ),
        )
        .limit(2);

    if (
        stageNameValues.length !== 1 ||
        stageNameValues[0]?.value !== plantHealthMaintenanceStage.name
    ) {
        throw new Error(
            `Plant stage #${plantHealthMaintenanceStage.id} failed its information.name identity guard.`,
        );
    }
}

async function buildNewOperationPlans({
    definitions,
    nameDefinition,
}: {
    definitions: Map<string, SelectAttributeDefinition>;
    nameDefinition: SelectAttributeDefinition;
}): Promise<NewOperationPlan[]> {
    const plans: NewOperationPlan[] = [];

    for (const spec of plantHealthOperationSpecs) {
        const values = valuesForOperationSpec(spec);
        const entity = await findOperationByExactName({
            name: spec.name,
            nameDefinition,
        });
        const currentValues = entity
            ? await activeAttributeValuesByDefinitionId(entity.id)
            : new Map<number, ExistingAttributeValue[]>();

        plans.push({
            name: spec.name,
            entity,
            create: entity === null,
            attributeUpdates: planAttributeUpdates({
                currentValues,
                definitions,
                entityName: spec.name,
                desiredValues: values,
            }),
            publish: entity?.state !== 'published',
        });
    }

    return plans;
}

async function buildGuardedOperationPlans({
    definitions,
    nameDefinition,
}: {
    definitions: Map<string, SelectAttributeDefinition>;
    nameDefinition: SelectAttributeDefinition;
}): Promise<GuardedOperationPlan[]> {
    const desiredValuesByEntityId = new Map<
        number,
        {
            name: string;
            values: Record<string, string | null>;
        }
    >();

    for (const update of plantHealthOperationCopyUpdates) {
        desiredValuesByEntityId.set(update.entityId, {
            name: update.name,
            values: {
                'information.description': update.description,
                'information.instructions': update.instructions,
            },
        });
    }

    for (const update of plantHealthOperationApplicabilityUpdates) {
        const existing = desiredValuesByEntityId.get(update.entityId);
        if (existing && existing.name !== update.name) {
            throw new Error(
                `Conflicting operation identity for #${update.entityId}.`,
            );
        }
        desiredValuesByEntityId.set(update.entityId, {
            name: update.name,
            values: {
                ...existing?.values,
                'attributes.appliesToAllTargets': 'true',
            },
        });
    }

    const plans: GuardedOperationPlan[] = [];
    for (const [entityId, desired] of desiredValuesByEntityId) {
        const entity = await requireGuardedOperation({
            entityId,
            expectedName: desired.name,
            nameDefinition,
        });
        const currentValues =
            await activeAttributeValuesByDefinitionId(entityId);
        const applicabilityUpdate =
            plantHealthOperationApplicabilityUpdates.find(
                (update) => update.entityId === entityId,
            );
        if (applicabilityUpdate) {
            const applicationDefinition = definitions.get(
                'attributes.application',
            );
            if (!applicationDefinition) {
                throw new Error(
                    'Missing operation attributes.application definition.',
                );
            }
            const applicationValues =
                currentValues.get(applicationDefinition.id) ?? [];
            if (
                applicationValues.length !== 1 ||
                applicationValues[0]?.value !== 'plant'
            ) {
                throw new Error(
                    `Refusing to globalize #${entityId} "${desired.name}" because its application is not exactly "plant".`,
                );
            }
        }
        plans.push({
            name: desired.name,
            entity,
            attributeUpdates: planAttributeUpdates({
                currentValues,
                definitions,
                entityName: desired.name,
                desiredValues: desired.values,
            }),
        });
    }

    return plans;
}

async function applyAttributeUpdates({
    attributeUpdates,
    entityId,
}: {
    attributeUpdates: PlannedAttributeUpdate[];
    entityId: number;
}) {
    const currentValues = await activeAttributeValuesByDefinitionId(entityId);
    for (const update of attributeUpdates) {
        const matchingValues = currentValues.get(update.definition.id) ?? [];
        if (matchingValues.length > 1) {
            throw new Error(
                `Refusing to update #${entityId}: ${update.path} is no longer single-valued.`,
            );
        }

        const currentValue = matchingValues[0];
        const planStillMatches =
            update.existingValueId === undefined
                ? currentValue === undefined
                : currentValue?.id === update.existingValueId &&
                  currentValue.value === update.previousValue;
        if (!planStillMatches) {
            throw new Error(
                `Refusing to update #${entityId}: ${update.path} changed after preflight.`,
            );
        }
    }

    for (const update of attributeUpdates) {
        if (update.nextValue === null) {
            if (update.existingValueId !== undefined) {
                await deleteAttributeValue(update.existingValueId, actor);
            }
            continue;
        }

        await upsertAttributeValue(
            {
                id: update.existingValueId,
                attributeDefinitionId: update.definition.id,
                entityId,
                entityTypeName: operationEntityTypeName,
                order: update.definition.order,
                value: update.nextValue,
            },
            actor,
        );
    }
}

function summarizeAttributeUpdates(updates: PlannedAttributeUpdate[]) {
    return updates.map((update) => ({
        path: update.path,
        previousValue: update.previousValue,
        nextValue: update.nextValue,
    }));
}

async function main() {
    const args = process.argv.slice(2);
    const unknownArgs = args.filter((arg) => arg !== '--apply');
    if (unknownArgs.length > 0) {
        throw new Error(
            `Unknown arguments: ${unknownArgs.join(', ')}. Use --apply to write changes.`,
        );
    }
    const apply = args.includes('--apply');

    const [operationDefinitions, stageDefinitions] = await Promise.all([
        getAttributeDefinitions(operationEntityTypeName),
        getAttributeDefinitions(plantStageEntityTypeName),
    ]);
    const operationDefinitionsByPath = definitionsByPath(operationDefinitions);
    const stageDefinitionsByPath = definitionsByPath(stageDefinitions);

    const specValues = plantHealthOperationSpecs.map(valuesForOperationSpec);
    const requiredPaths = new Set([
        ...specValues.flatMap((values) => Object.keys(values)),
        'information.description',
        'information.instructions',
        'attributes.appliesToAllTargets',
    ]);
    requireDefinitions(operationDefinitionsByPath, requiredPaths);

    const nameDefinition = operationDefinitionsByPath.get('information.name');
    if (!nameDefinition) {
        throw new Error(
            'Missing operation information.name attribute definition.',
        );
    }
    const stageNameDefinition = stageDefinitionsByPath.get('information.name');
    if (!stageNameDefinition) {
        throw new Error(
            'Missing plantStage information.name attribute definition.',
        );
    }

    await assertMaintenanceStage(stageNameDefinition);

    // Complete every identity and definition guard before the first write.
    const [newOperationPlans, guardedOperationPlans] = await Promise.all([
        buildNewOperationPlans({
            definitions: operationDefinitionsByPath,
            nameDefinition,
        }),
        buildGuardedOperationPlans({
            definitions: operationDefinitionsByPath,
            nameDefinition,
        }),
    ]);

    if (apply) {
        for (const plan of newOperationPlans) {
            const currentIdentity = await findOperationByExactName({
                name: plan.name,
                nameDefinition,
            });
            if (plan.entity && currentIdentity?.id !== plan.entity.id) {
                throw new Error(
                    `Operation "${plan.name}" changed identity after preflight.`,
                );
            }
            if (!plan.entity && currentIdentity) {
                throw new Error(
                    `Operation "${plan.name}" was created after preflight; rerun the backfill.`,
                );
            }

            const entityId =
                currentIdentity?.id ??
                (await createEntity(operationEntityTypeName, actor));
            await applyAttributeUpdates({
                entityId,
                attributeUpdates: plan.attributeUpdates,
            });
            if (currentIdentity?.state !== 'published') {
                await updateEntity(
                    {
                        id: entityId,
                        state: 'published',
                    },
                    actor,
                );
            }
            plan.entity = {
                id: entityId,
                state: 'published',
            };
        }

        for (const plan of guardedOperationPlans) {
            await requireGuardedOperation({
                entityId: plan.entity.id,
                expectedName: plan.name,
                nameDefinition,
            });
            await applyAttributeUpdates({
                entityId: plan.entity.id,
                attributeUpdates: plan.attributeUpdates,
            });
        }
    }

    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                newOperations: newOperationPlans.map((plan) => ({
                    name: plan.name,
                    entityId: plan.entity?.id ?? null,
                    create: plan.create,
                    publish: plan.publish,
                    attributeUpdates: summarizeAttributeUpdates(
                        plan.attributeUpdates,
                    ),
                })),
                guardedUpdates: guardedOperationPlans.map((plan) => ({
                    name: plan.name,
                    entityId: plan.entity.id,
                    attributeUpdates: summarizeAttributeUpdates(
                        plan.attributeUpdates,
                    ),
                })),
            },
            null,
            2,
        ),
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeStorage();
    });
