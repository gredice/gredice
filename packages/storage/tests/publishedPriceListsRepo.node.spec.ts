import assert from 'node:assert/strict';
import test from 'node:test';
import {
    events,
    getPublishedPriceList,
    getPublishedPriceLists,
    publishPublicPriceList,
    storage,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('publication is idempotent and preserves immutable archived downloads', async () => {
    createTestDb();
    const first = await publishPublicPriceList();
    const again = await publishPublicPriceList();
    assert.equal(first.id, again.id);
    assert.equal(first.csv, again.csv);
    assert.ok(first.filename.endsWith('.csv'));
    assert.deepEqual(await getPublishedPriceList(first.id), first);
});

test('archive lists 30 days and downloads can only read price-list events', async () => {
    createTestDb();
    const [old, current, privateEvent] = await storage()
        .insert(events)
        .values([
            {
                type: 'pricing.catalog.published',
                aggregateId: 'public-service-price-list',
                version: 1,
                data: { csv: 'old', day: '2026-01-01' },
                createdAt: new Date('2026-01-01'),
            },
            {
                type: 'pricing.catalog.published',
                aggregateId: 'public-service-price-list',
                version: 1,
                data: { csv: 'current', day: '2026-01-30' },
                createdAt: new Date('2026-01-30'),
            },
            {
                type: 'account.private',
                aggregateId: 'private',
                version: 1,
                data: { secret: 'never public' },
            },
        ])
        .returning();
    const archive = await getPublishedPriceLists(new Date('2026-02-01'));
    assert.ok(!archive.some((entry) => entry.id === old.id));
    assert.ok(archive.some((entry) => entry.id === current.id));
    assert.equal((await getPublishedPriceList(old.id))?.csv, 'old');
    assert.equal(await getPublishedPriceList(privateEvent.id), null);
});
