import type { PlantCatalogueItem } from '@apps/www/app/biljke/plantCatalogue';
import type { PlantArchiveFilterDefaults } from '@apps/www/app/biljke/usePlantArchiveFilters';

function plant(
    id: number,
    name: string,
    latinName: string,
    image: string,
    perPlant: number,
    attributes: NonNullable<PlantCatalogueItem['attributes']>,
    calendar: PlantCatalogueItem['calendar'],
    availableInStore = true,
): PlantCatalogueItem {
    return {
        id,
        information: { name, label: name, alternativeName: [], latinName },
        image: {
            cover: {
                url: `https://cdn.gredice.com/entity-attributes/${image}`,
            },
        },
        attributes,
        prices: { perPlant },
        store: { availableInStore },
        isRecommended: false,
        calendar,
        sortNames: [],
    };
}

/** Real catalogue entries (November 2026) covering in-season, unavailable and wrapping windows. */
export const plantArchiveStoryPlants: PlantCatalogueItem[] = [
    plant(
        149,
        'Češnjak',
        'Allium sativum',
        '2d6f971f-fd42-4849-b157-ece3b519fb0d-garlic-realistic-340.png',
        3.99,
        {
            seedingDistance: 15,
            yieldMin: 40,
            yieldMax: 80,
            yieldType: 'perPlant',
            growthWindowMin: 240,
            growthWindowMax: 300,
        },
        {
            propagating: [],
            sowing: [
                { start: 10, end: 12 },
                { start: 2, end: 4 },
            ],
            planting: [],
            harvest: [{ start: 6, end: 9 }],
        },
    ),
    plant(
        791,
        'Hren',
        'Armoracia rusticana',
        'a213a56c-d22f-43de-b73e-cb04862f84db-791-hren.png',
        3.99,
        {
            seedingDistance: 40,
            yieldMin: 150,
            yieldMax: 500,
            yieldType: 'perPlant',
            growthWindowMin: 180,
            growthWindowMax: 210,
        },
        {
            propagating: [],
            sowing: [
                { start: 3, end: 4 },
                { start: 10, end: 11 },
            ],
            planting: [
                { start: 3, end: 4 },
                { start: 10, end: 11 },
            ],
            harvest: [{ start: 10, end: 11 }],
        },
        false,
    ),
    plant(
        512,
        'Kelj pupčar',
        'Brassica oleracea var. gemmifera',
        'b0a2148c-d13a-4623-8490-b2032eb82e0a-kelj-pupcar.png',
        4.99,
        {
            seedingDistance: 60,
            yieldMin: 500,
            yieldMax: 1300,
            yieldType: 'perPlant',
            growthWindowMin: 90,
            growthWindowMax: 130,
        },
        {
            propagating: [{ start: 3, end: 6 }],
            sowing: [{ start: 5, end: 6 }],
            planting: [{ start: 5, end: 8 }],
            harvest: [{ start: 10, end: 1 }],
        },
    ),
    plant(
        3,
        'Mrkva',
        'Daucus carota',
        '531559b2-c85e-474e-9b31-b03f773d4f77-carrot-realistic-340.png',
        1.99,
        {
            seedingDistance: 7.5,
            yieldMin: 25,
            yieldMax: 100,
            yieldType: 'perPlant',
            growthWindowMin: 60,
            growthWindowMax: 80,
        },
        {
            propagating: [],
            sowing: [
                { start: 8.5, end: 9 },
                { start: 3, end: 7 },
            ],
            planting: [],
            harvest: [{ start: 6.5, end: 11 }],
        },
    ),
    plant(
        7,
        'Rajčica',
        'Solanum lycopersicum',
        '4b222ee1-2411-485c-9732-aab8c7d4a204-tomato-realistic-340.png',
        3.99,
        {
            seedingDistance: 30,
            yieldMin: 2000,
            yieldMax: 5000,
            yieldType: 'perPlant',
            growthWindowMin: 60,
            growthWindowMax: 90,
        },
        {
            propagating: [{ start: 3, end: 6 }],
            sowing: [{ start: 5, end: 6 }],
            planting: [{ start: 4, end: 7 }],
            harvest: [{ start: 7, end: 11 }],
        },
    ),
    plant(
        156,
        'Salata',
        'Lactuca sativa L',
        '8319ee8f-6fcc-4543-a8cd-9f5b1e723504-lettuce-realistic-340.png',
        2.99,
        {
            seedingDistance: 15,
            yieldMin: 200,
            yieldMax: 1000,
            yieldType: 'perField',
            growthWindowMin: 45,
            growthWindowMax: 60,
        },
        {
            propagating: [
                { start: 2, end: 7 },
                { start: 8, end: 10 },
            ],
            sowing: [{ start: 2.5, end: 9 }],
            planting: [
                { start: 4, end: 8 },
                { start: 9, end: 10 },
            ],
            harvest: [{ start: 5, end: 12 }],
        },
    ),
];

export function plantArchiveStoryFilters(
    currentMonth: number,
): PlantArchiveFilterDefaults {
    return {
        currentMonth,
        initialActivity: '',
        initialMonth: '',
        initialSearch: '',
        initialSeedTimeFilter: '',
    };
}
