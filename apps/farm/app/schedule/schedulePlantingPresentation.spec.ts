import { expect, test } from '@playwright/experimental-ct-react';
import {
    buildFarmSchedulePlantingLabel,
    buildFarmScheduleSelectedPlantingLabel,
} from './schedulePlantingPresentation';

test('labels a legacy task with the current catalogue recommendation', () => {
    expect(
        buildFarmSchedulePlantingLabel({
            plantName: 'Peršin lisnati',
            recommendedPlantCount: 36,
            sowingLocation: 'raisedBed',
        }),
    ).toBe('Sijanje: Peršin lisnati · preporučeno 36 biljaka po polju');
});

test('marks the quantity unknown when the catalogue has no recommendation', () => {
    expect(
        buildFarmSchedulePlantingLabel({
            plantName: 'Salata',
            recommendedPlantCount: null,
            sowingLocation: 'greenhouse',
        }),
    ).toBe('Sijanje u stakleniku: Salata · broj biljaka nije zabilježen');
});

test('labels a selected planting from its persisted footprint and spacing snapshot', () => {
    expect(
        buildFarmScheduleSelectedPlantingLabel({
            plantCount: 16,
            plantName: 'Mrkva',
            plantsPerAxis: 4,
            selectedSeedingDistanceCm: 7.5,
            sowingLocation: 'direct',
            spanColumns: 1,
            spanRows: 1,
        }),
    ).toBe(
        'Sijanje: Mrkva · 1 × 1 polja · gustoća 4 × 4 · ukupno 16 biljaka · razmak 7.5 cm',
    );
});
