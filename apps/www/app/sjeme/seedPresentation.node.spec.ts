import assert from 'node:assert/strict';
import test from 'node:test';
import {
    formatSeedArea,
    formatSeedWeight,
    safeWebsiteUrl,
    seedCountLabel,
    seedGtin13,
    seedMatchesSearch,
} from './seedPresentation.ts';

const seed = {
    information: {
        name: 'Vilmorin Rajčica Cherry 1 g',
        barcode: '1234567890123',
        countryOfOrigin: 'Francuska',
        brand: {
            information: {
                name: 'Vilmorin',
                country: 'Francuska',
            },
        },
        plant: {
            information: {
                name: 'Rajčica',
                latinName: 'Solanum lycopersicum',
            },
        },
        plantSort: {
            information: {
                name: 'Cherry rajčica',
                latinName: 'Solanum lycopersicum var. cerasiforme',
            },
        },
    },
};

test('seed search covers package, brand, plant, sort, barcode, and origin', () => {
    for (const query of [
        'vilmorin',
        'rajcica',
        'cherry',
        'solanum',
        '1234567890123',
        'francuska',
    ]) {
        assert.equal(seedMatchesSearch(seed, query), true, query);
    }
    assert.equal(seedMatchesSearch(seed, 'krastavac'), false);
});

test('seed presentation formats catalogue values in Croatian', () => {
    assert.equal(formatSeedWeight(1.5), '1,5 g');
    assert.equal(formatSeedArea(2.25), '2,25 m²');
    assert.equal(seedCountLabel(1), '1 pakiranje sjemena');
    assert.equal(seedCountLabel(12), '12 pakiranja sjemena');
    assert.equal(seedGtin13(seed), '1234567890123');
    assert.equal(seedGtin13({ information: { barcode: null } }), null);
});

test('brand websites only accept HTTP and HTTPS URLs', () => {
    assert.equal(safeWebsiteUrl('https://example.com'), 'https://example.com/');
    assert.equal(safeWebsiteUrl('javascript:alert(1)'), null);
    assert.equal(safeWebsiteUrl('not a url'), null);
});
