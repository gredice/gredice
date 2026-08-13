import { expect, test } from '@playwright/experimental-ct-react';
import {
    buildFarmSchedulePlantingLabel,
    buildFarmScheduleSelectedPlantingLabel,
} from './schedulePlantingPresentation';

test('labels an exact canonical legacy task without deriving current catalogue density', () => {
    expect(
        buildFarmSchedulePlantingLabel({
            hasCanonicalLegacyPlanting: true,
            plantName: 'Tikvica',
            sowingLocation: 'raisedBed',
        }),
    ).toBe('Sijanje: Tikvica · naslijeđeni raspored nije zabilježen');
});

test('keeps an unprojected legacy field task while marking its quantity unknown', () => {
    expect(
        buildFarmSchedulePlantingLabel({
            hasCanonicalLegacyPlanting: false,
            plantName: 'Salata',
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
