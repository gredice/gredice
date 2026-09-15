import assert from 'node:assert/strict';
import test from 'node:test';
import { croatianDayLabel, croatianPlural } from './croatian.ts';

const forms = { one: 'radnja', few: 'radnje', many: 'radnji' };

test('croatian plural uses the singular form for counts ending in one', () => {
    assert.equal(croatianPlural(1, forms), 'radnja');
    assert.equal(croatianPlural(21, forms), 'radnja');
    assert.equal(croatianPlural(101, forms), 'radnja');
});

test('croatian plural uses the few form for counts ending in two to four', () => {
    assert.equal(croatianPlural(2, forms), 'radnje');
    assert.equal(croatianPlural(4, forms), 'radnje');
    assert.equal(croatianPlural(23, forms), 'radnje');
});

test('croatian plural uses the many form for teens, zero and five upwards', () => {
    assert.equal(croatianPlural(0, forms), 'radnji');
    assert.equal(croatianPlural(5, forms), 'radnji');
    assert.equal(croatianPlural(11, forms), 'radnji');
    assert.equal(croatianPlural(12, forms), 'radnji');
    assert.equal(croatianPlural(14, forms), 'radnji');
    assert.equal(croatianPlural(100, forms), 'radnji');
});

test('croatian day label drops the year inside the current year', () => {
    assert.equal(croatianDayLabel('2026-07-03', 2026), 'petak, 3. srpnja');
});

test('croatian day label keeps the year for other years', () => {
    assert.equal(
        croatianDayLabel('2025-07-03', 2026),
        'četvrtak, 3. srpnja 2025.',
    );
});

test('croatian day label falls back for unusable day keys', () => {
    assert.equal(croatianDayLabel('unknown', 2026), 'Bez datuma');
    assert.equal(croatianDayLabel('2026-13-01', 2026), 'Bez datuma');
});
