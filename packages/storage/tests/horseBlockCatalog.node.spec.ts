import assert from 'node:assert/strict';
import test from 'node:test';
import {
    horseBlockAttributes,
    horseCatalogPriceSunflowers,
    parseHorseCatalogOptions,
} from '../scripts/lib/horseBlockCatalog';

test('horse catalogue contract matches the authored placement bounds', () => {
    assert.equal(horseBlockAttributes['information.name'], 'Horse');
    assert.equal(horseBlockAttributes['information.label'], 'Konj');
    assert.match(
        horseBlockAttributes['information.fullDescription'],
        /boju dlake/,
    );
    assert.equal(horseBlockAttributes['attributes.height'], '1.46');
    assert.equal(horseBlockAttributes['attributes.hitboxDepth'], '1.86');
    assert.equal(horseBlockAttributes['attributes.hitboxHeight'], '1.46');
    assert.equal(horseBlockAttributes['attributes.hitboxWidth'], '0.76');
    assert.equal(horseBlockAttributes['attributes.placeableOnWater'], 'false');
    assert.equal(horseBlockAttributes['attributes.spanDepth'], '2');
    assert.equal(horseBlockAttributes['attributes.spanWidth'], '1');
    assert.equal(horseBlockAttributes['attributes.stackable'], 'false');
});

test('horse uses the established Ljubimci price and public snapshot', () => {
    assert.equal(horseCatalogPriceSunflowers, '500');
    assert.equal(horseBlockAttributes['prices.sunflowers'], '500');
    assert.deepEqual(JSON.parse(horseBlockAttributes['image.cover']), {
        url: 'https://www.gredice.com/assets/blocks/Horse.webp',
    });
});

test('horse catalogue helper is dry-run by default and guards apply', () => {
    assert.deepEqual(parseHorseCatalogOptions([]), { apply: false });
    assert.deepEqual(parseHorseCatalogOptions(['--']), { apply: false });
    assert.deepEqual(parseHorseCatalogOptions(['--apply']), { apply: true });
    assert.throws(
        () => parseHorseCatalogOptions(['--force']),
        /Unknown argument: --force/,
    );
});
