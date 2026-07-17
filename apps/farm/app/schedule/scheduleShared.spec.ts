import type { EntityStandardized } from '@gredice/storage';
import { expect, test } from '@playwright/test';
import {
    isHarvestOperationData,
    isWateringOperationData,
    shouldDisplayScheduleOperation,
} from './scheduleShared';

const wateringOperationData = {
    id: 167,
    attributes: {
        visualReward: 'watering',
        stage: {
            id: 1,
            information: {
                name: 'maintenance',
                label: 'Održavanje',
            },
        },
    },
} satisfies EntityStandardized;

const harvestOperationData = {
    id: 169,
    attributes: {
        visualReward: 'harvest',
        stage: {
            id: 1,
            information: {
                name: 'maintenance',
                label: 'Održavanje',
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

test('identifies watering from its visual reward regardless of plant stage', () => {
    expect(isWateringOperationData(wateringOperationData)).toBe(true);
    expect(isWateringOperationData(maintenanceOperationData)).toBe(false);
    expect(isWateringOperationData(undefined)).toBe(false);
});

test('identifies harvest from its visual reward regardless of plant stage', () => {
    expect(isHarvestOperationData(harvestOperationData)).toBe(true);
    expect(isHarvestOperationData(maintenanceOperationData)).toBe(false);
    expect(isHarvestOperationData(undefined)).toBe(false);
});

test('moves only raised-bed watering and harvest into grouped schedule sections', () => {
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
            'withoutGroupedOperations',
        ),
    ).toBe(false);
    expect(
        shouldDisplayScheduleOperation(
            raisedBedOperation,
            harvestOperationData,
            'harvest',
        ),
    ).toBe(true);
    expect(
        shouldDisplayScheduleOperation(
            raisedBedOperation,
            harvestOperationData,
            'watering',
        ),
    ).toBe(false);
    expect(
        shouldDisplayScheduleOperation(
            raisedBedOperation,
            harvestOperationData,
            'withoutGroupedOperations',
        ),
    ).toBe(false);
    expect(
        shouldDisplayScheduleOperation(
            raisedBedOperation,
            maintenanceOperationData,
            'withoutGroupedOperations',
        ),
    ).toBe(true);
    expect(
        shouldDisplayScheduleOperation(
            farmOperation,
            harvestOperationData,
            'withoutGroupedOperations',
        ),
    ).toBe(true);
});
