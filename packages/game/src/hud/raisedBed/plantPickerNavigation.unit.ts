import assert from 'node:assert/strict';
import test from 'node:test';
import {
    findEmptyRaisedBedFieldTargets,
    findFirstEmptyRaisedBedField,
    type RaisedBedFieldTargetCartItem,
    type RaisedBedFieldTargetGarden,
} from './plantPickerNavigation';

const garden = {
    id: 1,
    isSandbox: false,
    raisedBeds: [
        {
            blockId: 'raised-bed-1',
            fields: [
                { active: true, plantSortId: 101, positionIndex: 0 },
                { active: false, plantSortId: null, positionIndex: 1 },
                { active: false, plantSortId: null, positionIndex: 2 },
            ],
            id: 11,
            isValid: true,
            name: 'Plavi Vjetar',
            orientation: 'vertical',
            status: 'active',
        },
        {
            blockId: 'raised-bed-2',
            fields: [
                { active: true, plantSortId: 102, positionIndex: 0 },
                { active: false, plantSortId: null, positionIndex: 1 },
            ],
            id: 12,
            isValid: true,
            name: 'Novi Vjetar',
            orientation: 'vertical',
            status: 'new',
        },
    ],
    stacks: [],
} satisfies RaisedBedFieldTargetGarden;

test('findFirstEmptyRaisedBedField skips pending cart plant positions', () => {
    const cartItems = [
        {
            entityTypeName: 'plantSort',
            gardenId: 1,
            positionIndex: 1,
            raisedBedId: 11,
            status: 'new',
        },
    ] satisfies RaisedBedFieldTargetCartItem[];

    assert.deepEqual(findFirstEmptyRaisedBedField(garden, cartItems), {
        positionIndex: 2,
        raisedBedId: 11,
        raisedBedName: 'Plavi Vjetar',
    });
});

test('findEmptyRaisedBedFieldTargets keeps active-only behavior by default', () => {
    assert.deepEqual(findEmptyRaisedBedFieldTargets(garden), [
        {
            positionIndex: 1,
            raisedBedId: 11,
            raisedBedName: 'Plavi Vjetar',
        },
    ]);
});

test('findEmptyRaisedBedFieldTargets includes not-yet-active beds for outlet planting', () => {
    assert.deepEqual(
        findEmptyRaisedBedFieldTargets(garden, null, {
            includeNotYetActiveRaisedBeds: true,
        }),
        [
            {
                positionIndex: 1,
                raisedBedId: 11,
                raisedBedName: 'Plavi Vjetar',
            },
            {
                positionIndex: 1,
                raisedBedId: 12,
                raisedBedName: 'Novi Vjetar',
            },
        ],
    );
});

test('findEmptyRaisedBedFieldTargets can return every eligible field', () => {
    assert.deepEqual(
        findEmptyRaisedBedFieldTargets(garden, null, {
            includeAllFields: true,
        }).map((target) => target.positionIndex),
        Array.from({ length: 17 }, (_, index) => index + 1),
    );
});

test('findEmptyRaisedBedFieldTargets excludes a pending Advanced Sowing footprint', () => {
    const cartItems = [
        {
            advancedSowingSelection: {
                fieldSpanColumns: 2,
                fieldSpanRows: 1,
                kind: 'advanced-sowing-selection-summary',
                layoutKey: 'v1:fields:1x2:plants:1x2',
                occupiedPositionIndices: [1, 2],
                plantCount: 2,
                selectedDistanceCm: 20,
                version: 1,
            },
            entityTypeName: 'plantSort',
            gardenId: 1,
            positionIndex: 1,
            raisedBedId: 11,
            status: 'new',
        },
    ] satisfies RaisedBedFieldTargetCartItem[];

    assert.deepEqual(
        findEmptyRaisedBedFieldTargets(garden, cartItems, {
            includeAllFields: true,
        }).map((target) => target.positionIndex),
        Array.from({ length: 15 }, (_, index) => index + 3),
    );
});

test('findEmptyRaisedBedFieldTargets excludes active selected planting memberships', () => {
    const selectedPlantingGarden: RaisedBedFieldTargetGarden = {
        ...garden,
        raisedBeds: [
            {
                ...garden.raisedBeds[0],
                plantings: [
                    {
                        configurationSource: 'selected',
                        isActive: true,
                        isDeleted: false,
                        memberships: [{ positionIndex: 1 }],
                    },
                ],
            },
        ],
    };

    assert.equal(
        findFirstEmptyRaisedBedField(selectedPlantingGarden)?.positionIndex,
        2,
    );
});
