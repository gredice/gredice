import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getKestenijadaAvailability } from '@gredice/js/kestenijada';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { getKestenijadaCollection } from './kestenijadaCollection';
import {
    getKestenijadaRenderOnlyData,
    kestenijadaSceneNames,
    kestenijadaStacks,
} from './kestenijadaScene';

test('display metadata has only seven exact identities, no sale prices and no published identity', () => {
    const rows = getKestenijadaRenderOnlyData();
    assert.equal(rows.length, 7);
    assert.deepEqual(
        new Set(rows.map((row) => row.information.name)),
        new Set(kestenijadaSceneNames),
    );
    assert.ok(rows.every((row) => row.id < 0 && row.prices.sunflowers === 0));
    assert.ok(
        getKestenijadaAvailability(rows, true).every(
            (entry) => entry.row === null,
        ),
    );
    assert.equal(getKestenijadaCollection(rows, true), null);
    assert.equal(kestenijadaStacks.flatMap((stack) => stack.blocks).length, 25);
});
test('existing chestnuts collection shows only its current published members and hides without eligible cart', () => {
    const rows = getLocalSandboxBlockData().map((row) => ({
        ...row,
        prices: { sunflowers: 10 },
    }));
    const collection = getKestenijadaCollection(rows, false);
    assert.ok(collection);
    assert.ok(
        collection.items.some(
            (item) => item.row.information.name === 'ChestnutRoastingCart',
        ),
    );
    assert.ok(
        !collection.items.some(
            (item) => item.row.information.name === 'StoneWalkway',
        ),
    );
    assert.equal(
        getKestenijadaCollection(
            rows.filter(
                (row) => row.information.name !== 'ChestnutRoastingCart',
            ),
            false,
        ),
        null,
    );
});
