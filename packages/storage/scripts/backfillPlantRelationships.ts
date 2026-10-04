import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { slugify } from '@gredice/js/slug';
import { and, eq, inArray } from 'drizzle-orm';
import {
    type CompanionPlantRelationshipEntry,
    companionPlantRelationshipCaveatSources,
    companionPlantRelationshipDataset,
    companionPlantRelationshipSources,
} from '../src/data/companionPlantRelationships';
import {
    attributeDefinitionCategories,
    attributeDefinitions,
    attributeValues,
    closeStorage,
    createAttributeDefinition,
    createAttributeDefinitionCategory,
    getAttributeDefinitions,
    getEntitiesRaw,
    plantRelationshipAttributeNames,
    plantRelationshipCategory,
    type SelectAttributeDefinition,
    storage,
    upsertAttributeValue,
} from '../src/index';

type RelationshipKind = keyof typeof plantRelationshipAttributeNames;

type RelationshipPair = {
    kind: RelationshipKind;
    sourceName: string;
    targetName: string;
    sourceId: number;
    targetId: number;
    authorId: number;
    valueId: number;
    sources: string[];
    notes: string[];
};

type ExistingRelationship = {
    kind: RelationshipKind;
    sourceId: number;
    targetId: number;
    attributeValueId: number;
};

const apply = process.argv.includes('--apply');
const reportPath = resolve(
    process.cwd(),
    '..',
    '..',
    'docs',
    'companion-plant-relationship-coverage.md',
);

const relationshipDefinitions = {
    companions: {
        name: plantRelationshipAttributeNames.companions,
        label: 'Dobre susjedne biljke',
        description:
            'Biljke koje se preporučuju kao dobri susjedi u gredici. Veza se prikazuje obostrano, pa ju treba unijeti samo na jednoj biljci.',
        order: 'za',
    },
    antagonists: {
        name: plantRelationshipAttributeNames.antagonists,
        label: 'Loši susjedi',
        description:
            'Biljke koje se ne preporučuju saditi u neposrednoj blizini. Veza se prikazuje obostrano, pa ju treba unijeti samo na jednoj biljci.',
        order: 'zb',
    },
} as const satisfies Record<
    RelationshipKind,
    {
        name: string;
        label: string;
        description: string;
        order: string;
    }
>;

function normalizedPlantName(value: string) {
    return slugify(value.trim());
}

function pairKey(leftId: number, rightId: number) {
    return [leftId, rightId].sort((left, right) => left - right).join(':');
}

function relationshipKey(
    kind: RelationshipKind,
    leftId: number,
    rightId: number,
) {
    return `${kind}:${pairKey(leftId, rightId)}`;
}

function sourceLabels(sourceKeys: string[]) {
    return sourceKeys
        .map((sourceKey) => {
            const source =
                companionPlantRelationshipSources[
                    sourceKey as keyof typeof companionPlantRelationshipSources
                ];
            return source?.label ?? sourceKey;
        })
        .sort((left, right) => left.localeCompare(right, 'en'));
}

async function ensureRelationshipCategory() {
    const existingCategories =
        await storage().query.attributeDefinitionCategories.findMany({
            where: and(
                eq(attributeDefinitionCategories.entityTypeName, 'plant'),
                eq(
                    attributeDefinitionCategories.name,
                    plantRelationshipCategory,
                ),
            ),
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
                .update(attributeDefinitionCategories)
                .set({
                    label: 'Dobri i loši susjedi',
                    order: 'z',
                    isDeleted: false,
                })
                .where(
                    eq(attributeDefinitionCategories.id, deletedCategory.id),
                );
        }
        return deletedCategory.id;
    }

    if (apply) {
        await createAttributeDefinitionCategory({
            name: plantRelationshipCategory,
            label: 'Dobri i loši susjedi',
            entityTypeName: 'plant',
            order: 'z',
        });
        const created =
            await storage().query.attributeDefinitionCategories.findFirst({
                where: and(
                    eq(attributeDefinitionCategories.entityTypeName, 'plant'),
                    eq(
                        attributeDefinitionCategories.name,
                        plantRelationshipCategory,
                    ),
                    eq(attributeDefinitionCategories.isDeleted, false),
                ),
            });
        if (created) {
            return created.id;
        }
    }

    return null;
}

