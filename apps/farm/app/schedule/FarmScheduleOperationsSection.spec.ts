import { expect, test } from '@playwright/test';
import { compareRaisedBedScheduleOperations } from './FarmScheduleOperationsSection';

test('keeps same-day raised-bed operations in physical walking order', () => {
    const scheduledDate = new Date('2026-07-17T08:00:00.000Z');
    const operations = [
        {
            label: 'Abecedno prva radnja',
            positionNumber: 9,
            scheduledDate,
        },
        {
            label: 'Zadnja radnja po nazivu',
            positionNumber: 1,
            scheduledDate,
        },
        {
            label: 'Radnja za cijelu gredicu',
            positionNumber: null,
            scheduledDate,
        },
    ];

    expect(
        operations
            .toSorted(compareRaisedBedScheduleOperations)
            .map((operation) => operation.positionNumber),
    ).toEqual([1, 9, null]);
});

test('keeps schedule date ahead of physical position and label', () => {
    const operations = [
        {
            label: 'Kasnija abecedno prva radnja',
            positionNumber: 1,
            scheduledDate: new Date('2026-07-18T08:00:00.000Z'),
        },
        {
            label: 'Ranija radnja',
            positionNumber: 9,
            scheduledDate: new Date('2026-07-17T08:00:00.000Z'),
        },
    ];

    expect(
        operations
            .toSorted(compareRaisedBedScheduleOperations)
            .map((operation) => operation.label),
    ).toEqual(['Ranija radnja', 'Kasnija abecedno prva radnja']);
});
