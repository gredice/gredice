import { expect, test } from '@playwright/test';
import { buildSelectedPlantingSowingLabels } from './selectedPlantingSowingLabels';

test('prints one selected density label from the immutable plant count', () => {
    expect(
        buildSelectedPlantingSowingLabels([
            {
                dateLabel: '12.08.2026.',
                physicalPositionNumbers: [7],
                plantCount: 4,
                plantSortName: 'Bosiljak',
                raisedBedPhysicalId: '42',
                sowingLocation: 'greenhouse',
            },
        ]),
    ).toEqual([
        {
            dateLabel: '12.08.2026.',
            detailLabel: '4 KOMADA',
            fieldLabel: '7',
            plantSortName: 'Bosiljak',
            raisedBedPhysicalId: '42',
        },
    ]);
});

test('prints an exact non-contiguous physical footprint for one 2x2 planting', () => {
    expect(
        buildSelectedPlantingSowingLabels([
            {
                dateLabel: '12.08.2026.',
                physicalPositionNumbers: [5, 1, 4, 2],
                plantCount: 1,
                plantSortName: 'Tikvica',
                raisedBedPhysicalId: '42',
                sowingLocation: 'greenhouse',
            },
        ]),
    ).toEqual([
        {
            dateLabel: '12.08.2026.',
            detailLabel: '1 KOMAD',
            fieldLabel: '1, 2, 4, 5',
            plantSortName: 'Tikvica',
            raisedBedPhysicalId: '42',
        },
    ]);
});

test('retains the printer limit without multiplying the logical task', () => {
    expect(
        buildSelectedPlantingSowingLabels([
            {
                dateLabel: '12.08.2026.',
                physicalPositionNumbers: [3],
                plantCount: 25,
                plantSortName: 'Mrkva',
                raisedBedPhysicalId: '42',
                sowingLocation: 'greenhouse',
            },
        ]).map((label) => label.detailLabel),
    ).toEqual(['24 KOMADA', '1 KOMAD']);
});

test('does not print direct-sowing or malformed selected snapshots', () => {
    expect(
        buildSelectedPlantingSowingLabels([
            {
                dateLabel: '12.08.2026.',
                physicalPositionNumbers: [1],
                plantCount: 4,
                plantSortName: 'Bosiljak',
                raisedBedPhysicalId: '42',
                sowingLocation: 'direct',
            },
            {
                dateLabel: '12.08.2026.',
                physicalPositionNumbers: [1, 1],
                plantCount: 4,
                plantSortName: 'Bosiljak',
                raisedBedPhysicalId: '42',
                sowingLocation: 'greenhouse',
            },
        ]),
    ).toEqual([]);
});
