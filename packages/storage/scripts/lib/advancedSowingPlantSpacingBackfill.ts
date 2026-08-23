import 'server-only';
import {
    applyAdvancedSowingAttributeValueBatch,
    getAttributeDefinitions,
    getEntitiesRaw,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
} from '../../src';
import {
    type AdvancedSowingPlantSpacingEntry,
    advancedSowingPlantSpacing,
    advancedSowingPlantSpacingByNormalizedName,
    normalizeAdvancedSowingPlantName,
} from './advancedSowingPlantSpacingPolicy';

const actor = {
    id: 'advanced-sowing-spacing-backfill',
    name: 'Advanced Sowing spacing backfill',
};

const spacingAttributeNames = [
    'seedingDistance',
    'seedingDistanceMin',
    'seedingDistanceMax',
] as const;

type SpacingAttributeName = (typeof spacingAttributeNames)[number];

type PlantAttribute = SelectAttributeValue & {
    attributeDefinition: SelectAttributeDefinition;
};

type PlantCandidate = {
    attributes: PlantAttribute[];
    entityId: number;
    name: string;
    policy: AdvancedSowingPlantSpacingEntry;
};

type PlannedValue = {
    action: 'create' | 'unchanged' | 'update';
    attributeName: SpacingAttributeName;
    definition: SelectAttributeDefinition;
    existingValue: SelectAttributeValue | null;
    nextValue: string;
};

