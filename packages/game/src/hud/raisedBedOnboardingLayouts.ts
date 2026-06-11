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

export type RaisedBedOnboardingPlantSortCandidate = {
    id: number;
    information: {
        name?: string | null;
        plant: {
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

const commonEmptyPositions = [
    position(0, 2),
    position(2, 2),
    position(1, 4),
    position(0, 5),
    position(1, 5),
    position(2, 5),
];

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
            { crop: 'cucumber', positionIndex: position(0, 4) },
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
            { crop: 'pepper', positionIndex: position(1, 2) },
            { crop: 'cucumber', positionIndex: position(0, 3) },
            { crop: 'lettuce', positionIndex: position(1, 3) },
            { crop: 'carrot', positionIndex: position(2, 3) },
            { crop: 'tomato', positionIndex: position(0, 4) },
            { crop: 'cucumber', positionIndex: position(2, 4) },
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
            { crop: 'lettuce', positionIndex: position(1, 2) },
            { crop: 'broccoli', positionIndex: position(0, 3) },
            { crop: 'spinach', positionIndex: position(1, 3) },
            { crop: 'carrot', positionIndex: position(2, 3) },
            { crop: 'lettuce', positionIndex: position(0, 4) },
            { crop: 'onion', positionIndex: position(2, 4) },
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

export function getRaisedBedOnboardingLayouts({
    care,
    crops,
    goal,
}: {
    care: RaisedBedOnboardingCare;
    crops: Partial<Record<RaisedBedOnboardingCropKey, RaisedBedOnboardingCrop>>;
    goal: RaisedBedOnboardingGoal;
}) {
    return layoutDefinitions
        .filter((layout) => layoutHasAvailableCrops(layout, crops))
        .map((layout) => {
            const occupiedPositions = new Set(
                layout.placements.map((placement) => placement.positionIndex),
            );
            const emptyPositionIndices = commonEmptyPositions.filter(
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
                score: layoutScore(layout, goal, care),
            };
        })
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            return left.title.localeCompare(right.title, 'hr-HR');
        })
        .map(({ score: _score, ...layout }) => layout);
}
