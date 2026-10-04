import { getRaisedBedNeighborPositionIndices } from './raisedBed/plantRelationshipSignals';

export type RaisedBedOnboardingCropKey =
    | 'broccoli'
    | 'carrot'
    | 'cucumber'
    | 'lettuce'
    | 'onion'
    | 'pepper'
    | 'spinach'
    | 'tomato';

export type RaisedBedOnboardingGoal =
    | 'salads'
    | 'cooking'
    | 'snacks'
    | 'autumn';

export type RaisedBedOnboardingCare = 'easy' | 'balanced' | 'varied';

type RaisedBedOnboardingImage = {
    cover?: {
        url?: string | null;
    } | null;
} | null;

type RaisedBedOnboardingPlantRelationshipReference = {
    id: number;
    name: string;
};

type RaisedBedOnboardingPlantRelationships = {
    companions?: RaisedBedOnboardingPlantRelationshipReference[] | null;
    antagonists?: RaisedBedOnboardingPlantRelationshipReference[] | null;
} | null;

export type RaisedBedOnboardingPlantSortCandidate = {
    id: number;
    image?: RaisedBedOnboardingImage;
    images?: RaisedBedOnboardingImage;
    relationships?: RaisedBedOnboardingPlantRelationships;
    information: {
        name?: string | null;
        plant: {
            id?: number | null;
            image?: RaisedBedOnboardingImage;
            images?: RaisedBedOnboardingImage;
            relationships?: RaisedBedOnboardingPlantRelationships;
            information?: {
                name?: string | null;
            } | null;
        };
    };
    store?: {
        availableInStore?: boolean | null;
    } | null;
};

export type RaisedBedOnboardingCrop = {
    key: RaisedBedOnboardingCropKey;
    label: string;
    plantName: string;
    sort: RaisedBedOnboardingPlantSortCandidate;
    sortId: number;
    sortName: string;
};

export type RaisedBedOnboardingLayoutPlacement = {
    crop: RaisedBedOnboardingCropKey;
    positionIndex: number;
};

export type RaisedBedOnboardingResolvedPlacement =
    RaisedBedOnboardingLayoutPlacement & {
        cropDetails: RaisedBedOnboardingCrop;
    };

export type RaisedBedOnboardingLayout = {
    id: string;
    title: string;
    subtitle: string;
    goal: RaisedBedOnboardingGoal;
    care: RaisedBedOnboardingCare;
    highlights: string[];
    placements: RaisedBedOnboardingResolvedPlacement[];
    emptyPositionIndices: number[];
};

type CropDefinition = {
    key: RaisedBedOnboardingCropKey;
    label: string;
    plantName: string;
    prioritySortIds: number[];
};

type LayoutDefinition = {
    id: string;
    title: string;
    subtitle: string;
    goal: RaisedBedOnboardingGoal;
    care: RaisedBedOnboardingCare;
    secondaryGoals: RaisedBedOnboardingGoal[];
    highlights: string[];
    placements: RaisedBedOnboardingLayoutPlacement[];
};

export const raisedBedOnboardingGoals: {
    value: RaisedBedOnboardingGoal;
    label: string;
    description: string;
}[] = [
    {
        value: 'salads',
        label: 'Svježe salate',
        description: 'Hrskavi listovi, krastavci i malo rajčice za svaki dan.',
    },
    {
        value: 'cooking',
        label: 'Umaci i roštilj',
        description: 'Rajčica, paprika i luk kao baza za kuhanje.',
    },
    {
        value: 'snacks',
        label: 'Grickanje iz vrta',
        description: 'Mrkve, krastavci i slatki zalogaji za brzu berbu.',
    },
    {
        value: 'autumn',
        label: 'Mirna sezona',
        description: 'Robusnije povrće i zeleni listovi s manje buke.',
    },
];

export const raisedBedOnboardingCareOptions: {
    value: RaisedBedOnboardingCare;
    label: string;
    description: string;
}[] = [
    {
        value: 'easy',
        label: 'Jednostavno',
        description: 'Manje različitih kultura i mirniji ritam.',
    },
    {
        value: 'balanced',
        label: 'Uravnoteženo',
        description: 'Dobra mješavina za kuhanje i svježe obroke.',
    },
    {
        value: 'varied',
        label: 'Raznoliko',
        description: 'Više boja, tekstura i kombinacija u gredici.',
    },
];

