import { slugify } from '@gredice/js/slug';
import type {
    SelectAttributeDefinition,
    SelectAttributeValue,
    SelectEntity,
    SelectEntityType,
} from '../schema';

export const plantRelationshipCategory = 'relationships';
export const plantRelationshipAttributeNames = {
    companions: 'companions',
    antagonists: 'antagonists',
} as const;

export type PlantRelationshipKind =
    keyof typeof plantRelationshipAttributeNames;

type PlantRelationshipName =
    (typeof plantRelationshipAttributeNames)[PlantRelationshipKind];

export type PlantRelationshipDirection = 'outgoing' | 'incoming';
type PlantRelationshipSourceEntityTypeName = 'plant' | 'plantSort';

export type PlantRelationshipSummary = {
    id: number;
    slug: string;
    name: string;
    latinName?: string;
    image?: {
        cover?: {
            url: string;
        };
    };
    relationship: 'companion' | 'antagonist';
};

export type PlantRelationshipsReadModel = Partial<
    Record<PlantRelationshipKind, PlantRelationshipSummary[]>
>;

export type PlantRelationshipAuthoringEntry = PlantRelationshipSummary & {
    directions: PlantRelationshipDirection[];
    state: string;
};

export type PlantRelationshipConflict = {
    plant: Omit<PlantRelationshipSummary, 'relationship'>;
    companionDirections: PlantRelationshipDirection[];
    antagonistDirections: PlantRelationshipDirection[];
};

export type PlantRelationshipAuthoringSummary = {
    companions: PlantRelationshipAuthoringEntry[];
    antagonists: PlantRelationshipAuthoringEntry[];
    conflicts: PlantRelationshipConflict[];
};

type PlantRelationshipAttributeDefinition = Pick<
    SelectAttributeDefinition,
    'category' | 'dataType' | 'entityTypeName' | 'name'
>;

type PlantRelationshipAttribute = Pick<
    SelectAttributeValue,
    'isDeleted' | 'value'
> & {
    attributeDefinition: PlantRelationshipAttributeDefinition;
};

export type PlantRelationshipEntity = Pick<
    SelectEntity,
    'id' | 'isDeleted' | 'state'
> & {
    attributes: PlantRelationshipAttribute[];
    entityType?: Pick<SelectEntityType, 'label' | 'name'>;
};

const plantRelationshipNamesByKind = new Map<
    PlantRelationshipName,
    PlantRelationshipKind
>(
    Object.entries(plantRelationshipAttributeNames).map(([kind, name]) => [
        name,
        kind as PlantRelationshipKind,
    ]),
);
const plantRelationshipSourceEntityTypeNames = new Set<string>([
    'plant',
    'plantSort',
]);
const plantRelationshipKinds = [
    'companions',
    'antagonists',
] satisfies PlantRelationshipKind[];

function relationshipLabel(kind: PlantRelationshipKind) {
    return kind === 'companions' ? 'companion' : 'antagonist';
}

export function plantRelationshipKindForAttributeDefinition(
    attributeDefinition: PlantRelationshipAttributeDefinition,
): PlantRelationshipKind | null {
    if (
        !plantRelationshipSourceEntityTypeNames.has(
            attributeDefinition.entityTypeName,
        ) ||
        attributeDefinition.category !== plantRelationshipCategory ||
        attributeDefinition.dataType !== 'ref:plant'
    ) {
        return null;
    }

    return (
        plantRelationshipNamesByKind.get(
            attributeDefinition.name as PlantRelationshipName,
        ) ?? null
    );
}

export function isPlantRelationshipAttributeDefinition(
    attributeDefinition: PlantRelationshipAttributeDefinition,
) {
    return (
        plantRelationshipKindForAttributeDefinition(attributeDefinition) !==
        null
    );
}

