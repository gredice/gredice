import { getPositionIndexFromGrid } from '../../utils/raisedBedOrientation';

export type PlantRelationshipSignalStatus =
    | 'companion'
    | 'antagonist'
    | 'mixed'
    | 'neutral';

export type PlantRelationshipSignal = {
    status: PlantRelationshipSignalStatus;
    companionNeighborNames: string[];
    antagonistNeighborNames: string[];
    neighborPlantIds: number[];
};

type PlantRelationshipReferenceLike = {
    id: number;
    name: string;
};

export type PlantRelationshipCandidateLike = {
    id: number;
    information: {
        name?: string | null;
    };
    relationships?: {
        companions?: PlantRelationshipReferenceLike[] | null;
        antagonists?: PlantRelationshipReferenceLike[] | null;
    } | null;
};

export type NeighborPlantSummary = {
    id: number;
    name: string;
};

export type RaisedBedFieldRelationshipIndicatorDirection =
    | 'bottom'
    | 'bottomLeft'
    | 'bottomRight'
    | 'left'
    | 'right'
    | 'top'
    | 'topLeft'
    | 'topRight';

export type RaisedBedFieldRelationshipIndicatorStatus =
    | 'antagonist'
    | 'companion';

export type RaisedBedFieldRelationshipIndicator = {
    companionPlantNames: string[];
    direction: RaisedBedFieldRelationshipIndicatorDirection;
    antagonistPlantNames: string[];
    neighborPositionIndex: number;
    positionIndex: number;
    status: RaisedBedFieldRelationshipIndicatorStatus;
};

type RaisedBedFieldLike = {
    active?: boolean | null;
    plantSortId?: number | null;
    positionIndex: number;
};

type ShoppingCartPlantItemLike = {
    entityId?: string | null;
    entityTypeName?: string | null;
    gardenId?: number | null;
    raisedBedId?: number | null;
    positionIndex?: number | null;
    status?: string | null;
};

type PlantSortLike = {
    id: number;
    relationships?: {
        companions?: PlantRelationshipReferenceLike[] | null;
        antagonists?: PlantRelationshipReferenceLike[] | null;
    } | null;
    information?: {
        plant?: PlantRelationshipCandidateLike | null;
    } | null;
};

type PositionedPlantSummary = {
    plant: PlantRelationshipCandidateLike;
    positionIndex: number;
};

function uniqueValues<T>(values: T[]) {
    return Array.from(new Set(values));
}

function parseEntityId(value: string | number | null | undefined) {
    const numericValue = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(numericValue) ? numericValue : null;
}

function plantSummaryForSort(
    sortId: number | null,
    sortsById: Map<number, PlantSortLike>,
): NeighborPlantSummary | null {
    if (sortId === null) {
        return null;
    }

    const plant = sortsById.get(sortId)?.information?.plant;
    if (!plant) {
        return null;
    }

    return {
        id: plant.id,
        name: plant.information?.name ?? `Biljka #${plant.id}`,
    };
}

function hasRelationshipReferences(
    relationships:
        | PlantRelationshipCandidateLike['relationships']
        | PlantSortLike['relationships']
        | null
        | undefined,
) {
    return (
        (relationships?.companions?.length ?? 0) > 0 ||
        (relationships?.antagonists?.length ?? 0) > 0
    );
}

export function getPlantRelationshipCandidateForSort(
    sort: PlantSortLike,
): PlantRelationshipCandidateLike | null {
    const plant = sort.information?.plant;
    if (!plant) {
        return null;
    }

    const relationships = hasRelationshipReferences(sort.relationships)
        ? sort.relationships
        : plant.relationships;

    return {
        id: plant.id,
        information: plant.information,
        relationships,
    };
}

function positionedPlantSummaryForSort(
    positionIndex: number,
    sortId: number | null,
    sortsById: Map<number, PlantSortLike>,
): PositionedPlantSummary | null {
    if (sortId === null) {
        return null;
    }

    const sort = sortsById.get(sortId);
    if (!sort) {
        return null;
    }

    const plant = getPlantRelationshipCandidateForSort(sort);
    if (!plant) {
        return null;
    }

    return {
        plant,
        positionIndex,
    };
}

function plantName(plant: PlantRelationshipCandidateLike) {
    return plant.information?.name ?? `Biljka #${plant.id}`;
}

