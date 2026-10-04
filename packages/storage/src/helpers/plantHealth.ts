import { slugify } from '@gredice/js/slug';
import type {
    SelectAttributeDefinition,
    SelectAttributeValue,
    SelectEntity,
    SelectEntityType,
} from '../schema';

export const plantHealthIssueTypeNames = {
    disease: 'plantDisease',
    pest: 'plantPest',
} as const;

export type PlantHealthIssueKind = keyof typeof plantHealthIssueTypeNames;
export type PlantHealthIssueEntityTypeName =
    (typeof plantHealthIssueTypeNames)[PlantHealthIssueKind];

export const plantHealthRelationshipCategory = 'relationships';
export const plantHealthAffectedPlantsAttributeName = 'affectedPlants';
export const plantHealthOperationCategory = 'operations';
export const plantHealthOperationAttributeNames = {
    prevention: 'prevention',
    reduction: 'reduction',
    alleviation: 'alleviation',
} as const;

export type PlantHealthOperationIntent =
    keyof typeof plantHealthOperationAttributeNames;

export type PlantHealthOperationSummary = {
    id: number;
    slug: string;
    name: string;
    label?: string;
};

export type PlantHealthIssueSummary = {
    id: number;
    slug: string;
    name: string;
    kind: PlantHealthIssueKind;
    shortDescription?: string;
    symptoms?: string;
    conditions?: string;
    image?: {
        cover?: {
            url: string;
        };
    };
    operations?: Partial<
        Record<PlantHealthOperationIntent, PlantHealthOperationSummary[]>
    >;
};

export type PlantHealthReadModel = Partial<
    Record<'diseases' | 'pests', PlantHealthIssueSummary[]>
>;

type FormattedEntitySummary = {
    id: number;
    slug: string;
    name: string;
    label?: string;
    latinName?: string;
    image?: {
        cover: {
            url: string;
        };
    };
};

type PlantHealthAttributeDefinition = Pick<
    SelectAttributeDefinition,
    'category' | 'dataType' | 'entityTypeName' | 'name'
>;

type PlantHealthAttribute = Pick<
    SelectAttributeValue,
    'isDeleted' | 'value'
> & {
    attributeDefinition: PlantHealthAttributeDefinition;
};

export type PlantHealthEntity = Pick<
    SelectEntity,
    'id' | 'entityTypeName' | 'isDeleted' | 'state'
> & {
    attributes: PlantHealthAttribute[];
    entityType?: Pick<SelectEntityType, 'label' | 'name'>;
};

const plantHealthIssueTypeNameByKind = new Map<
    PlantHealthIssueEntityTypeName,
    PlantHealthIssueKind
>(
    Object.entries(plantHealthIssueTypeNames).map(([kind, typeName]) => [
        typeName,
        kind as PlantHealthIssueKind,
    ]),
);

const plantHealthOperationIntentByAttributeName = new Map<
    string,
    PlantHealthOperationIntent
>(
    Object.entries(plantHealthOperationAttributeNames).map(
        ([intent, attributeName]) => [
            attributeName,
            intent as PlantHealthOperationIntent,
        ],
    ),
);

export function plantHealthIssueKindForEntityTypeName(
    entityTypeName: string | null | undefined,
): PlantHealthIssueKind | null {
    if (!entityTypeName) {
        return null;
    }

    return (
        plantHealthIssueTypeNameByKind.get(
            entityTypeName as PlantHealthIssueEntityTypeName,
        ) ?? null
    );
}

export function isPlantHealthIssueEntityTypeName(
    entityTypeName: string | null | undefined,
): entityTypeName is PlantHealthIssueEntityTypeName {
    return plantHealthIssueKindForEntityTypeName(entityTypeName) !== null;
}

export function isPlantHealthAffectedPlantAttributeDefinition(
    attributeDefinition: PlantHealthAttributeDefinition,
) {
    return (
        isPlantHealthIssueEntityTypeName(attributeDefinition.entityTypeName) &&
        attributeDefinition.category === plantHealthRelationshipCategory &&
        attributeDefinition.name === plantHealthAffectedPlantsAttributeName &&
        attributeDefinition.dataType === 'ref:plant'
    );
}

