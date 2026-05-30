import type { PlantData, PlantSortData } from '@gredice/client';
import * as ReactQuery from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { PlantPicker } from '../../../packages/game/src/hud/raisedBed/RaisedBedPlantPicker';

const now = '2026-05-13T00:00:00.000Z';

const tomatoPlant = {
    id: 1,
    entityType: {
        id: 1,
        name: 'plant',
        label: 'Biljka',
    },
    slug: 'mock-tomato',
    calendar: {
        harvest: [],
    },
    information: {
        name: 'Rajčica',
        alternativeName: ['Paradajz', 'Pomidor'],
        latinName: 'Solanum lycopersicum',
        origin: 'Mock',
        description: 'Mock plant for sowing picker tests.',
        soilPreparation: '',
        growth: '',
        maintenance: '',
        watering: '',
        harvest: '',
        storage: '',
        operations: [],
    },
    attributes: {
        yieldMin: 1000,
        yieldMax: 2000,
        harvestWindowMin: 1,
        harvestWindowMax: 2,
        soil: 'Srednje',
        light: 1,
        seedingDepth: 1,
        nutrients: 'Srednje',
        water: 'Vlažno',
        seedingDistance: 30,
        germinationType: 'Klijanje pod svijetlosti',
        gernimationTemperature: 20,
        germinationWindowMin: 5,
        germinationWindowMax: 10,
        growthWindowMin: 60,
        growthWindowMax: 90,
        yieldType: 'perField',
        cleanHarvest: true,
    },
    image: {
        cover: {
            url: '',
        },
    },
    prices: {
        perPlant: 1.5,
    },
    store: {
        availableInStore: true,
    },
    createdAt: now,
    updatedAt: now,
    isRecommended: true,
} satisfies PlantData & { isRecommended: boolean };

const basilPlant = {
    ...tomatoPlant,
    id: 2,
    slug: 'mock-basil',
    information: {
        ...tomatoPlant.information,
        name: 'Bosiljak',
        alternativeName: ['Bazilikum'],
        latinName: 'Ocimum basilicum',
    },
    isRecommended: false,
} satisfies PlantData & { isRecommended: boolean };

const tomatoSort = {
    id: 101,
    entityType: {
        id: 11,
        name: 'plantSort',
        label: 'Sorta biljke',
    },
    slug: 'mock-cherry-tomato',
    information: {
        plant: tomatoPlant,
        name: 'Cherry rajčica',
        shortDescription: 'Mock plant sort.',
    },
    image: {
        cover: {
            url: '',
        },
    },
    store: {
        availableInStore: true,
    },
    attributes: {
        reproductionType: 'seed',
    },
    createdAt: now,
    updatedAt: now,
} satisfies PlantSortData;

function createTomatoSort(id: number, name: string, shortDescription: string) {
    return {
        ...tomatoSort,
        id,
        slug: `mock-${id}`,
        information: {
            ...tomatoSort.information,
            name,
            shortDescription,
        },
    } satisfies PlantSortData;
}

const tomatoSorts = [
    tomatoSort,
    createTomatoSort(
        102,
        'Rajčica saint pierre',
        'Klasična visoka rajčica okruglih crvenih plodova, pogodna za svježu potrošnju.',
    ),
    createTomatoSort(
        103,
        'Rajčica scatolone',
        'Unikatna talijanska sorta. Na visokoj i bujnoj stabljici rastu krupni plodovi.',
    ),
    createTomatoSort(
        104,
        'Rajčica Volovsko srce',
        'Sorta kasne rajčice. Biljke su visoke i bujne te zahtijevaju potporu.',
    ),
    createTomatoSort(
        105,
        'Rajčica San Marzano',
        'Duguljasta rajčica punog okusa za umake, salate i ljetnu kuhinju.',
    ),
];

function createPlantPickerQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(
        ['gardens'],
        [{ id: 1, name: 'Mock vrt', isSandbox: false, createdAt: now }],
    );
    queryClient.setQueryData(['shopping-cart'], {
        id: 1,
        items: [],
    });
    queryClient.setQueryData(['inventory'], {
        items: [],
    });
    queryClient.setQueryData(['plants'], [tomatoPlant, basilPlant]);
    queryClient.setQueryData(['sorts'], tomatoSorts);

    return queryClient;
}

function PlantPickerTestProviders({ children }: PropsWithChildren) {
    return (
        <ReactQuery.QueryClientProvider client={createPlantPickerQueryClient()}>
            {children}
        </ReactQuery.QueryClientProvider>
    );
}

export function PlantPickerTestStory() {
    return (
        <PlantPickerTestProviders>
            <PlantPicker
                gardenId={1}
                raisedBedId={1}
                positionIndex={0}
                trigger={<button type="button">Sijanje</button>}
            />
        </PlantPickerTestProviders>
    );
}