function getRaisedBedLocalVisualGridPosition(positionIndex: number) {
    const baseRow = Math.floor(positionIndex / 3);
    const baseCol = positionIndex % 3;

    return {
        col: 2 - baseCol,
        row: 2 - baseRow,
    };
}

export function getRaisedBedNeighborPositionIndices({
    blockCount = 2,
    positionIndex,
}: {
    blockCount?: number;
    positionIndex: number;
}) {
    if (!Number.isInteger(positionIndex) || positionIndex < 0) {
        return [];
    }

    const normalizedBlockCount = Math.max(1, Math.floor(blockCount));
    const blockIndex = Math.floor(positionIndex / 9);
    if (blockIndex >= normalizedBlockCount) {
        return [];
    }

    const localPositionIndex = positionIndex % 9;
    const localPosition =
        getRaisedBedLocalVisualGridPosition(localPositionIndex);
    const visualBlockIndex = normalizedBlockCount - 1 - blockIndex;
    const visualRow = visualBlockIndex * 3 + localPosition.row;
    const totalRows = normalizedBlockCount * 3;
    const positions: number[] = [];

    for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
        for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
            if (rowDelta === 0 && colDelta === 0) {
                continue;
            }
            if (rowDelta !== 0 && colDelta !== 0) {
                continue;
            }

            const neighborRow = visualRow + rowDelta;
            const neighborCol = localPosition.col + colDelta;
            if (
                neighborRow < 0 ||
                neighborRow >= totalRows ||
                neighborCol < 0 ||
                neighborCol >= 3
            ) {
                continue;
            }

            const neighborVisualBlockIndex = Math.floor(neighborRow / 3);
            const neighborBlockIndex =
                normalizedBlockCount - 1 - neighborVisualBlockIndex;
            const neighborRowWithinBlock = neighborRow % 3;
            positions.push(
                getPositionIndexFromGrid(
                    neighborRowWithinBlock,
                    neighborCol,
                    'vertical',
                ) +
                    neighborBlockIndex * 9,
            );
        }
    }

    return uniqueValues(positions).sort((a, b) => a - b);
}

function getRaisedBedVisualGridPosition({
    blockCount,
    positionIndex,
}: {
    blockCount: number;
    positionIndex: number;
}) {
    if (!Number.isInteger(positionIndex) || positionIndex < 0) {
        return null;
    }

    const normalizedBlockCount = Math.max(1, Math.floor(blockCount));
    const blockIndex = Math.floor(positionIndex / 9);
    if (blockIndex >= normalizedBlockCount) {
        return null;
    }

    const localPositionIndex = positionIndex % 9;
    const localPosition =
        getRaisedBedLocalVisualGridPosition(localPositionIndex);
    const visualBlockIndex = normalizedBlockCount - 1 - blockIndex;

    return {
        col: localPosition.col,
        row: visualBlockIndex * 3 + localPosition.row,
    };
}

function raisedBedRelationshipDirection(
    rowDelta: number,
    colDelta: number,
): RaisedBedFieldRelationshipIndicatorDirection | null {
    if (rowDelta === -1 && colDelta === -1) return 'topLeft';
    if (rowDelta === -1 && colDelta === 0) return 'top';
    if (rowDelta === -1 && colDelta === 1) return 'topRight';
    if (rowDelta === 0 && colDelta === -1) return 'left';
    if (rowDelta === 0 && colDelta === 1) return 'right';
    if (rowDelta === 1 && colDelta === -1) return 'bottomLeft';
    if (rowDelta === 1 && colDelta === 0) return 'bottom';
    if (rowDelta === 1 && colDelta === 1) return 'bottomRight';

    return null;
}

function getRaisedBedRelationshipDirection({
    blockCount,
    neighborPositionIndex,
    positionIndex,
}: {
    blockCount: number;
    neighborPositionIndex: number;
    positionIndex: number;
}) {
    const position = getRaisedBedVisualGridPosition({
        blockCount,
        positionIndex,
    });
    const neighborPosition = getRaisedBedVisualGridPosition({
        blockCount,
        positionIndex: neighborPositionIndex,
    });

    if (!position || !neighborPosition) {
        return null;
    }

    return raisedBedRelationshipDirection(
        neighborPosition.row - position.row,
        neighborPosition.col - position.col,
    );
}