const cropDefinitions: CropDefinition[] = [
    {
        key: 'tomato',
        label: 'Rajčica',
        plantName: 'Rajčica',
        prioritySortIds: [206, 211, 544, 490, 489, 488, 335],
    },
    {
        key: 'pepper',
        label: 'Paprika',
        plantName: 'Paprika',
        prioritySortIds: [216, 220, 536, 538, 540],
    },
    {
        key: 'cucumber',
        label: 'Krastavac',
        plantName: 'Krastavac',
        prioritySortIds: [226, 225, 224, 508],
    },
    {
        key: 'carrot',
        label: 'Mrkva',
        plantName: 'Mrkva',
        prioritySortIds: [230, 221, 203, 204],
    },
    {
        key: 'spinach',
        label: 'Špinat',
        plantName: 'Špinat',
        prioritySortIds: [284],
    },
    {
        key: 'lettuce',
        label: 'Salata',
        plantName: 'Salata',
        prioritySortIds: [357, 228, 235, 229, 548, 355, 227, 234],
    },
    {
        key: 'onion',
        label: 'Luk',
        plantName: 'Luk',
        prioritySortIds: [373, 374, 375, 379],
    },
    {
        key: 'broccoli',
        label: 'Brokula',
        plantName: 'Brokula',
        prioritySortIds: [353, 239],
    },
];

function position(row: number, col: number) {
    return col * 3 + row;
}

const allRaisedBedPositionIndices = Array.from(
    { length: 18 },
    (_, index) => index,
);

const layoutDefinitions: LayoutDefinition[] = [
    {
        id: 'salad-bowl',
        title: 'Salatna zdjela',
        subtitle: 'Listovi, krastavac i rajčica za brze svježe obroke.',
        goal: 'salads',
        care: 'balanced',
        secondaryGoals: ['snacks'],
        highlights: [
            'Salata i špinat pune sredinu.',
            'Rajčica i luk daju okus.',
        ],
        placements: [
            { crop: 'tomato', positionIndex: position(0, 0) },
            { crop: 'lettuce', positionIndex: position(1, 0) },
            { crop: 'onion', positionIndex: position(2, 0) },
            { crop: 'cucumber', positionIndex: position(0, 1) },
            { crop: 'lettuce', positionIndex: position(1, 1) },
            { crop: 'spinach', positionIndex: position(2, 1) },
            { crop: 'spinach', positionIndex: position(1, 2) },
            { crop: 'tomato', positionIndex: position(0, 3) },
            { crop: 'lettuce', positionIndex: position(1, 3) },
            { crop: 'spinach', positionIndex: position(2, 3) },
            { crop: 'cucumber', positionIndex: position(0, 4) },
            { crop: 'onion', positionIndex: position(2, 4) },
        ],
    },
    {
        id: 'summer-kitchen',
        title: 'Ljetna kuhinja',
        subtitle: 'Rajčica, paprika i luk kao baza za umake, tave i roštilj.',
        goal: 'cooking',
        care: 'varied',
        secondaryGoals: ['salads'],
        highlights: [
            'Rajčica i paprika nose okus.',
            'Mrkva i krastavac čuvaju raznolikost.',
        ],
        placements: [
            { crop: 'tomato', positionIndex: position(0, 0) },
            { crop: 'pepper', positionIndex: position(1, 0) },
            { crop: 'onion', positionIndex: position(2, 0) },
            { crop: 'tomato', positionIndex: position(0, 1) },
            { crop: 'pepper', positionIndex: position(1, 1) },
            { crop: 'carrot', positionIndex: position(2, 1) },
            { crop: 'cucumber', positionIndex: position(1, 2) },
            { crop: 'tomato', positionIndex: position(0, 3) },
            { crop: 'pepper', positionIndex: position(1, 3) },
            { crop: 'carrot', positionIndex: position(2, 3) },
            { crop: 'cucumber', positionIndex: position(1, 4) },
            { crop: 'onion', positionIndex: position(2, 4) },
        ],
    },
    {
        id: 'snack-path',
        title: 'Staza za grickanje',
        subtitle: 'Mrkva i krastavac s malo rajčice za usputnu berbu.',
        goal: 'snacks',
        care: 'easy',
        secondaryGoals: ['salads'],
        highlights: [
            'Mrkva je raspoređena u malim skupinama.',
            'Krastavac i salata daju svježinu.',
        ],
        placements: [
            { crop: 'carrot', positionIndex: position(0, 0) },
            { crop: 'lettuce', positionIndex: position(1, 0) },
            { crop: 'carrot', positionIndex: position(2, 0) },
            { crop: 'cucumber', positionIndex: position(0, 1) },
            { crop: 'tomato', positionIndex: position(1, 1) },
            { crop: 'carrot', positionIndex: position(2, 1) },
            { crop: 'carrot', positionIndex: position(0, 2) },
            { crop: 'cucumber', positionIndex: position(0, 3) },
            { crop: 'lettuce', positionIndex: position(1, 3) },
            { crop: 'tomato', positionIndex: position(0, 4) },
            { crop: 'cucumber', positionIndex: position(1, 4) },
            { crop: 'pepper', positionIndex: position(1, 5) },
        ],
    },
    {
        id: 'calm-harvest',
        title: 'Mirna berba',
        subtitle: 'Brokula, špinat, mrkva i luk za jednostavnije održavanje.',
        goal: 'autumn',
        care: 'easy',
        secondaryGoals: ['cooking'],
        highlights: [
            'Robusnije kulture su u prednosti.',
            'Šest praznih polja ostaje za tvoje ideje.',
        ],
        placements: [
            { crop: 'broccoli', positionIndex: position(0, 0) },
            { crop: 'spinach', positionIndex: position(1, 0) },
            { crop: 'onion', positionIndex: position(2, 0) },
            { crop: 'carrot', positionIndex: position(0, 1) },
            { crop: 'spinach', positionIndex: position(1, 1) },
            { crop: 'onion', positionIndex: position(2, 1) },
            { crop: 'lettuce', positionIndex: position(0, 2) },
            { crop: 'broccoli', positionIndex: position(2, 2) },
            { crop: 'spinach', positionIndex: position(0, 3) },
            { crop: 'carrot', positionIndex: position(2, 3) },
            { crop: 'lettuce', positionIndex: position(1, 4) },
            { crop: 'onion', positionIndex: position(1, 5) },
        ],
    },
];

