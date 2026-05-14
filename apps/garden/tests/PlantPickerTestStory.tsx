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
    calendar: {
        harvest: [],
    },
    information: {
        name: 'Rajčica',
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
    information: {
        ...tomatoPlant.information,
        name: 'Bosiljak',
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

function createPlantPickerQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['shopping-cart'], {
        id: 1,
        items: [],
    });
    queryClient.setQueryData(['inventory'], {
        items: [],
    });
    queryClient.setQueryData(['plants'], [tomatoPlant, basilPlant]);
    queryClient.setQueryData(['sorts'], [tomatoSort]);

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
