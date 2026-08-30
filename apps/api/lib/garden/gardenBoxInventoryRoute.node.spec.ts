import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const inventoryRoutesSource = readFileSync(
    fileURLToPath(
        new URL('../../app/api/[...route]/inventoryRoutes.ts', import.meta.url),
    ),
    'utf8',
);

test('legacy GardenBox replacement cannot mint inventory from a request payload', () => {
    assert.doesNotMatch(inventoryRoutesSource, /\bsetGardenBoxInventory\b/u);

    const putStart = inventoryRoutesSource.indexOf(
        ".put(\n        '/garden-boxes/:gardenId/:blockId'",
    );
    const nextRoute = inventoryRoutesSource.indexOf('\n    .post(', putStart);
    assert.ok(putStart >= 0 && nextRoute > putStart);

    const putRoute = inventoryRoutesSource.slice(putStart, nextRoute);
    assert.match(putRoute, /GARDEN_BOX_INVENTORY_REPLACEMENT_DISABLED/u);
    assert.match(putRoute, /context\.header\('Allow', 'GET'\)/u);
    assert.match(putRoute, /405/u);
    assert.doesNotMatch(putRoute, /zValidator\('json'/u);
});