export function parsePlantRelationshipTargetId(
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

export function plantRelationshipTargetIdForAttributeValue(
    attributeDefinition: PlantRelationshipAttributeDefinition,
    value: string | null | undefined,
) {
    if (!isPlantRelationshipAttributeDefinition(attributeDefinition)) {
        return null;
    }

    return parsePlantRelationshipTargetId(value);
}

function textAttribute(
    entity: PlantRelationshipEntity,
    category: string,
    name: string,
) {
    return (
        entity.attributes.find(
            (attribute) =>
                !attribute.isDeleted &&
                attribute.attributeDefinition.category === category &&
                attribute.attributeDefinition.name === name,
        )?.value ?? null
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

function plantDisplayName(entity: PlantRelationshipEntity) {
    return (
        textAttribute(entity, 'information', 'label') ??
        textAttribute(entity, 'information', 'name') ??
        `${entity.entityType?.label ?? 'Biljka'} ${entity.id}`
    );
}

function plantSummary(
    entity: PlantRelationshipEntity,
    kind: PlantRelationshipKind,
): PlantRelationshipSummary {
    const cover = parseImageCover(textAttribute(entity, 'image', 'cover'));
    const latinName =
        textAttribute(entity, 'information', 'latinName') ?? undefined;
    const name = plantDisplayName(entity);

    return {
        id: entity.id,
        slug: slugify(name),
        name,
        ...(latinName ? { latinName } : {}),
        ...(cover ? { image: { cover } } : {}),
        relationship: relationshipLabel(kind),
    };
}

function isPublishedEntity(
    entity: PlantRelationshipEntity,
    entityTypeName: string,
) {
    return (
        !entity.isDeleted &&
        entity.state === 'published' &&
        entity.entityType?.name === entityTypeName
    );
}

function isPublishedPlantRelationshipSource(
    entity: PlantRelationshipEntity,
): entity is PlantRelationshipEntity & {
    entityType: { name: PlantRelationshipSourceEntityTypeName };
} {
    return (
        !entity.isDeleted &&
        entity.state === 'published' &&
        plantRelationshipSourceEntityTypeNames.has(
            entity.entityType?.name ?? '',
        )
    );
}

function parentPlantIdForSort(entity: PlantRelationshipEntity) {
    if (entity.entityType?.name !== 'plantSort') {
        return null;
    }

    const plantAttribute = entity.attributes.find(
        (attribute) =>
            !attribute.isDeleted &&
            attribute.attributeDefinition.category === 'information' &&
            attribute.attributeDefinition.name === 'plant' &&
            attribute.attributeDefinition.dataType === 'ref:plant',
    );

    return parsePlantRelationshipTargetId(plantAttribute?.value);
}

function ensureKindMap(
    relationshipsByEntityId: Map<
        number,
        Record<PlantRelationshipKind, Map<number, PlantRelationshipSummary>>
    >,
    entityId: number,
) {
    const existing = relationshipsByEntityId.get(entityId);
    if (existing) {
        return existing;
    }

    const created = {
        companions: new Map<number, PlantRelationshipSummary>(),
        antagonists: new Map<number, PlantRelationshipSummary>(),
    };
    relationshipsByEntityId.set(entityId, created);
    return created;
}

function sortedRelationshipEntries(
    entries: Iterable<PlantRelationshipSummary>,
) {
    return Array.from(entries).sort((left, right) =>
        left.name.localeCompare(right.name, 'hr'),
    );
}

export function buildPlantRelationshipReadModels(
    entities: PlantRelationshipEntity[],
) {
    const publishedPlantsById = new Map(
        entities
            .filter((entity) => isPublishedEntity(entity, 'plant'))
            .map((entity) => [entity.id, entity]),
    );
    const publishedSources = entities.filter(
        isPublishedPlantRelationshipSource,
    );
    const relationshipsByEntityId = new Map<
        number,
        Record<PlantRelationshipKind, Map<number, PlantRelationshipSummary>>
    >();

    for (const source of publishedSources) {
        for (const attribute of source.attributes) {
            if (attribute.isDeleted) {
                continue;
            }

            const kind = plantRelationshipKindForAttributeDefinition(
                attribute.attributeDefinition,
            );
            if (!kind) {
                continue;
            }

            const targetId = parsePlantRelationshipTargetId(attribute.value);
            if (!targetId || targetId === source.id) {
                continue;
            }

            const target = publishedPlantsById.get(targetId);
            if (!target) {
                continue;
            }

            ensureKindMap(relationshipsByEntityId, source.id)[kind].set(
                target.id,
                plantSummary(target, kind),
            );
            if (source.entityType.name === 'plant') {
                ensureKindMap(relationshipsByEntityId, target.id)[kind].set(
                    source.id,
                    plantSummary(source, kind),
                );
            }
        }
    }

    for (const source of publishedSources) {
        const parentPlantId = parentPlantIdForSort(source);
        if (!parentPlantId) {
            continue;
        }

        const parentRelationships = relationshipsByEntityId.get(parentPlantId);
        if (!parentRelationships) {
            continue;
        }

        const sortRelationships = ensureKindMap(
            relationshipsByEntityId,
            source.id,
        );
        for (const kind of plantRelationshipKinds) {
            for (const [plantId, summary] of parentRelationships[kind]) {
                sortRelationships[kind].set(plantId, summary);
            }
        }
    }

    const readModels = new Map<number, PlantRelationshipsReadModel>();
    for (const [entityId, relationshipMaps] of relationshipsByEntityId) {
        const companions = sortedRelationshipEntries(
            relationshipMaps.companions.values(),
        );
        const antagonists = sortedRelationshipEntries(
            relationshipMaps.antagonists.values(),
        );
        readModels.set(entityId, {
            ...(companions.length > 0 ? { companions } : {}),
            ...(antagonists.length > 0 ? { antagonists } : {}),
        });
    }

    return readModels;
}

type AdminRelationshipMap = Record<
    PlantRelationshipKind,
    Map<
        number,
        {
            plant: PlantRelationshipEntity;
            directions: Set<PlantRelationshipDirection>;
        }
    >
>;

function ensureAdminRelationship(
    relationshipMap: AdminRelationshipMap,
    kind: PlantRelationshipKind,
    plant: PlantRelationshipEntity,
) {
    const existing = relationshipMap[kind].get(plant.id);
    if (existing) {
        return existing;
    }

    const created = {
        plant,
        directions: new Set<PlantRelationshipDirection>(),
    };
    relationshipMap[kind].set(plant.id, created);
    return created;
}

function adminEntries(
    entries: Iterable<{
        plant: PlantRelationshipEntity;
        directions: Set<PlantRelationshipDirection>;
    }>,
    kind: PlantRelationshipKind,
): PlantRelationshipAuthoringEntry[] {
    return Array.from(entries)
        .map((entry) => ({
            ...plantSummary(entry.plant, kind),
            state: entry.plant.state,
            directions: Array.from(entry.directions).sort(),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'hr'));
}

export function buildPlantRelationshipAuthoringSummary(
    entityId: number,
    entities: PlantRelationshipEntity[],
): PlantRelationshipAuthoringSummary {
    const plantsById = new Map(
        entities
            .filter(
                (entity) =>
                    !entity.isDeleted && entity.entityType?.name === 'plant',
            )
            .map((entity) => [entity.id, entity]),
    );
    const relationshipMap: AdminRelationshipMap = {
        companions: new Map(),
        antagonists: new Map(),
    };

    for (const source of plantsById.values()) {
        for (const attribute of source.attributes) {
            if (attribute.isDeleted) {
                continue;
            }

            const kind = plantRelationshipKindForAttributeDefinition(
                attribute.attributeDefinition,
            );
            if (!kind) {
                continue;
            }

            const targetId = parsePlantRelationshipTargetId(attribute.value);
            if (!targetId || targetId === source.id) {
                continue;
            }

            const target = plantsById.get(targetId);
            if (!target) {
                continue;
            }

            if (source.id === entityId) {
                ensureAdminRelationship(
                    relationshipMap,
                    kind,
                    target,
                ).directions.add('outgoing');
            }
            if (target.id === entityId) {
                ensureAdminRelationship(
                    relationshipMap,
                    kind,
                    source,
                ).directions.add('incoming');
            }
        }
    }

    const companions = adminEntries(
        relationshipMap.companions.values(),
        'companions',
    );
    const antagonists = adminEntries(
        relationshipMap.antagonists.values(),
        'antagonists',
    );
    const antagonistById = new Map(
        antagonists.map((entry) => [entry.id, entry]),
    );
    const conflicts = companions
        .flatMap((companion) => {
            const antagonist = antagonistById.get(companion.id);
            if (!antagonist) {
                return [];
            }

            const { relationship: _relationship, ...plant } = companion;
            return [
                {
                    plant,
                    companionDirections: companion.directions,
                    antagonistDirections: antagonist.directions,
                },
            ];
        })
        .sort((left, right) =>
            left.plant.name.localeCompare(right.plant.name, 'hr'),
        );

    return {
        companions,
        antagonists,
        conflicts,
    };
}
