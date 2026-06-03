import { slugify } from '@gredice/js/slug';
import { and, eq, inArray, or } from 'drizzle-orm';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    type SelectAttributeDefinition,
    type SelectAttributeValue,
    type SelectEntity,
    type SelectEntityType,
    storage,
} from '..';

export const plantRelationshipAttributeConfigs = [
    {
        category: 'relationships',
        name: 'companions',
        label: 'Companion plants',
        kind: 'companion',
    },
    {
        category: 'relationships',
        name: 'antagonists',
        label: 'Antagonistic plants',
        kind: 'antagonist',
    },
] as const;

export type PlantRelationshipKind =
    (typeof plantRelationshipAttributeConfigs)[number]['kind'];
export type PlantRelationshipAttributeName =
    (typeof plantRelationshipAttributeConfigs)[number]['name'];

export type PlantRelationshipDefinition = SelectAttributeDefinition & {
    name: PlantRelationshipAttributeName;
};

type PlantRelationshipAttribute = SelectAttributeValue & {
    attributeDefinition: SelectAttributeDefinition;
};

type PlantRelationshipEntity = SelectEntity & {
    attributes: PlantRelationshipAttribute[];
    entityType: SelectEntityType;
};

export type PlantRelationshipEntry = {
    id: number;
    slug: string;
    displayName: string;
    kind: PlantRelationshipKind;
    image?: {
        cover: {
            url: string;
        };
    };
};

export type PlantRelationshipReadModel = Partial<
    Record<PlantRelationshipAttributeName, PlantRelationshipEntry[]>
>;

const plantRelationshipConfigByName = new Map(
    plantRelationshipAttributeConfigs.map((config) => [config.name, config]),
);

function parseEntityRefId(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    const trimmedValue = value.trim();
    if (!/^\d+$/.test(trimmedValue)) {
        return null;
    }

    return Number.parseInt(trimmedValue, 10);
}

export function isPlantRelationshipAttributeDefinition(
    definition: Pick<
        SelectAttributeDefinition,
        'entityTypeName' | 'category' | 'name' | 'dataType'
    >,
): definition is PlantRelationshipDefinition {
    return (
        definition.entityTypeName === 'plant' &&
        definition.category === 'relationships' &&
        definition.dataType === 'ref:plant' &&
        plantRelationshipAttributeConfigs.some(
            (config) => config.name === definition.name,
        )
    );
}

export async function getPlantRelationshipDefinitions() {
    const definitions = await storage().query.attributeDefinitions.findMany({
        where: and(
            eq(attributeDefinitions.isDeleted, false),
            eq(attributeDefinitions.entityTypeName, 'plant'),
            eq(attributeDefinitions.category, 'relationships'),
            eq(attributeDefinitions.dataType, 'ref:plant'),
            inArray(
                attributeDefinitions.name,
                plantRelationshipAttributeConfigs.map((config) => config.name),
            ),
        ),
    });

    return definitions.filter(isPlantRelationshipAttributeDefinition);
}

function plantRelationshipConfigForDefinition(
    definition: SelectAttributeDefinition,
) {
    if (!isPlantRelationshipAttributeDefinition(definition)) {
        return null;
    }
    return plantRelationshipConfigByName.get(definition.name) ?? null;
}

function entityNameFromAttributes(entity: PlantRelationshipEntity) {
    return (
        entity.attributes.find(
            (attribute) =>
                attribute.attributeDefinition.category === 'information' &&
                attribute.attributeDefinition.name === 'name',
        )?.value ?? null
    );
}

function entityDisplayNameFromAttributes(entity: PlantRelationshipEntity) {
    const label = entity.attributes.find(
        (attribute) =>
            attribute.attributeDefinition.category === 'information' &&
            attribute.attributeDefinition.name === 'label',
    )?.value;
    const name = entityNameFromAttributes(entity);
    return label ?? name ?? `${entity.entityType.label} ${entity.id}`;
}

function parseJson(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}

function imageUrlFromParsed(value: unknown): string | null {
    if (Array.isArray(value)) {
        for (const item of value) {
            const url = imageUrlFromParsed(item);
            if (url) {
                return url;
            }
        }
        return null;
    }

    if (typeof value !== 'object' || value === null) {
        return null;
    }

    if ('url' in value && typeof value.url === 'string') {
        const url = value.url.trim();
        return url.length > 0 ? url : null;
    }

    return (
        ('cover' in value ? imageUrlFromParsed(value.cover) : null) ??
        ('image' in value ? imageUrlFromParsed(value.image) : null) ??
        ('images' in value ? imageUrlFromParsed(value.images) : null)
    );
}

function entityCoverImage(entity: PlantRelationshipEntity) {
    for (const attribute of entity.attributes) {
        if (
            attribute.attributeDefinition.dataType !== 'image' &&
            !attribute.attributeDefinition.dataType.startsWith('json')
        ) {
            continue;
        }

        const url = imageUrlFromParsed(parseJson(attribute.value));
        if (url) {
            return { cover: { url } };
        }
    }

    return undefined;
}

function shallowPlantRelationshipEntry(
    entity: PlantRelationshipEntity,
    kind: PlantRelationshipKind,
): PlantRelationshipEntry {
    const displayName = entityDisplayNameFromAttributes(entity);
    const image = entityCoverImage(entity);
    return {
        id: entity.id,
        slug: slugify(displayName),
        displayName,
        kind,
        ...(image ? { image } : {}),
    };
}

