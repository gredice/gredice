import { expect, test } from '@playwright/test';
import { buildGreenhouseTransplantingOperationLabel } from './scheduleOperationPresentation';

const parsley = {
    id: 213,
    information: {
        name: 'Peršin lisnati',
        plant: { id: 148, attributes: { seedingDistance: 5 } },
    },
};

test('shows how many greenhouse seedlings to transplant into the field', () => {
    expect(
        buildGreenhouseTransplantingOperationLabel({
            operationEntityId: 593,
            operationLabel: 'Presađivanje presadnica',
            plantSort: parsley,
            sowingLocation: 'greenhouse',
        }),
    ).toBe(
        'Presađivanje presadnica: Peršin lisnati · presaditi 36 biljaka u polje',
    );
});

test('does not change another operation or a direct-sown plant', () => {
    expect(
        buildGreenhouseTransplantingOperationLabel({
            operationEntityId: 594,
            operationLabel: 'Okopavanje',
            plantSort: parsley,
            sowingLocation: 'greenhouse',
        }),
    ).toBeNull();
    expect(
        buildGreenhouseTransplantingOperationLabel({
            operationEntityId: 593,
            operationLabel: 'Presađivanje presadnica',
            plantSort: parsley,
            sowingLocation: 'direct',
        }),
    ).toBeNull();
});

test('makes a missing transplant count explicit', () => {
    expect(
        buildGreenhouseTransplantingOperationLabel({
            operationEntityId: 593,
            operationLabel: 'Presađivanje presadnica',
            plantSort: {
                id: 214,
                information: { name: 'Salata', plant: { id: 156 } },
            },
            sowingLocation: 'greenhouse',
        }),
    ).toBe(
        'Presađivanje presadnica: Salata · broj biljaka za presađivanje nije zabilježen',
    );
});
