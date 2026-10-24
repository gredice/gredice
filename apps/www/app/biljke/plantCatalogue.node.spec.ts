import assert from 'node:assert/strict';
import test from 'node:test';
import { matchingPlantAlternativeName } from '../../lib/plants/plantSearch';
import { normalizeSearchText } from '../../lib/search/normalizeSearchText';
import { publicHtmlGrowthFixture } from '../../tests/publicHtmlGrowthFixture';
import {
    cataloguePlantMatchesSearch,
    matchingCatalogueSortName,
    toPlantCatalogue,
} from './plantCatalogue';

const plant = {
    id: 1,
    information: {
        name: 'Rajčica',
        label: 'Rajčica',
        alternativeName: ['Paradajz', 'Pomidor'],
        description: 'Description only needed on the detail page. '.repeat(
            10_000,
        ),
        operations: [{ unused: 'Large related operation' }],
    },
    image: { cover: { url: 'https://cdn.gredice.com/rajcica.webp' } },
    attributes: {
        seedingDistance: 30,
        yieldMin: 1000,
        yieldMax: 2000,
        yieldType: 'perPlant',
    },
    prices: { perPlant: 1.25 },
    calendar: {
        sowing: [{ start: 3.5, end: 5 }],
        harvest: [{ start: 7, end: 10 }],
        propagating: [{ start: 2, end: 3.5 }],
        planting: [{ start: 5, end: 6 }],
    },
    relationships: { companions: [{ unused: 'Large relationship graph' }] },
    isRecommended: true,
};
const sorts = [
    {
        information: {
            name: 'Volovsko srce',
            plant,
            description: 'Unused sort description'.repeat(10_000),
        },
    },
    { information: { name: 'Šljivar', plant } },
    { information: { name: 'Other plant variety', plant: { id: 2 } } },
];

test('preserves every displayed card field, range and variety without description or relationship graphs', () => {
    const [card] = toPlantCatalogue([plant], sorts);
    assert.ok(card);
    assert.deepEqual(card.information, {
        name: 'Rajčica',
        label: 'Rajčica',
        alternativeName: ['Paradajz', 'Pomidor'],
    });
    assert.deepEqual(card.image, plant.image);
    assert.deepEqual(card.attributes, plant.attributes);
    assert.deepEqual(card.prices, plant.prices);
    assert.deepEqual(card.calendar, plant.calendar);
    assert.deepEqual(card.sortNames, ['Volovsko srce', 'Šljivar']);
    assert.equal(card.isRecommended, true);
    assert.doesNotMatch(
        JSON.stringify(card),
        /description|relationships|operations|Unused/,
    );
    assert.ok(Buffer.byteLength(JSON.stringify(card)) < 1000);
});

test('both views search canonical names, alternate names and varieties with Croatian normalization', () => {
    const [card] = toPlantCatalogue([plant], sorts);
    assert.ok(card);
    for (const query of [
        '',
        'rajcica',
        ' PARADAJZ ',
        'pomidor',
        'volovsko',
        'sljivar',
    ]) {
        assert.equal(
            cataloguePlantMatchesSearch(card, normalizeSearchText(query)),
            true,
            query,
        );
    }
    assert.equal(cataloguePlantMatchesSearch(card, 'not a plant'), false);
    assert.equal(
        cataloguePlantMatchesSearch(card, 'other plant variety'),
        false,
    );
    assert.equal(matchingCatalogueSortName(card, 'sljivar'), 'Šljivar');
    assert.equal(matchingPlantAlternativeName(card, 'pomidor'), 'Pomidor');
    assert.equal(matchingCatalogueSortName(card, ''), undefined);
});

test('growth fixture triples cards and searchable data with unique ids and links', () => {
    const catalogue = toPlantCatalogue([plant], sorts);
    const growth = publicHtmlGrowthFixture(catalogue);
    assert.equal(growth.length, catalogue.length * 3);
    assert.equal(new Set(growth.map(({ id }) => id)).size, growth.length);
    assert.equal(
        new Set(growth.map(({ information }) => information.name)).size,
        growth.length,
    );
    for (const card of growth) {
        assert.deepEqual(card.calendar, plant.calendar);
        assert.deepEqual(card.sortNames, catalogue[0]?.sortNames);
    }
});
