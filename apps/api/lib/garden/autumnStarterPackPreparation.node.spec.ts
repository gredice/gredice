import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    autumnArrangements,
    getAutumnArrangementItems,
} from '@gredice/js/autumnArrangements';
import { loadReviewedAutumnStarterPackEvidence } from './autumnStarterPackEvidence';
import {
    canonicalGardenPackJson,
    getAutumnStarterPackVersion,
    prepareAutumnStarterPacks,
} from './autumnStarterPackPreparation';
import { createAutumnStarterPackTestDirectory } from './autumnStarterPackPreparation.fixture';
import { assertGardenPackPurchaseContents } from './gardenPackEligibility';

const reviewed = await loadReviewedAutumnStarterPackEvidence();
const prepare = (input: unknown) => prepareAutumnStarterPacks(input, reviewed);

test('three exact disabled drafts freeze full individual paid/recycling amounts without scenery or variants', () => {
    const blocks = createAutumnStarterPackTestDirectory();
    const result = prepare(blocks);
    assert.equal(result.ready, true);
    assert.deepEqual(
        result.offers.map((offer) => offer.snapshot.name.hr),
        ['Jesenski kutak', 'Šumski kutak', 'Topla večer'],
    );
    for (const [index, offer] of result.offers.entries()) {
        const arrangement = autumnArrangements[index];
        assert.ok(arrangement);
        assert.equal(offer.snapshot.publication, 'draft');
        assert.equal(offer.sale.enabled, false);
        assert.equal(
            offer.snapshot.chargedSunflowers,
            offer.snapshot.lines.reduce(
                (sum, line) =>
                    sum +
                    Number(
                        blocks.find(
                            (block) => String(block.id) === line.entityId,
                        )?.prices.sunflowers,
                    ) *
                        line.quantity,
                0,
            ),
        );
        assert.deepEqual(
            offer.snapshot.lines.map((line) => ({
                entityName: line.modelName,
                quantity: line.quantity,
            })),
            getAutumnArrangementItems(arrangement, 'included'),
        );
        for (const line of offer.snapshot.lines) {
            assert.equal(line.variant, null);
            assert.deepEqual(
                line.recyclingSunflowersByUnit,
                line.paidSunflowersByUnit,
            );
        }
        assertGardenPackPurchaseContents(
            offer.snapshot,
            blocks,
            new Date('2026-10-02T12:00:00Z'),
        );
    }
});

test('fails closed for all missing models, duplicate identities, internal IDs and malformed exports', () => {
    const blocks = createAutumnStarterPackTestDirectory();
    const missing = prepare([]);
    assert.equal(missing.errors.length, 12);
    for (const input of [
        Array(10_001).fill(blocks[0]),
        null,
        {},
        blocks.slice(1),
        [...blocks, blocks[0]],
        blocks.map((block) => ({ ...block, id: 1 })),
        blocks.map((block) => ({ ...block, id: -block.id })),
    ]) {
        const result = prepare(input);
        assert.equal(result.ready, false);
        assert.deepEqual(result.offers, []);
        assert.deepEqual(result.evidence, []);
    }
});

test('rejects non-positive/fractional/overflow prices, functions, wrong type and geometry', () => {
    for (const patch of [
        { prices: { sunflowers: 0 } },
        { prices: { sunflowers: -1 } },
        { prices: { sunflowers: 1.5 } },
        { prices: { sunflowers: 2_147_483_648 } },
        { functions: { raisedBed: true, recycler: false } },
        { functions: { raisedBed: false, recycler: true } },
        { functions: {} },
        {
            functions: {
                raisedBed: false,
                recycler: false,
                functionalOverride: true,
            },
        },
        { entityType: { name: 'plant' } },
        { attributes: { type: 'ground' } },
        { attributes: { type: 'decoration', spanWidth: 0, spanDepth: 1 } },
    ]) {
        const blocks = createAutumnStarterPackTestDirectory();
        const result = prepare(
            blocks.map((block, index) =>
                index === 0 ? { ...block, ...patch } : block,
            ),
        );
        assert.equal(result.ready, false);
        assert.deepEqual(result.offers, []);
    }
    const blocks = createAutumnStarterPackTestDirectory();
    assert.equal(
        prepare(
            blocks.map((block) => ({
                ...block,
                attributes: { ...block.attributes, spanWidth: 1 },
            })),
        ).ready,
        false,
    );
    assert.equal(
        prepare(
            blocks.map((block) => ({
                ...block,
                prices: { sunflowers: 2_147_483_647 },
            })),
        ).ready,
        false,
    );
});