export function parseAdvancedSowingPlantSpacingBackfillArgs(argv: string[]) {
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

function requireSpacingDefinitions(definitions: SelectAttributeDefinition[]) {
    return Object.fromEntries(
        spacingAttributeNames.map((name) => {
            const path = `attributes.${name}`;
            const matches = definitions.filter(
                (definition) => attributePath(definition) === path,
            );
            if (matches.length !== 1 || !matches[0]) {
                throw new Error(
                    `Expected exactly one active plant ${path} definition, found ${matches.length.toString()}. Run plants:advanced-sowing-attributes --apply first.`,
                );
            }
            return [name, matches[0]];
        }),
    ) as Record<SpacingAttributeName, SelectAttributeDefinition>;
}

function singleAttribute(
    attributes: PlantAttribute[],
    definition: SelectAttributeDefinition,
    plantName: string,
) {
    const matches = attributes.filter(
        (attribute) => attribute.attributeDefinitionId === definition.id,
    );
    if (matches.length > 1) {
        throw new Error(
            `Expected at most one active ${attributePath(definition)} value for ${plantName}, found ${matches.length.toString()}.`,
        );
    }
    return matches[0] ?? null;
}

function requirePlantName(
    attributes: PlantAttribute[],
    nameDefinition: SelectAttributeDefinition,
    entityId: number,
) {
    const value = singleAttribute(
        attributes,
        nameDefinition,
        `plant #${entityId.toString()}`,
    )?.value?.trim();
    if (!value) {
        throw new Error(
            `Expected one non-empty information.name value for plant #${entityId.toString()}.`,
        );
    }
    return value;
}

function policyValue(
    policy: AdvancedSowingPlantSpacingEntry,
    attributeName: SpacingAttributeName,
) {
    if (attributeName === 'seedingDistance') {
        return policy.optimalDistanceCm;
    }
    if (attributeName === 'seedingDistanceMin') {
        return policy.minDistanceCm;
    }
    return policy.maxDistanceCm;
}

function planCandidate(
    candidate: PlantCandidate,
    definitions: Record<SpacingAttributeName, SelectAttributeDefinition>,
) {
    return spacingAttributeNames.map((attributeName): PlannedValue => {
        const definition = definitions[attributeName];
        const existingValue = singleAttribute(
            candidate.attributes,
            definition,
            candidate.name,
        );
        const nextValue = policyValue(
            candidate.policy,
            attributeName,
        ).toString();
        return {
            action:
                existingValue?.value === nextValue
                    ? 'unchanged'
                    : existingValue
                      ? 'update'
                      : 'create',
            attributeName,
            definition,
            existingValue,
            nextValue,
        };
    });
}

export async function backfillAdvancedSowingPlantSpacing({
    apply = false,
    matrix = advancedSowingPlantSpacing,
}: {
    apply?: boolean;
    matrix?: readonly AdvancedSowingPlantSpacingEntry[];
} = {}) {
    const policyByName = advancedSowingPlantSpacingByNormalizedName(matrix);
    const definitions = await getAttributeDefinitions('plant');
    const nameDefinition = definitions.find(
        (definition) => attributePath(definition) === 'information.name',
    );
    if (!nameDefinition) {
        throw new Error('Missing active plant information.name definition.');
    }
    const spacingDefinitions = requireSpacingDefinitions(definitions);
    const plants = await getEntitiesRaw('plant', 'published');
    if (plants.length === 0) {
        throw new Error('No published plants found.');
    }

    const seenNames = new Set<string>();
    const candidates: PlantCandidate[] = plants
        .map((plant) => {
            const attributes = plant.attributes as PlantAttribute[];
            const name = requirePlantName(attributes, nameDefinition, plant.id);
            const normalizedName = normalizeAdvancedSowingPlantName(name);
            const policy = policyByName.get(normalizedName);
            if (!policy) {
                throw new Error(
                    `Missing Advanced Sowing spacing for ${name} (#${plant.id.toString()}).`,
                );
            }
            if (seenNames.has(normalizedName)) {
                throw new Error(
                    `Published catalogue contains duplicate normalized plant name ${normalizedName}.`,
                );
            }
            seenNames.add(normalizedName);
            return {
                attributes,
                entityId: plant.id,
                name,
                policy,
            };
        })
        .sort((left, right) => left.entityId - right.entityId);

    const catalogueEntriesWithoutPlant = Array.from(policyByName.entries())
        .filter(([normalizedName]) => !seenNames.has(normalizedName))
        .map(([, entry]) => entry.name);
    if (catalogueEntriesWithoutPlant.length > 0) {
        throw new Error(
            `Advanced Sowing spacing contains entries without a published plant: ${catalogueEntriesWithoutPlant.join(', ')}.`,
        );
    }

    const planned = candidates.map((candidate) => ({
        candidate,
        values: planCandidate(candidate, spacingDefinitions),
    }));
    const mutations = planned.flatMap(({ candidate, values }) =>
        values.flatMap((value) =>
            value.action === 'unchanged'
                ? []
                : [
                      {
                          action: 'upsert' as const,
                          attributeValue: {
                              id: value.existingValue?.id,
                              attributeDefinitionId: value.definition.id,
                              entityId: candidate.entityId,
                              entityTypeName: 'plant',
                              order: value.definition.order,
                              value: value.nextValue,
                          },
                          expectedCurrent: value.existingValue
                              ? ({
                                    state: 'present' as const,
                                    attributeValueId: value.existingValue.id,
                                    value: value.existingValue.value,
                                } as const)
                              : ({ state: 'absent' as const } as const),
                      },
                  ],
        ),
    );

    if (apply && mutations.length > 0) {
        await applyAdvancedSowingAttributeValueBatch(mutations, actor);
    }

    if (apply) {
        const readback = await getEntitiesRaw('plant', 'published');
        const readbackById = new Map(
            readback.map((plant) => [plant.id, plant]),
        );
        for (const { candidate, values } of planned) {
            const persisted = readbackById.get(candidate.entityId);
            if (!persisted) {
                throw new Error(
                    `Plant #${candidate.entityId.toString()} disappeared during Advanced Sowing readback.`,
                );
            }
            const attributes = persisted.attributes as PlantAttribute[];
            for (const value of values) {
                const actual = singleAttribute(
                    attributes,
                    value.definition,
                    candidate.name,
                )?.value;
                if (actual !== value.nextValue) {
                    throw new Error(
                        `Failed to verify ${value.attributeName}=${value.nextValue} for ${candidate.name} (#${candidate.entityId.toString()}); found ${String(actual)}.`,
                    );
                }
            }
        }
    }

    const allValues = planned.flatMap((plant) => plant.values);
    return {
        mode: apply ? 'apply' : 'dry-run',
        publishedPlantCount: candidates.length,
        policyEntryCount: matrix.length,
        totals: {
            create: allValues.filter((value) => value.action === 'create')
                .length,
            update: allValues.filter((value) => value.action === 'update')
                .length,
            unchanged: allValues.filter((value) => value.action === 'unchanged')
                .length,
        },
        plants: planned.map(({ candidate, values }) => ({
            entityId: candidate.entityId,
            name: candidate.name,
            minDistanceCm: candidate.policy.minDistanceCm,
            optimalDistanceCm: candidate.policy.optimalDistanceCm,
            maxDistanceCm: candidate.policy.maxDistanceCm,
            actions: Object.fromEntries(
                values.map((value) => [value.attributeName, value.action]),
            ),
        })),
        verified: apply,
    };
}