function addRelationshipTarget(
    relationships: Map<
        PlantRelationshipAttributeName,
        Map<number, PlantRelationshipEntry>
    >,
    sourcePlantId: number,
    targetPlantId: number | null,
    targetPlantsById: Map<number, PlantRelationshipEntity>,
    definition: SelectAttributeDefinition,
) {
    if (targetPlantId === null || targetPlantId === sourcePlantId) {
        return;
    }

    const targetPlant = targetPlantsById.get(targetPlantId);
    const config = plantRelationshipConfigForDefinition(definition);
    if (!targetPlant || !config) {
        return;
    }

    const entries = relationships.get(config.name) ?? new Map();
    if (!entries.has(targetPlant.id)) {
        entries.set(
            targetPlant.id,
            shallowPlantRelationshipEntry(targetPlant, config.kind),
        );
    }
    relationships.set(config.name, entries);
}

export async function buildPlantRelationshipReadModel(
    sourcePlant: PlantRelationshipEntity,
    publishedPlants: PlantRelationshipEntity[],
): Promise<PlantRelationshipReadModel | null> {
    if (sourcePlant.entityTypeName !== 'plant') {
        return null;
    }

    const publishedPlantsById = new Map(
        publishedPlants.map((plant) => [plant.id, plant]),
    );
    const relationships = new Map<
        PlantRelationshipAttributeName,
        Map<number, PlantRelationshipEntry>
    >();

    for (const attribute of sourcePlant.attributes) {
        if (
            !isPlantRelationshipAttributeDefinition(
                attribute.attributeDefinition,
            )
        ) {
            continue;
        }

        addRelationshipTarget(
            relationships,
            sourcePlant.id,
            parseEntityRefId(attribute.value),
            publishedPlantsById,
            attribute.attributeDefinition,
        );
    }

    for (const plant of publishedPlants) {
        if (plant.id === sourcePlant.id) {
            continue;
        }

        for (const attribute of plant.attributes) {
            if (
                !isPlantRelationshipAttributeDefinition(
                    attribute.attributeDefinition,
                )
            ) {
                continue;
            }

            const targetPlantId = parseEntityRefId(attribute.value);
            if (targetPlantId !== sourcePlant.id) {
                continue;
            }

            addRelationshipTarget(
                relationships,
                sourcePlant.id,
                plant.id,
                publishedPlantsById,
                attribute.attributeDefinition,
            );
        }
    }

    if (relationships.size === 0) {
        return null;
    }

    return Object.fromEntries(
        Array.from(relationships.entries()).map(([name, entries]) => [
            name,
            Array.from(entries.values()).sort((a, b) =>
                a.displayName.localeCompare(b.displayName),
            ),
        ]),
    );
}

export async function getPlantRelationshipLinkedEntityIds(entityId: number) {
    const definitions = await getPlantRelationshipDefinitions();
    if (definitions.length === 0) {
        return [];
    }

    const relationshipValues = await storage().query.attributeValues.findMany({
        where: and(
            eq(attributeValues.isDeleted, false),
            inArray(
                attributeValues.attributeDefinitionId,
                definitions.map((definition) => definition.id),
            ),
            or(
                eq(attributeValues.entityId, entityId),
                eq(attributeValues.value, String(entityId)),
            ),
        ),
        columns: {
            entityId: true,
            value: true,
        },
    });

    const linkedIds = new Set<number>();
    for (const relationshipValue of relationshipValues) {
        if (relationshipValue.entityId !== entityId) {
            linkedIds.add(relationshipValue.entityId);
        }

        const targetId = parseEntityRefId(relationshipValue.value);
        if (targetId !== null && targetId !== entityId) {
            linkedIds.add(targetId);
        }
    }

    if (linkedIds.size === 0) {
        return [];
    }

    const linkedPlants = await storage().query.entities.findMany({
        where: and(
            inArray(entities.id, Array.from(linkedIds)),
            eq(entities.entityTypeName, 'plant'),
            eq(entities.isDeleted, false),
        ),
        columns: {
            id: true,
        },
    });

    return linkedPlants.map((plant) => plant.id);
}

export async function getPlantRelationshipMutationEntityIds(input: {
    entityId: number | undefined;
    entityTypeName: string | undefined | null;
    attributeDefinition: SelectAttributeDefinition | undefined | null;
    previousValue?: string | null;
    nextValue?: string | null;
}) {
    if (
        !input.entityId ||
        input.entityTypeName !== 'plant' ||
        !input.attributeDefinition ||
        !isPlantRelationshipAttributeDefinition(input.attributeDefinition)
    ) {
        return [];
    }

    const entityIds = new Set<number>([input.entityId]);
    const previousTargetId = parseEntityRefId(input.previousValue);
    const nextTargetId = parseEntityRefId(input.nextValue);
    if (previousTargetId !== null && previousTargetId !== input.entityId) {
        entityIds.add(previousTargetId);
    }
    if (nextTargetId !== null && nextTargetId !== input.entityId) {
        entityIds.add(nextTargetId);
    }

    const existingPlants = await storage().query.entities.findMany({
        where: and(
            inArray(entities.id, Array.from(entityIds)),
            eq(entities.entityTypeName, 'plant'),
            eq(entities.isDeleted, false),
        ),
        columns: {
            id: true,
        },
    });

    return existingPlants.map((plant) => plant.id);
}