export function resolveRaisedBedOnboardingCrops(
    sorts: RaisedBedOnboardingPlantSortCandidate[] | null | undefined,
) {
    const availableSorts = sorts?.filter(
        (sort) => sort.store?.availableInStore,
    );
    const crops: Partial<
        Record<RaisedBedOnboardingCropKey, RaisedBedOnboardingCrop>
    > = {};

    for (const definition of cropDefinitions) {
        const plantSorts =
            availableSorts?.filter(
                (sort) =>
                    sort.information.plant.information?.name ===
                    definition.plantName,
            ) ?? [];
        const prioritizedSort =
            definition.prioritySortIds
                .map((sortId) => plantSorts.find((sort) => sort.id === sortId))
                .find((sort) => sort !== undefined) ?? plantSorts[0];

        if (!prioritizedSort) {
            continue;
        }

        crops[definition.key] = {
            key: definition.key,
            label: definition.label,
            plantName: definition.plantName,
            sort: prioritizedSort,
            sortId: prioritizedSort.id,
            sortName: prioritizedSort.information.name ?? definition.label,
        };
    }

    return crops;
}

function layoutScore(
    layout: LayoutDefinition,
    goal: RaisedBedOnboardingGoal,
    care: RaisedBedOnboardingCare,
) {
    const goalScore =
        layout.goal === goal
            ? 30
            : layout.secondaryGoals.includes(goal)
              ? 12
              : 0;
    const careScore = layout.care === care ? 8 : 0;

    return goalScore + careScore;
}

function layoutHasAvailableCrops(
    layout: LayoutDefinition,
    crops: Partial<Record<RaisedBedOnboardingCropKey, RaisedBedOnboardingCrop>>,
) {
    return layout.placements.every((placement) => crops[placement.crop]);
}

function hasRelationshipReferences(
    relationships: RaisedBedOnboardingPlantRelationships | undefined,
) {
    return (
        (relationships?.companions?.length ?? 0) > 0 ||
        (relationships?.antagonists?.length ?? 0) > 0
    );
}

function cropPlantId(crop: RaisedBedOnboardingCrop) {
    return crop.sort.information.plant.id ?? null;
}

function cropRelationships(crop: RaisedBedOnboardingCrop) {
    return hasRelationshipReferences(crop.sort.relationships)
        ? crop.sort.relationships
        : crop.sort.information.plant.relationships;
}

function hasAntagonistRelationship(
    crop: RaisedBedOnboardingCrop,
    neighborCrop: RaisedBedOnboardingCrop,
) {
    const cropId = cropPlantId(crop);
    const neighborCropId = cropPlantId(neighborCrop);
    if (cropId === null || neighborCropId === null) {
        return false;
    }

    const cropAntagonistIds = new Set(
        cropRelationships(crop)?.antagonists?.map(
            (relationship) => relationship.id,
        ) ?? [],
    );
    const neighborCropAntagonistIds = new Set(
        cropRelationships(neighborCrop)?.antagonists?.map(
            (relationship) => relationship.id,
        ) ?? [],
    );

    return (
        cropAntagonistIds.has(neighborCropId) ||
        neighborCropAntagonistIds.has(cropId)
    );
}