export function getRaisedBedRelationshipBlockCount({
    cartItems,
    fields,
    positionIndex,
}: {
    cartItems?: ShoppingCartPlantItemLike[] | null;
    fields?: RaisedBedFieldLike[] | null;
    positionIndex: number;
}) {
    const cartPositionIndices =
        cartItems
            ?.map((item) => item.positionIndex)
            .filter((value): value is number => typeof value === 'number') ??
        [];
    const fieldPositionIndices =
        fields?.map((field) => field.positionIndex) ?? [];
    const maxPositionIndex = Math.max(
        positionIndex,
        ...cartPositionIndices,
        ...fieldPositionIndices,
    );

    return Math.max(2, Math.ceil((maxPositionIndex + 1) / 9));
}

export function getNeighborPlantSummaries({
    blockCount,
    cartItems,
    fields,
    gardenId,
    positionIndex,
    raisedBedId,
    sorts,
}: {
    blockCount?: number;
    cartItems?: ShoppingCartPlantItemLike[] | null;
    fields?: RaisedBedFieldLike[] | null;
    gardenId: number;
    positionIndex: number;
    raisedBedId: number;
    sorts?: PlantSortLike[] | null;
}) {
    const sortsById = new Map((sorts ?? []).map((sort) => [sort.id, sort]));
    const neighborPositionIndices = new Set(
        getRaisedBedNeighborPositionIndices({ blockCount, positionIndex }),
    );
    const summariesById = new Map<number, NeighborPlantSummary>();

    for (const field of fields ?? []) {
        if (
            !field.active ||
            !neighborPositionIndices.has(field.positionIndex)
        ) {
            continue;
        }

        const summary = plantSummaryForSort(
            field.plantSortId ?? null,
            sortsById,
        );
        if (summary) {
            summariesById.set(summary.id, summary);
        }
    }

    for (const item of cartItems ?? []) {
        if (
            item.entityTypeName !== 'plantSort' ||
            item.gardenId !== gardenId ||
            item.raisedBedId !== raisedBedId ||
            item.status !== 'new' ||
            typeof item.positionIndex !== 'number' ||
            !neighborPositionIndices.has(item.positionIndex)
        ) {
            continue;
        }

        const summary = plantSummaryForSort(
            parseEntityId(item.entityId),
            sortsById,
        );
        if (summary) {
            summariesById.set(summary.id, summary);
        }
    }

    return Array.from(summariesById.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'hr-HR'),
    );
}

function getPositionedPlantSummaries({
    cartItems,
    fields,
    gardenId,
    raisedBedId,
    sorts,
}: {
    cartItems?: ShoppingCartPlantItemLike[] | null;
    fields?: RaisedBedFieldLike[] | null;
    gardenId: number;
    raisedBedId: number;
    sorts?: PlantSortLike[] | null;
}) {
    const sortsById = new Map((sorts ?? []).map((sort) => [sort.id, sort]));
    const summariesByPosition = new Map<number, PositionedPlantSummary>();

    for (const field of fields ?? []) {
        if (!field.active) {
            continue;
        }

        const summary = positionedPlantSummaryForSort(
            field.positionIndex,
            field.plantSortId ?? null,
            sortsById,
        );
        if (summary) {
            summariesByPosition.set(field.positionIndex, summary);
        }
    }

    for (const item of cartItems ?? []) {
        if (
            item.entityTypeName !== 'plantSort' ||
            item.gardenId !== gardenId ||
            item.raisedBedId !== raisedBedId ||
            item.status !== 'new' ||
            typeof item.positionIndex !== 'number'
        ) {
            continue;
        }

        const summary = positionedPlantSummaryForSort(
            item.positionIndex,
            parseEntityId(item.entityId),
            sortsById,
        );
        if (summary) {
            summariesByPosition.set(item.positionIndex, summary);
        }
    }

    return summariesByPosition;
}

