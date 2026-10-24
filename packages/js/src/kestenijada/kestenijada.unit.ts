import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    createKestenijadaStacks,
    getKestenijadaAvailability,
    getKestenijadaOccupiedCells,
    isKestenijadaEventActive,
    isKestenijadaPublicSamplePath,
    kestenijadaCanonicalUrl,
    kestenijadaItems,
    parseKestenijadaEventConfig,
} from './index';

const rows = () =>
    kestenijadaItems.map((item, i) => ({
        id: i + 1,
        entityType: { name: 'block' },
        information: { name: item.name, label: item.label },
        attributes: {
            type: 'decoration',
            stackable: false,
            spanWidth: item.width,
            spanDepth: item.depth,
            nightOnlyPurchase: false,
        },
        functions: { raisedBed: false, recycler: false },
        prices: { sunflowers: 10 },
    }));
test('authored sample has16grass,4path and exact five static pieces, clear approach and non-overlapping rotated footprints', () => {
    const stacks = createKestenijadaStacks();
    const blocks = stacks.flatMap((s) => s.blocks);
    assert.equal(stacks.length, 16);
    assert.equal(blocks.filter((b) => b.name === 'Block_Grass').length, 16);
    assert.equal(blocks.filter((b) => b.name === 'StoneWalkway').length, 4);
    assert.equal(blocks.length, 25);
    assert.ok(blocks.every((b) => b.variant === null));
    assert.ok(blocks.every((b) => !('message' in b)));
    const cells = getKestenijadaOccupiedCells();
    assert.equal(cells.length, 7);
    assert.equal(new Set(cells.map((c) => `${c.x},${c.z}`)).size, 7);
    assert.ok(
        cells.every(
            (c) => c.x >= 0 && c.x < 4 && c.z >= 0 && c.z < 4 && c.x !== 2,
        ),
    );
    assert.ok(!cells.some((c) => c.z === 2 && (c.x === 0 || c.x === 1)));
    assert.deepEqual(
        cells
            .filter((c) => c.name === 'AutumnBlanketBench')
            .map(({ x, z }) => ({ x, z })),
        [
            { x: 3, z: 1 },
            { x: 3, z: 2 },
        ],
    );
});
test('catalogue links require exact published positive rows and footprint; never use display fallbacks', () => {
    assert.ok(getKestenijadaAvailability(rows(), false).every((e) => e.row));
    for (const corrupt of [
        (r: ReturnType<typeof rows>) => {
            r[0].id = -1;
        },
        (r: ReturnType<typeof rows>) => {
            r[0].prices.sunflowers = 0;
        },
        (r: ReturnType<typeof rows>) => {
            r[0].attributes.spanWidth = 1;
        },
        (r: ReturnType<typeof rows>) => {
            r[0].functions.recycler = true;
        },
        (r: ReturnType<typeof rows>) => {
            r.push({ ...r[0] });
        },
        (r: ReturnType<typeof rows>) => {
            r[1].id = r[0].id;
        },
    ]) {
        const r = rows();
        corrupt(r);
        assert.equal(getKestenijadaAvailability(r, false)[0].row, null);
    }
    const r = rows();
    r[0].attributes.nightOnlyPurchase = true;
    assert.equal(getKestenijadaAvailability(r, false)[0].row, null);
    assert.ok(getKestenijadaAvailability(r, true)[0].row);
    assert.ok(getKestenijadaAvailability(null, false).every((e) => !e.row));
});
test('configuration is explicit, reviewed, bounded and half-open; no calendar dates invented by source', () => {
    const config = {
        enabled: true,
        assetsVerified: true,
        startsAt: '2026-10-03T12:00:00Z',
        endsAt: '2026-10-03T13:00:00Z',
    };
    const window = parseKestenijadaEventConfig(JSON.stringify(config));
    assert.ok(window);
    assert.equal(
        isKestenijadaEventActive(window, Date.parse(config.startsAt) - 1),
        false,
    );
    assert.equal(
        isKestenijadaEventActive(window, Date.parse(config.startsAt)),
        true,
    );
    assert.equal(
        isKestenijadaEventActive(window, Date.parse(config.endsAt)),
        false,
    );
    for (const raw of [
        undefined,
        '{}',
        'invalid',
        JSON.stringify({ ...config, enabled: false }),
        JSON.stringify({ ...config, assetsVerified: false }),
        JSON.stringify({ ...config, endsAt: config.startsAt }),
        JSON.stringify({ ...config, startsAt: '2026-10-03' }),
        JSON.stringify({ ...config, startsAt: '2026-02-31T12:00:00Z' }),
        JSON.stringify({ ...config, extra: true }),
        ' '.repeat(1025),
    ])
        assert.equal(parseKestenijadaEventConfig(raw), null);
});
test('privacy fence selects only authored public permalink and canonical share has no garden/account identity', () => {
    assert.equal(isKestenijadaPublicSamplePath('/kestenijada'), true);
    for (const path of ['/', '/gardens/1', '/kestenijada/private', null])
        assert.equal(isKestenijadaPublicSamplePath(path), false);
    assert.equal(new URL(kestenijadaCanonicalUrl).search, '');
    assert.equal(new URL(kestenijadaCanonicalUrl).pathname, '/kestenijada');
});

test('offer aliases prefer stored slug and fail closed on ambiguous label or slug routes', async () => {
    const { getKestenijadaOfferAlias } = await import('./index');
    const r = rows().map((row) => ({ ...row, slug: `offer-${row.id}` }));
    assert.equal(getKestenijadaOfferAlias(r[0], r), 'offer-1');
    r[1].slug = 'offer-1';
    assert.equal(getKestenijadaOfferAlias(r[0], r), null);
    const labels = rows();
    labels[1].information.label = labels[0].information.label;
    assert.equal(getKestenijadaOfferAlias(labels[0], labels), null);
    assert.equal(getKestenijadaAvailability(labels, false)[0].row, null);
});
