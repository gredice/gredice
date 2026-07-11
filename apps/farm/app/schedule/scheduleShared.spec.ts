import type { EntityStandardized } from '@gredice/storage';
import { expect, test } from '@playwright/test';
import {
    isWateringOperationData,
    shouldDisplayScheduleOperation,
} from './scheduleShared';

const wateringOperationData = {
    id: 167,
    attributes: {
        stage: {
            id: 1,
            information: {
                name: 'watering',
                label: 'Zalijevanje',
            },
        },
    },
} satisfies EntityStandardized;

const maintenanceOperationData = {
    id: 12,
    attributes: {
        stage: {
            id: 2,
            information: {
                name: 'maintenance',
                label: 'Održavanje',
            },
        },
    },
} satisfies EntityStandardized;

test('identifies watering from the operation stage', () => {
    expect(isWateringOperationData(wateringOperationData)).toBe(true);
    expect(isWateringOperationData(maintenanceOperationData)).toBe(false);
    expect(isWateringOperationData(undefined)).toBe(false);
});

test('moves only raised-bed watering into the grouped schedule section', () => {
    const raisedBedOperation = { raisedBedId: 42 };
    const farmOperation = { raisedBedId: null };

    expect(
        shouldDisplayScheduleOperation(
            raisedBedOperation,
            wateringOperationData,
            'watering',
        ),
    ).toBe(true);
    expect(
        shouldDisplayScheduleOperation(
            raisedBedOperation,
            wateringOperationData,
            'withoutWatering',
        ),
    ).toBe(false);
    expect(
        shouldDisplayScheduleOperation(
            raisedBedOperation,
            maintenanceOperationData,
            'withoutWatering',
        ),
    ).toBe(true);
    expect(
        shouldDisplayScheduleOperation(
            farmOperation,
            wateringOperationData,
            'withoutWatering',
        ),
    ).toBe(true);
});
