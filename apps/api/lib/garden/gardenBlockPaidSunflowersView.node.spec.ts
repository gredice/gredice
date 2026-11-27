import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createGardenBlockPaidSunflowersById,
    withGardenBlockPaidSunflowers,
} from './gardenBlockPaidSunflowersView';

const stacks = {
    '0': {
        '0': [
            { id: 'grass', name: 'Block_Grass', rotation: 0 },
            { id: 'bush', name: 'Bush', rotation: 1 },
        ],
    },
    '-2': {
        '3': [{ id: 'legacy', name: 'Block_Grass', rotation: 0 }],
    },
};

test('garden owners see the price paid for each block', () => {
    const paid = createGardenBlockPaidSunflowersById([
        { id: 'grass', paidSunflowers: 10 },
        { id: 'bush', paidSunflowers: 0 },
        { id: 'legacy', paidSunflowers: null },
    ]);

    assert.deepStrictEqual(withGardenBlockPaidSunflowers(stacks, paid), {
        '0': {
            '0': [
                {
                    id: 'grass',
                    name: 'Block_Grass',
                    rotation: 0,
                    paidSunflowers: 10,
                },
                { id: 'bush', name: 'Bush', rotation: 1, paidSunflowers: 0 },
            ],
        },
        '-2': {
            '3': [
                {
                    id: 'legacy',
                    name: 'Block_Grass',
                    rotation: 0,
                    paidSunflowers: null,
                },
            ],
        },
    });
});

test('other viewers get no paid prices', () => {
    const view = withGardenBlockPaidSunflowers(stacks, null);

    for (const column of Object.values(view)) {
        for (const blocks of Object.values(column)) {
            for (const block of blocks) {
                assert.equal(block.paidSunflowers, null);
            }
        }
    }
});

test('blocks missing from the price map read as unknown', () => {
    const view = withGardenBlockPaidSunflowers(
        stacks,
        createGardenBlockPaidSunflowersById([
            { id: 'grass', paidSunflowers: 10 },
        ]),
    );

    assert.equal(view['0']?.['0']?.[1]?.paidSunflowers, null);
    assert.equal(view['-2']?.['3']?.[0]?.paidSunflowers, null);
});

test('the input stacks are not changed', () => {
    const before = JSON.stringify(stacks);
    withGardenBlockPaidSunflowers(
        stacks,
        createGardenBlockPaidSunflowersById([
            { id: 'grass', paidSunflowers: 10 },
        ]),
    );
    assert.equal(JSON.stringify(stacks), before);
});