export function plantHealthOperationIntentForAttributeDefinition(
    attributeDefinition: PlantHealthAttributeDefinition,
): PlantHealthOperationIntent | null {
    if (
        !isPlantHealthIssueEntityTypeName(attributeDefinition.entityTypeName) ||
        attributeDefinition.category !== plantHealthOperationCategory ||
        attributeDefinition.dataType !== 'ref:operation'
    ) {
        return null;
    }

    return (
        plantHealthOperationIntentByAttributeName.get(
            attributeDefinition.name,
        ) ?? null
    );
}

export function isPlantHealthOperationAttributeDefinition(
    attributeDefinition: PlantHealthAttributeDefinition,
) {
    return plantHealthOperationIntentForAttributeDefinition(
        attributeDefinition,
    );
}

export function parsePlantHealthReferenceTargetId(
    value: string | null | undefined,
) {
    if (!value) {
        return null;
    }

    const trimmedValue = value.trim();
    if (!/^\d+$/.test(trimmedValue)) {
        return null;
    }

    const parsed = Number.parseInt(trimmedValue, 10);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function plantHealthAffectedPlantTargetIdForAttributeValue(
    attributeDefinition: PlantHealthAttributeDefinition,
    value: string | null | undefined,
) {
    if (!isPlantHealthAffectedPlantAttributeDefinition(attributeDefinition)) {
        return null;
    }

    return parsePlantHealthReferenceTargetId(value);
}

export function plantHealthAffectedPlantIdsForEntity(
    entity: PlantHealthEntity | null | undefined,
) {
    if (
        !entity ||
        !isPlantHealthIssueEntityTypeName(
            entity.entityType?.name ?? entity.entityTypeName,
        )
    ) {
        return [];
    }

    const affectedPlantIds = new Set<number>();
    for (const attribute of entity.attributes) {
        if (attribute.isDeleted) {
            continue;
        }

        const targetId = plantHealthAffectedPlantTargetIdForAttributeValue(
            attribute.attributeDefinition,
            attribute.value,
        );
        if (targetId) {
            affectedPlantIds.add(targetId);
        }
    }

    return Array.from(affectedPlantIds);
}

function textAttribute(
    entity: PlantHealthEntity,
    category: string,
    name: string,
) {
    return (
        entity.attributes
            .find(
                (attribute) =>
                    !attribute.isDeleted &&
                    attribute.attributeDefinition.category === category &&
                    attribute.attributeDefinition.name === name,
            )
            ?.value?.trim() ?? null
    );
}

function parseImageCover(value: string | null) {
    if (!value) {
        return undefined;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        if (
            parsed &&
            typeof parsed === 'object' &&
            'url' in parsed &&
            typeof parsed.url === 'string' &&
            parsed.url.length > 0
        ) {
            return { url: parsed.url };
        }
    } catch {
        return undefined;
    }

    return undefined;
}

function displayName(entity: PlantHealthEntity, fallback: string) {
    return (
        textAttribute(entity, 'information', 'label') ??
        textAttribute(entity, 'information', 'name') ??
        `${entity.entityType?.label ?? fallback} ${entity.id}`
    );
}

function operationSummary(
    entity: PlantHealthEntity,
): PlantHealthOperationSummary {
    const name = displayName(entity, 'Radnja');
    const label = textAttribute(entity, 'information', 'label') ?? undefined;

    return {
        id: entity.id,
        slug: slugify(name),
        name,
        ...(label && label !== name ? { label } : {}),
    };
}

function operationSummariesByIntent(
    issue: PlantHealthEntity,
    publishedOperationsById: Map<number, PlantHealthEntity>,
) {
    const summaries = new Map<
        PlantHealthOperationIntent,
        Map<number, PlantHealthOperationSummary>
    >();

    for (const attribute of issue.attributes) {
        if (attribute.isDeleted) {
            continue;
        }

        const intent = plantHealthOperationIntentForAttributeDefinition(
            attribute.attributeDefinition,
        );
        if (!intent) {
            continue;
        }

        const operationId = parsePlantHealthReferenceTargetId(attribute.value);
        if (!operationId) {
            continue;
        }

        const operation = publishedOperationsById.get(operationId);
        if (!operation) {
            continue;
        }

        const intentSummaries = summaries.get(intent) ?? new Map();
        intentSummaries.set(operation.id, operationSummary(operation));
        summaries.set(intent, intentSummaries);
    }

    const operations: Partial<
        Record<PlantHealthOperationIntent, PlantHealthOperationSummary[]>
    > = {};
    for (const [intent, operationMap] of summaries.entries()) {
        const entries = sortedByName(operationMap.values());
        if (entries.length > 0) {
            operations[intent] = entries;
        }
    }

    return Object.keys(operations).length > 0 ? operations : undefined;
}

function healthIssueSummary(
    issue: PlantHealthEntity,
    kind: PlantHealthIssueKind,
    publishedOperationsById: Map<number, PlantHealthEntity>,
): PlantHealthIssueSummary {
    const name = displayName(issue, kind === 'disease' ? 'Bolest' : 'Štetnik');
    const cover = parseImageCover(textAttribute(issue, 'image', 'cover'));
    const shortDescription =
        textAttribute(issue, 'information', 'shortDescription') ?? undefined;
    const symptoms =
        textAttribute(issue, 'symptoms', 'symptoms') ??
        textAttribute(issue, 'symptoms', 'signs') ??
        undefined;
    const conditions =
        textAttribute(issue, 'conditions', 'favorableConditions') ??
        textAttribute(issue, 'conditions', 'conditions') ??
        undefined;
    const operations = operationSummariesByIntent(
        issue,
        publishedOperationsById,
    );

    return {
        id: issue.id,
        slug: slugify(name),
        name,
        kind,
        ...(shortDescription ? { shortDescription } : {}),
        ...(symptoms ? { symptoms } : {}),
        ...(conditions ? { conditions } : {}),
        ...(cover ? { image: { cover } } : {}),
        ...(operations ? { operations } : {}),
    };
}

function sortedByName<T extends { name: string }>(entries: Iterable<T>) {
    return Array.from(entries).sort((left, right) =>
        left.name.localeCompare(right.name, 'hr'),
    );
}

function publishedEntitiesById(
    entities: PlantHealthEntity[],
    typeName: string,
) {
    return new Map(
        entities
            .filter(
                (entity) =>
                    !entity.isDeleted &&
                    entity.state === 'published' &&
                    (entity.entityType?.name ?? entity.entityTypeName) ===
                        typeName,
            )
            .map((entity) => [entity.id, entity]),
    );
}

export function buildPlantHealthReadModels({
    plants,
    diseases,
    pests,
    operations,
}: {
    plants: PlantHealthEntity[];
    diseases: PlantHealthEntity[];
    pests: PlantHealthEntity[];
    operations: PlantHealthEntity[];
}) {
    const publishedPlantsById = publishedEntitiesById(plants, 'plant');
    const publishedOperationsById = publishedEntitiesById(
        operations,
        'operation',
    );
    const healthByPlantId = new Map<
        number,
        {
            diseases: Map<number, PlantHealthIssueSummary>;
            pests: Map<number, PlantHealthIssueSummary>;
        }
    >();

    function ensurePlantHealth(plantId: number) {
        const existing = healthByPlantId.get(plantId);
        if (existing) {
            return existing;
        }

        const created = {
            diseases: new Map<number, PlantHealthIssueSummary>(),
            pests: new Map<number, PlantHealthIssueSummary>(),
        };
        healthByPlantId.set(plantId, created);
        return created;
    }

    function collectIssues(
        issues: PlantHealthEntity[],
        kind: PlantHealthIssueKind,
    ) {
        for (const issue of issues) {
            if (
                issue.isDeleted ||
                issue.state !== 'published' ||
                plantHealthIssueKindForEntityTypeName(
                    issue.entityType?.name ?? issue.entityTypeName,
                ) !== kind
            ) {
                continue;
            }

            const summary = healthIssueSummary(
                issue,
                kind,
                publishedOperationsById,
            );
            for (const plantId of plantHealthAffectedPlantIdsForEntity(issue)) {
                if (!publishedPlantsById.has(plantId)) {
                    continue;
                }

                ensurePlantHealth(plantId)[
                    kind === 'disease' ? 'diseases' : 'pests'
                ].set(issue.id, summary);
            }
        }
    }

    collectIssues(diseases, 'disease');
    collectIssues(pests, 'pest');

    const readModels = new Map<number, PlantHealthReadModel>();
    for (const [plantId, healthMaps] of healthByPlantId) {
        const diseaseSummaries = sortedByName(healthMaps.diseases.values());
        const pestSummaries = sortedByName(healthMaps.pests.values());

        readModels.set(plantId, {
            ...(diseaseSummaries.length > 0
                ? { diseases: diseaseSummaries }
                : {}),
            ...(pestSummaries.length > 0 ? { pests: pestSummaries } : {}),
        });
    }

    return readModels;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringFromRecord(record: Record<string, unknown>, key: string) {
    const value = record[key];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function imageCoverFromFormattedEntity(entity: Record<string, unknown>) {
    if (!isRecord(entity.image) || !isRecord(entity.image.cover)) {
        return undefined;
    }

    const url = entity.image.cover.url;
    if (typeof url !== 'string' || url.length === 0) {
        return undefined;
    }

    return { cover: { url } };
}

function shallowFormattedEntitySummary(
    value: unknown,
    fallback: string,
): FormattedEntitySummary | null {
    if (!isRecord(value) || typeof value.id !== 'number') {
        return null;
    }

    const information = isRecord(value.information)
        ? value.information
        : undefined;
    const name =
        (information && stringFromRecord(information, 'label')) ??
        (information && stringFromRecord(information, 'name')) ??
        stringFromRecord(value, 'label') ??
        stringFromRecord(value, 'name') ??
        `${fallback} ${value.id}`;
    const rootLabel = stringFromRecord(value, 'label');
    const informationLabel =
        information && stringFromRecord(information, 'label');
    const label = informationLabel ?? rootLabel;
    const slug = stringFromRecord(value, 'slug') ?? slugify(name);
    const latinName =
        (information && stringFromRecord(information, 'latinName')) ??
        stringFromRecord(value, 'latinName');
    const image = imageCoverFromFormattedEntity(value);

    return {
        id: value.id,
        slug,
        name,
        ...(label && label !== name ? { label } : {}),
        ...(latinName ? { latinName } : {}),
        ...(image ? { image } : {}),
    };
}

function formattedEntitySummaryArray(value: unknown, fallback: string) {
    if (!Array.isArray(value)) {
        return value;
    }

    const seenIds = new Set<number>();
    const summaries: FormattedEntitySummary[] = [];
    for (const item of value) {
        const summary = shallowFormattedEntitySummary(item, fallback);
        if (!summary) {
            continue;
        }
        if (seenIds.has(summary.id)) {
            continue;
        }
        seenIds.add(summary.id);
        summaries.push(summary);
    }

    return summaries;
}

export function sanitizePlantHealthIssueFormattedEntity<T>(entity: T): T {
    if (!isRecord(entity)) {
        return entity;
    }

    const nextEntity: Record<string, unknown> = { ...entity };
    if (isRecord(nextEntity.relationships)) {
        nextEntity.relationships = {
            ...nextEntity.relationships,
            [plantHealthAffectedPlantsAttributeName]:
                formattedEntitySummaryArray(
                    nextEntity.relationships[
                        plantHealthAffectedPlantsAttributeName
                    ],
                    'Biljka',
                ),
        };
    }

    if (isRecord(nextEntity.operations)) {
        const nextOperations = { ...nextEntity.operations };
        for (const attributeName of Object.values(
            plantHealthOperationAttributeNames,
        )) {
            nextOperations[attributeName] = formattedEntitySummaryArray(
                nextEntity.operations[attributeName],
                'Radnja',
            );
        }
        nextEntity.operations = nextOperations;
    }

    return nextEntity as T;
}