function hasCompanionRelationship(
    crop: RaisedBedOnboardingCrop,
    neighborCrop: RaisedBedOnboardingCrop,
) {
    const cropId = cropPlantId(crop);
    const neighborCropId = cropPlantId(neighborCrop);
    if (cropId === null || neighborCropId === null) {
        return false;
    }

    const cropCompanionIds = new Set(
        cropRelationships(crop)?.companions?.map(
            (relationship) => relationship.id,
        ) ?? [],
    );
    const neighborCropCompanionIds = new Set(
        cropRelationships(neighborCrop)?.companions?.map(
            (relationship) => relationship.id,
        ) ?? [],
    );

    return (
        cropCompanionIds.has(neighborCropId) ||
        neighborCropCompanionIds.has(cropId)
    );
}

function layoutHasAntagonistNeighbors(
    placements: RaisedBedOnboardingResolvedPlacement[],
) {
    const placementsByPosition = new Map(
        placements.map((placement) => [placement.positionIndex, placement]),
    );

    for (const placement of placements) {
        for (const neighborPositionIndex of getRaisedBedNeighborPositionIndices(
            {
                positionIndex: placement.positionIndex,
            },
        )) {
            if (placement.positionIndex > neighborPositionIndex) {
                continue;
            }

            const neighborPlacement = placementsByPosition.get(
                neighborPositionIndex,
            );
            if (
                neighborPlacement &&
                hasAntagonistRelationship(
                    placement.cropDetails,
                    neighborPlacement.cropDetails,
                )
            ) {
                return true;
            }
        }
    }

    return false;
}

function layoutCompanionNeighborCount(
    placements: RaisedBedOnboardingResolvedPlacement[],
) {
    const placementsByPosition = new Map(
        placements.map((placement) => [placement.positionIndex, placement]),
    );
    let count = 0;

    for (const placement of placements) {
        for (const neighborPositionIndex of getRaisedBedNeighborPositionIndices(
            {
                positionIndex: placement.positionIndex,
            },
        )) {
            if (placement.positionIndex > neighborPositionIndex) {
                continue;
            }

            const neighborPlacement = placementsByPosition.get(
                neighborPositionIndex,
            );
            if (
                neighborPlacement &&
                hasCompanionRelationship(
                    placement.cropDetails,
                    neighborPlacement.cropDetails,
                )
            ) {
                count += 1;
            }
        }
    }

    return count;
}

export function getRaisedBedOnboardingLayouts({
    care,
    crops,
    goal,
}: {
    care: RaisedBedOnboardingCare;
    crops: Partial<Record<RaisedBedOnboardingCropKey, RaisedBedOnboardingCrop>>;
    goal: RaisedBedOnboardingGoal;
}) {
    const layouts = layoutDefinitions
        .filter((layout) => layoutHasAvailableCrops(layout, crops))
        .map((layout) => {
            const occupiedPositions = new Set(
                layout.placements.map((placement) => placement.positionIndex),
            );
            const emptyPositionIndices = allRaisedBedPositionIndices.filter(
                (positionIndex) => !occupiedPositions.has(positionIndex),
            );
            const placements = layout.placements.flatMap((placement) => {
                const cropDetails = crops[placement.crop];
                return cropDetails
                    ? [
                          {
                              ...placement,
                              cropDetails,
                          },
                      ]
                    : [];
            });

            return {
                id: layout.id,
                title: layout.title,
                subtitle: layout.subtitle,
                goal: layout.goal,
                care: layout.care,
                highlights: layout.highlights,
                placements,
                emptyPositionIndices,
                companionNeighborCount:
                    layoutCompanionNeighborCount(placements),
                score: layoutScore(layout, goal, care),
            };
        });
    const compatibleLayouts = layouts.filter(
        (layout) => !layoutHasAntagonistNeighbors(layout.placements),
    );

    return compatibleLayouts
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            if (right.companionNeighborCount !== left.companionNeighborCount) {
                return (
                    right.companionNeighborCount - left.companionNeighborCount
                );
            }

            return left.title.localeCompare(right.title, 'hr-HR');
        })
        .map(
            ({
                companionNeighborCount: _companionNeighborCount,
                score: _score,
                ...layout
            }) => layout,
        );
}
