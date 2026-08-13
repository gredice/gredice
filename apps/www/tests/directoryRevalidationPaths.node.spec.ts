import assert from 'node:assert/strict';
import test from 'node:test';
import { collectRevalidationPaths } from '../app/api/revalidate/directories/revalidationPaths.ts';

test('seed changes revalidate plant-sort pages that render seed cards', () => {
    assert.ok(
        collectRevalidationPaths(['seed']).some(
            ({ path, type }) =>
                path === '/biljke/[alias]/sorte/[sortAlias]' && type === 'page',
        ),
    );
});

test('combined entity changes keep shared revalidation paths unique', () => {
    const paths = collectRevalidationPaths(['plantSort', 'seed']);
    const pathKeys = paths.map(({ path, type }) => `${type ?? 'path'}:${path}`);

    assert.equal(new Set(pathKeys).size, pathKeys.length);
});