async function ensureRelationshipDefinitions() {
    await ensureRelationshipCategory();

    const definitionsByKind = new Map<
        RelationshipKind,
        SelectAttributeDefinition
    >();
    const existingDefinitions = await getAttributeDefinitions('plant');

    for (const kind of Object.keys(
        relationshipDefinitions,
    ) as RelationshipKind[]) {
        const config = relationshipDefinitions[kind];
        const existing = existingDefinitions.find(
            (definition) =>
                definition.category === plantRelationshipCategory &&
                definition.name === config.name,
        );

        if (existing) {
            if (apply) {
                await storage()
                    .update(attributeDefinitions)
                    .set({
                        category: plantRelationshipCategory,
                        name: config.name,
                        label: config.label,
                        description: config.description,
                        entityTypeName: 'plant',
                        dataType: 'ref:plant',
                        multiple: true,
                        required: false,
                        display: false,
                        order: config.order,
                        isDeleted: false,
                    })
                    .where(eq(attributeDefinitions.id, existing.id));
            }
            definitionsByKind.set(kind, existing);
            continue;
        }

        if (apply) {
            const id = await createAttributeDefinition({
                category: plantRelationshipCategory,
                name: config.name,
                label: config.label,
                description: config.description,
                entityTypeName: 'plant',
                dataType: 'ref:plant',
                multiple: true,
                required: false,
                display: false,
                order: config.order,
            });
            const created =
                await storage().query.attributeDefinitions.findFirst({
                    where: eq(attributeDefinitions.id, id),
                });
            if (created) {
                definitionsByKind.set(kind, created);
            }
        }
    }

    return definitionsByKind;
}

function relationshipPairsForEntry(
    entry: CompanionPlantRelationshipEntry,
    plantIdsByName: Map<string, number>,
) {
    const sourceId = plantIdsByName.get(normalizedPlantName(entry.plant));
    if (!sourceId) {
        return {
            pairs: [] as RelationshipPair[],
            missingNames: [entry.plant],
        };
    }

    const pairs: RelationshipPair[] = [];
    const missingNames: string[] = [];
    const addPairs = (kind: RelationshipKind, targetNames: string[] = []) => {
        for (const targetName of targetNames) {
            const targetId = plantIdsByName.get(
                normalizedPlantName(targetName),
            );
            if (!targetId) {
                missingNames.push(targetName);
                continue;
            }
            if (targetId === sourceId) {
                continue;
            }

            const [authorId, valueId] =
                sourceId < targetId
                    ? [sourceId, targetId]
                    : [targetId, sourceId];
            pairs.push({
                kind,
                sourceName: entry.plant,
                targetName,
                sourceId,
                targetId,
                authorId,
                valueId,
                sources: entry.sources,
                notes: entry.notes ?? [],
            });
        }
    };

    addPairs('companions', entry.companions);
    addPairs('antagonists', entry.antagonists);

    return {
        pairs,
        missingNames,
    };
}

async function existingRelationshipsByPair(
    definitionIdsByKind: Map<RelationshipKind, number>,
) {
    if (definitionIdsByKind.size === 0) {
        return new Map<string, ExistingRelationship[]>();
    }

    const definitionIds = Array.from(definitionIdsByKind.values());
    const kindByDefinitionId = new Map(
        Array.from(definitionIdsByKind.entries()).map(
            ([kind, definitionId]) => [definitionId, kind],
        ),
    );
    const values = await storage().query.attributeValues.findMany({
        where: and(
            inArray(attributeValues.attributeDefinitionId, definitionIds),
            eq(attributeValues.isDeleted, false),
        ),
    });
    const relationshipsByKey = new Map<string, ExistingRelationship[]>();

    for (const value of values) {
        if (!value.value) {
            continue;
        }

        const targetId = Number.parseInt(value.value, 10);
        const kind = kindByDefinitionId.get(value.attributeDefinitionId);
        if (!kind || !Number.isSafeInteger(targetId) || targetId <= 0) {
            continue;
        }

        const key = relationshipKey(kind, value.entityId, targetId);
        relationshipsByKey.set(key, [
            ...(relationshipsByKey.get(key) ?? []),
            {
                kind,
                sourceId: value.entityId,
                targetId,
                attributeValueId: value.id,
            },
        ]);
    }

    return relationshipsByKey;
}

