import {
    getGridPositionFromIndex,
    getPositionIndexFromGrid,
} from '../../utils/raisedBedOrientation';

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
    information?: {
        plant?: {
            id: number;
            information?: {
                name?: string | null;
            } | null;
        } | null;
    } | null;
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
    const localPosition = getGridPositionFromIndex(
        localPositionIndex,
        'vertical',
    );
    const visualBlockIndex = normalizedBlockCount - 1 - blockIndex;
    const visualRow = visualBlockIndex * 3 + localPosition.row;
    const totalRows = normalizedBlockCount * 3;
    const positions: number[] = [];

    for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
        for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
            if (rowDelta === 0 && colDelta === 0) {
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
