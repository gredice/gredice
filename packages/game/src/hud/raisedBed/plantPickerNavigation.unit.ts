import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
