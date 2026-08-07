import assert from 'node:assert/strict';
import test from 'node:test';
import { getGardenViewModeHref } from './gardenViewMode';

test('switches between garden renderers while preserving the complete query', () => {
    const query = [
        ['vrt', '42'],
        ['gredica', '7'],
        ['filter', 'active'],
        ['filter', 'planned'],
    ] satisfies Array<[string, string]>;

    assert.equal(
        getGardenViewModeHref('3d', query),
        '/pregled-vrta?vrt=42&gredica=7&filter=active&filter=planned',
    );
    assert.equal(
        getGardenViewModeHref('2d', query),
        '/?vrt=42&gredica=7&filter=active&filter=planned',
    );
});

test('does not add an empty query separator', () => {
    assert.equal(getGardenViewModeHref('3d', []), '/pregled-vrta');
    assert.equal(getGardenViewModeHref('2d', []), '/');
});
