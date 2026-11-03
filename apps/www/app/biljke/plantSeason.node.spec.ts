import assert from 'node:assert/strict';
import test from 'node:test';
import { getCalendarRangeSegments } from './calendarRangePosition';
import { filterPlantArchive } from './plantArchiveFilter';
import { plantArchivePath } from './plantArchivePath';
import {
    compareCataloguePlantNames,
    type PlantCatalogueItem,
} from './plantCatalogue';
import {
    formatPlantCount,
    isPlantHarvestedInMonth,
    isPlantSowableInMonth,
    parsePlantArchiveMonth,
    parsePlantSeasonActivity,
    plantSeasonMonthCounts,
    plantSowingWindowEdge,
    rankSowablePlants,
} from './plantSeason';

function plant(
    name: string,
    calendar: Partial<PlantCatalogueItem['calendar']>,
    availableInStore = true,
): PlantCatalogueItem {
    return {
        id: name.length,
        information: { name, label: name, alternativeName: [], latinName: '' },
        image: { cover: { url: `https://cdn.gredice.com/${name}.webp` } },
        attributes: undefined,
        prices: { perPlant: 1.99 },
        store: { availableInStore },
        isRecommended: false,
        calendar: {
            propagating: [],
            sowing: [],
            planting: [],
            harvest: [],
            ...calendar,
        },
        sortNames: [],
    };
}

// Real catalogue windows: garlic is sown Oct–Dec and Feb–Apr, harvested Jun–Sep;
// tomato is started indoors Mar–Jun.
const garlic = plant('Češnjak', {
    sowing: [
        { start: 10, end: 12 },
        { start: 2, end: 4 },
    ],
    harvest: [{ start: 6, end: 9 }],
});
const tomato = plant('Rajčica', {
    propagating: [{ start: 3, end: 6 }],
    sowing: [{ start: 5, end: 6 }],
    harvest: [{ start: 7, end: 11 }],
});
const kale = plant('Kelj pupčar', {
    sowing: [{ start: 5, end: 6 }],
    harvest: [{ start: 10, end: 1 }],
});
const horseradish = plant('Hren', { sowing: [{ start: 10, end: 11 }] }, false);

test('sowing months follow the "Vrijeme za sijanje" rule for every month', () => {
    assert.equal(isPlantSowableInMonth(garlic, 11), true);
    assert.equal(isPlantSowableInMonth(garlic, 5), false);
    assert.equal(isPlantSowableInMonth(tomato, 3), true);
    assert.equal(isPlantSowableInMonth(tomato, 7), false);
});

test('harvest months include windows that wrap past December', () => {
    assert.equal(isPlantHarvestedInMonth(kale, 12), true);
    assert.equal(isPlantHarvestedInMonth(kale, 1), true);
    assert.equal(isPlantHarvestedInMonth(kale, 2), false);
});

test('month counts reflect the chosen activity', () => {
    const plants = [garlic, tomato, kale];
    const sowing = plantSeasonMonthCounts(plants, 'sijanje');
    const harvest = plantSeasonMonthCounts(plants, 'berba');
    assert.equal(sowing.length, 12);
    assert.equal(sowing[10], 1); // November: garlic
    assert.equal(sowing[4], 2); // May: tomato and kale
    assert.equal(harvest[11], 1); // December: kale
});

test('sowing window edges mark the last and first month', () => {
    assert.equal(plantSowingWindowEdge(horseradish, 11), 'last');
    assert.equal(plantSowingWindowEdge(horseradish, 10), 'first');
    assert.equal(plantSowingWindowEdge(garlic, 11), null);
    assert.equal(plantSowingWindowEdge(garlic, 7), null);
});

test('season panel ranks closing windows first and unavailable plants last', () => {
    const peas = plant('Grašak', { sowing: [{ start: 9, end: 11 }] });
    const ranked = rankSowablePlants(
        [garlic, horseradish, peas, tomato],
        11,
        compareCataloguePlantNames,
    ).map(({ information }) => information.name);
    assert.deepEqual(ranked, ['Grašak', 'Češnjak', 'Hren']);
});

test('archive filter keeps search results for the chart and narrows by month', () => {
    const plants = [tomato, garlic, kale];
    const { searched, filtered } = filterPlantArchive(plants, {
        activity: 'sijanje',
        month: 11,
        search: '',
    });
    assert.deepEqual(
        searched.map(({ information }) => information.name),
        ['Češnjak', 'Kelj pupčar', 'Rajčica'],
    );
    assert.deepEqual(
        filtered.map(({ information }) => information.name),
        ['Češnjak'],
    );
    assert.equal(
        filterPlantArchive(plants, {
            activity: 'berba',
            month: 12,
            search: 'kelj',
        }).filtered.length,
        1,
    );
});

test('month and activity params are validated', () => {
    assert.equal(parsePlantArchiveMonth('11'), 11);
    assert.equal(parsePlantArchiveMonth('13'), null);
    assert.equal(parsePlantArchiveMonth('4.5'), null);
    assert.equal(parsePlantArchiveMonth(''), null);
    assert.equal(parsePlantSeasonActivity('berba'), 'berba');
    assert.equal(parsePlantSeasonActivity('anything'), 'sijanje');
});

test('archive paths carry the month filter and harvest activity', () => {
    assert.equal(
        plantArchivePath({ search: '', month: 5, view: 'popis' }),
        '/biljke?mjesec=5',
    );
    assert.equal(
        plantArchivePath({
            activity: 'berba',
            month: 11,
            search: 'kelj',
            view: 'kalendar',
        }),
        '/biljke?pregled=kalendar&pretraga=kelj&mjesec=11&aktivnost=berba',
    );
});

test('calendar segments split windows that wrap past December', () => {
    const [december, january] = getCalendarRangeSegments([
        { start: 10, end: 1 },
    ]);
    assert.ok(december && january);
    assert.equal(december.start, 9 / 12);
    assert.equal(december.width, 3 / 12);
    assert.equal(january.start, 0);
    assert.equal(january.width, 0.25 / 12);
    assert.deepEqual(getCalendarRangeSegments([{ start: 'x', end: 2 }]), []);
    assert.equal(
        getCalendarRangeSegments([
            { start: 3, end: 6 },
            { start: 3, end: 6 },
        ]).length,
        1,
    );
});

test('plant counts use Croatian plural forms', () => {
    assert.equal(formatPlantCount(1), '1 biljka');
    assert.equal(formatPlantCount(3), '3 biljke');
    assert.equal(formatPlantCount(11), '11 biljaka');
    assert.equal(formatPlantCount(21), '21 biljka');
    assert.equal(formatPlantCount(29), '29 biljaka');
});