function uniquePairs(pairs: RelationshipPair[]) {
    const pairsByKey = new Map<string, RelationshipPair>();
    for (const pair of pairs) {
        const key = relationshipKey(pair.kind, pair.sourceId, pair.targetId);
        const existing = pairsByKey.get(key);
        if (!existing) {
            pairsByKey.set(key, pair);
            continue;
        }

        pairsByKey.set(key, {
            ...existing,
            sources: Array.from(
                new Set([...existing.sources, ...pair.sources]),
            ),
            notes: Array.from(new Set([...existing.notes, ...pair.notes])),
        });
    }

    return Array.from(pairsByKey.values());
}

function findDatasetConflicts(pairs: RelationshipPair[]) {
    const companionPairs = new Map(
        pairs
            .filter((pair) => pair.kind === 'companions')
            .map((pair) => [pairKey(pair.sourceId, pair.targetId), pair]),
    );
    return pairs.filter(
        (pair) =>
            pair.kind === 'antagonists' &&
            companionPairs.has(pairKey(pair.sourceId, pair.targetId)),
    );
}

function plantNameById(plants: Awaited<ReturnType<typeof getEntitiesRaw>>) {
    return new Map(
        plants.map((plant) => [
            plant.id,
            plant.attributes
                .find(
                    (attribute) =>
                        attribute.attributeDefinition.category ===
                            'information' &&
                        attribute.attributeDefinition.name === 'name',
                )
                ?.value?.trim() ?? `Biljka ${plant.id}`,
        ]),
    );
}