test('deterministic fingerprint ignores object-key order and timestamps but changes with every immutable field or reviewed proof', () => {
    const blocks = createAutumnStarterPackTestDirectory();
    const result = prepare(blocks);
    const offer = result.offers[0];
    const evidence = result.evidence[0];
    assert.ok(offer);
    assert.ok(evidence);
    const { productId: _id, productVersionId: _version, ...proof } = evidence;
    assert.equal(
        getAutumnStarterPackVersion(offer.snapshot, proof),
        offer.snapshot.productVersionId,
    );
    assert.equal(
        canonicalGardenPackJson({ b: 2, a: { z: 1, c: 2 } }),
        canonicalGardenPackJson({ a: { c: 2, z: 1 }, b: 2 }),
    );
    assert.deepEqual(prepare([...blocks].reverse()).offers, result.offers);
    for (const patch of [
        { productId: 'changed' },
        { name: { hr: 'Drugi naziv' } },
        { description: { hr: 'Drugi opis' } },
        { previews: ['https://vrt.gredice.com/changed.png'] },
        { publication: 'published' },
        { availableUntil: '2026-12-31T00:00:00Z' },
        { policy: { ...offer.snapshot.policy, versionId: 'policy:v2' } },
        {
            lines: offer.snapshot.lines.map((line) => ({
                ...line,
                entityId: String(Number(line.entityId) + 1),
            })),
        },
        {
            lines: offer.snapshot.lines.map((line) => ({
                ...line,
                variant: {
                    versionId: 'unsupported:v1',
                    appearance: { id: 'changed' },
                },
            })),
        },
        {
            lines: offer.snapshot.lines.map((line) => ({
                ...line,
                recyclingSunflowersByUnit: line.recyclingSunflowersByUnit.map(
                    () => 0,
                ),
            })),
        },
    ])
        assert.notEqual(
            getAutumnStarterPackVersion({ ...offer.snapshot, ...patch }, proof),
            offer.snapshot.productVersionId,
        );
    assert.notEqual(
        getAutumnStarterPackVersion(offer.snapshot, {
            ...proof,
            previewSha256: 'changed',
        }),
        offer.snapshot.productVersionId,
    );
    const changed = prepare(
        blocks.map((block, index) =>
            index === 0 ? { ...block, prices: { sunflowers: 50 } } : block,
        ),
    );
    assert.notEqual(
        changed.offers[0]?.snapshot.productVersionId,
        offer.snapshot.productVersionId,
    );
});

test('stale reviewed contents, layout, scenery or missing proof cannot emit drafts', () => {
    const first = reviewed['harvest-corner'];
    assert.ok(first);
    for (const changed of [
        {
            ...first,
            included: first.included.map((item) => ({ ...item, quantity: 2 })),
        },
        { ...first, scenery: [] },
        {
            ...first,
            placements: first.placements.map((placement) => ({
                ...placement,
                x: placement.x + 1,
            })),
        },
        { ...first, files: [] },
        { ...first, previewSha256: '0'.repeat(64) },
    ]) {
        const result = prepareAutumnStarterPacks(
            createAutumnStarterPackTestDirectory(),
            { ...reviewed, 'harvest-corner': changed },
        );
        assert.equal(result.ready, false);
        assert.deepEqual(result.offers, []);
    }
    assert.equal(
        prepareAutumnStarterPacks(createAutumnStarterPackTestDirectory(), {})
            .ready,
        false,
    );
});

test('offline loader rejects changed capture, preview, GLB, renderer, and static colour/alias bytes without editing files', async () => {
    for (const changedPath of [
        'docs/autumn-arrangements-2026/harvest-corner.json',
        'apps/garden/public/assets/arrangements/harvest-corner.png',
        'apps/garden/public/assets/models/HarvestPumpkinGroup.glb',
        'packages/game/src/entities/HarvestPumpkin.tsx',
        'packages/js/src/harvestPumpkins/index.ts',
        'packages/js/src/autumnAsterPots/index.ts',
    ]) {
        await assert.rejects(
            loadReviewedAutumnStarterPackEvidence(async (path) =>
                path === changedPath
                    ? new Uint8Array([0])
                    : readFile(new URL(`../../../../${path}`, import.meta.url)),
            ),
            /changed|differs/u,
        );
    }
});