function getPairRelationshipStatus({
    neighbor,
    plant,
}: {
    neighbor: PositionedPlantSummary;
    plant: PositionedPlantSummary;
}) {
    const plantToNeighbor = getPlantRelationshipSignal({
        candidate: plant.plant,
        neighborPlants: [
            {
                id: neighbor.plant.id,
                name: plantName(neighbor.plant),
            },
        ],
    });
    const neighborToPlant = getPlantRelationshipSignal({
        candidate: neighbor.plant,
        neighborPlants: [
            {
                id: plant.plant.id,
                name: plantName(plant.plant),
            },
        ],
    });
    const companionPlantNames = uniqueValues([
        ...plantToNeighbor.companionNeighborNames,
        ...neighborToPlant.companionNeighborNames,
    ]).sort((a, b) => a.localeCompare(b, 'hr-HR'));
    const antagonistPlantNames = uniqueValues([
        ...plantToNeighbor.antagonistNeighborNames,
        ...neighborToPlant.antagonistNeighborNames,
    ]).sort((a, b) => a.localeCompare(b, 'hr-HR'));

    if (antagonistPlantNames.length > 0) {
        return {
            antagonistPlantNames,
            companionPlantNames,
            status: 'antagonist',
        } satisfies Pick<
            RaisedBedFieldRelationshipIndicator,
            'antagonistPlantNames' | 'companionPlantNames' | 'status'
        >;
    }

    if (companionPlantNames.length > 0) {
        return {
            antagonistPlantNames,
            companionPlantNames,
            status: 'companion',
        } satisfies Pick<
            RaisedBedFieldRelationshipIndicator,
            'antagonistPlantNames' | 'companionPlantNames' | 'status'
        >;
    }

    return null;
}

export function getRaisedBedFieldRelationshipIndicators({
    blockCount,
    cartItems,
    fields,
    gardenId,
    raisedBedId,
    sorts,
}: {
    blockCount?: number;
    cartItems?: ShoppingCartPlantItemLike[] | null;
    fields?: RaisedBedFieldLike[] | null;
    gardenId: number;
    raisedBedId: number;
    sorts?: PlantSortLike[] | null;
}) {
    const normalizedBlockCount = Math.max(1, Math.floor(blockCount ?? 2));
    const plantsByPosition = getPositionedPlantSummaries({
        cartItems,
        fields,
        gardenId,
        raisedBedId,
        sorts,
    });
    const indicators: RaisedBedFieldRelationshipIndicator[] = [];

    for (const [positionIndex, plant] of plantsByPosition) {
        const neighborPositionIndices = getRaisedBedNeighborPositionIndices({
            blockCount: normalizedBlockCount,
            positionIndex,
        });

        for (const neighborPositionIndex of neighborPositionIndices) {
            if (positionIndex > neighborPositionIndex) {
                continue;
            }

            const neighbor = plantsByPosition.get(neighborPositionIndex);
            if (!neighbor) {
                continue;
            }

            const direction = getRaisedBedRelationshipDirection({
                blockCount: normalizedBlockCount,
                neighborPositionIndex,
                positionIndex,
            });
            const relationship = getPairRelationshipStatus({
                neighbor,
                plant,
            });

            if (!direction || !relationship) {
                continue;
            }

            indicators.push({
                ...relationship,
                direction,
                neighborPositionIndex,
                positionIndex,
            });
        }
    }

    return indicators;
}

export function getPlantRelationshipSignal({
    candidate,
    neighborPlants,
}: {
    candidate: PlantRelationshipCandidateLike;
    neighborPlants: NeighborPlantSummary[];
}): PlantRelationshipSignal {
    const neighborPlantIds = neighborPlants.map((plant) => plant.id);
    const companionIds = new Set(
        candidate.relationships?.companions?.map(
            (relationship) => relationship.id,
        ) ?? [],
    );
    const antagonistIds = new Set(
        candidate.relationships?.antagonists?.map(
            (relationship) => relationship.id,
        ) ?? [],
    );

    const companionNeighborNames = neighborPlants
        .filter((plant) => companionIds.has(plant.id))
        .map((plant) => plant.name);
    const antagonistNeighborNames = neighborPlants
        .filter((plant) => antagonistIds.has(plant.id))
        .map((plant) => plant.name);

    const hasCompanion = companionNeighborNames.length > 0;
    const hasAntagonist = antagonistNeighborNames.length > 0;
    const status: PlantRelationshipSignalStatus = hasAntagonist
        ? hasCompanion
            ? 'mixed'
            : 'antagonist'
        : hasCompanion
          ? 'companion'
          : 'neutral';

    return {
        status,
        companionNeighborNames,
        antagonistNeighborNames,
        neighborPlantIds,
    };
}

export function getPlantRelationshipSignalSortScore(
    status: PlantRelationshipSignalStatus,
) {
    switch (status) {
        case 'companion':
            return 3;
        case 'mixed':
            return 2;
        case 'neutral':
            return 1;
        case 'antagonist':
            return 0;
    }
}