async function writeCoverageReport({
    created,
    skippedExisting,
    missingNames,
    plants,
    pairs,
}: {
    created: RelationshipPair[];
    skippedExisting: RelationshipPair[];
    missingNames: string[];
    plants: Awaited<ReturnType<typeof getEntitiesRaw>>;
    pairs: RelationshipPair[];
}) {
    const nameById = plantNameById(plants);
    const coveredCompanions = new Set<number>();
    const coveredAntagonists = new Set<number>();
    for (const pair of pairs) {
        coveredCompanions.add(pair.sourceId);
        coveredCompanions.add(pair.targetId);
        if (pair.kind === 'antagonists') {
            coveredAntagonists.add(pair.sourceId);
            coveredAntagonists.add(pair.targetId);
        }
    }

    const publishedPlantIds = plants
        .filter((plant) => plant.state === 'published' && !plant.isDeleted)
        .map((plant) => plant.id)
        .sort((left, right) =>
            (nameById.get(left) ?? '').localeCompare(
                nameById.get(right) ?? '',
                'hr',
            ),
        );
    const plantsWithoutVerifiedRelationships = publishedPlantIds.filter(
        (plantId) =>
            !coveredCompanions.has(plantId) && !coveredAntagonists.has(plantId),
    );

    const lines = [
        '# Companion Plant Relationship Coverage',
        '',
        `Generated: ${new Date().toISOString()}`,
        `Mode: ${apply ? 'apply' : 'dry-run'}`,
        '',
        '## Source Notes',
        '',
        'This first-release dataset only imports relationships that map cleanly to current published Gredice plant entities. Broad, ambiguous, and conflicting chart recommendations are intentionally skipped for review.',
        '',
        ...Object.entries(companionPlantRelationshipSources).map(
            ([key, source]) => `- ${key}: [${source.label}](${source.url})`,
        ),
        '',
        'Caveat sources:',
        '',
        ...companionPlantRelationshipCaveatSources.map((sourceKey) => {
            const source = companionPlantRelationshipSources[sourceKey];
            return `- [${source.label}](${source.url})`;
        }),
        '',
        '## Import Summary',
        '',
        `- Relationship pairs in reviewed dataset: ${pairs.length}`,
        `- Created relationships this run: ${created.length}`,
        `- Existing relationships skipped: ${skippedExisting.length}`,
        `- Missing referenced plant names: ${Array.from(new Set(missingNames)).length}`,
        `- Published plants with companion coverage: ${coveredCompanions.size}`,
        `- Published plants with antagonist coverage: ${coveredAntagonists.size}`,
        `- Published plants intentionally left without verified relationships: ${plantsWithoutVerifiedRelationships.length}`,
        '',
        '## Plants Without Verified Relationships',
        '',
        ...(plantsWithoutVerifiedRelationships.length > 0
            ? plantsWithoutVerifiedRelationships.map(
                  (plantId) => `- ${nameById.get(plantId)} (#${plantId})`,
              )
            : ['- None']),
        '',
        '## Created This Run',
        '',
        ...(created.length > 0
            ? created.map(
                  (pair) =>
                      `- ${pair.kind}: ${nameById.get(pair.authorId)} (#${pair.authorId}) -> ${nameById.get(pair.valueId)} (#${pair.valueId})`,
              )
            : ['- None']),
        '',
        '## Existing Relationships Skipped',
        '',
        ...(skippedExisting.length > 0
            ? skippedExisting.map(
                  (pair) =>
                      `- ${pair.kind}: ${nameById.get(pair.authorId)} (#${pair.authorId}) -> ${nameById.get(pair.valueId)} (#${pair.valueId})`,
              )
            : ['- None']),
        '',
        '## Dataset Pairs',
        '',
        ...pairs
            .sort((left, right) =>
                `${left.kind}:${nameById.get(left.authorId)}:${nameById.get(left.valueId)}`.localeCompare(
                    `${right.kind}:${nameById.get(right.authorId)}:${nameById.get(right.valueId)}`,
                    'hr',
                ),
            )
            .map((pair) => {
                const notes = pair.notes.length
                    ? ` Notes: ${pair.notes.join(' ')}`
                    : '';
                return `- ${pair.kind}: ${nameById.get(pair.authorId)} (#${pair.authorId}) -> ${nameById.get(pair.valueId)} (#${pair.valueId}). Sources: ${sourceLabels(pair.sources).join('; ')}.${notes}`;
            }),
        '',
    ];

    await writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
    const definitions = await ensureRelationshipDefinitions();
    const plants = await getEntitiesRaw('plant');
    const plantIdsByName = new Map<string, number>();
    for (const plant of plants) {
        const name = plant.attributes.find(
            (attribute) =>
                attribute.attributeDefinition.category === 'information' &&
                attribute.attributeDefinition.name === 'name',
        )?.value;
        if (name && plant.state === 'published' && !plant.isDeleted) {
            plantIdsByName.set(normalizedPlantName(name), plant.id);
        }
    }

    const relationshipPairs = [];
    const missingNames = [];
    for (const entry of companionPlantRelationshipDataset) {
        const result = relationshipPairsForEntry(entry, plantIdsByName);
        relationshipPairs.push(...result.pairs);
        missingNames.push(...result.missingNames);
    }

    const pairs = uniquePairs(relationshipPairs);
    const datasetConflicts = findDatasetConflicts(pairs);
    if (datasetConflicts.length > 0) {
        throw new Error(
            `Dataset contains ${datasetConflicts.length} companion/antagonist conflicts.`,
        );
    }

    const definitionIdsByKind = new Map(
        Array.from(definitions.entries()).map(([kind, definition]) => [
            kind,
            definition.id,
        ]),
    );
    const existingByPair =
        await existingRelationshipsByPair(definitionIdsByKind);
    const created: RelationshipPair[] = [];
    const skippedExisting: RelationshipPair[] = [];
    const oppositeKindConflicts: RelationshipPair[] = [];

    for (const pair of pairs) {
        const sameKey = relationshipKey(
            pair.kind,
            pair.sourceId,
            pair.targetId,
        );
        const oppositeKind =
            pair.kind === 'companions' ? 'antagonists' : 'companions';
        const oppositeKey = relationshipKey(
            oppositeKind,
            pair.sourceId,
            pair.targetId,
        );
        if ((existingByPair.get(oppositeKey)?.length ?? 0) > 0) {
            oppositeKindConflicts.push(pair);
            continue;
        }
        if ((existingByPair.get(sameKey)?.length ?? 0) > 0) {
            skippedExisting.push(pair);
            continue;
        }

        const definitionId = definitionIdsByKind.get(pair.kind);
        if (!definitionId) {
            if (!apply) {
                created.push(pair);
            }
            continue;
        }

        if (apply) {
            await upsertAttributeValue({
                attributeDefinitionId: definitionId,
                entityTypeName: 'plant',
                entityId: pair.authorId,
                value: String(pair.valueId),
            });
        }
        created.push(pair);
    }

    if (oppositeKindConflicts.length > 0) {
        throw new Error(
            `Existing DB contains ${oppositeKindConflicts.length} opposite-kind relationship conflicts. No conflicting rows were written.`,
        );
    }

    await writeCoverageReport({
        created,
        skippedExisting,
        missingNames,
        plants,
        pairs,
    });

    console.log(
        JSON.stringify(
            {
                mode: apply ? 'apply' : 'dry-run',
                pairs: pairs.length,
                created: created.length,
                skippedExisting: skippedExisting.length,
                missingNames: Array.from(new Set(missingNames)).sort(),
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
