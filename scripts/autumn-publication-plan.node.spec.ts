import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
    assertVerifiedAutumnDeployment,
    verifiedAutumnDeploymentObservations,
    verifyAutumnPublicationDeployment,
} from '../packages/storage/src/helpers/autumnPublicationDeployment';
import {
    publicationDigest,
    validateAutumnPublicationPlan,
} from '../packages/storage/src/helpers/autumnPublicationPlan';
import {
    publicationFixtureCms,
    publicationFixtureDirectory,
    publicationFixtureSource,
} from './autumn-publication-plan.fixtures';
import {
    assertAuthoritativeAutumnPublicationPlan,
    createAutumnPublicationPlan,
    createAutumnPublishedPackCandidates,
} from './autumn-publication-plan-core';
import {
    inspectAutumnSource,
    repositoryReader,
    sha256,
} from './autumn-release-preflight-core';

test('exact 24-item sorted offline plan freezes real fixture identities/prices/revisions and all reviewed deployed bytes', async () => {
    const source = await publicationFixtureSource();
    assert.deepEqual(source.blockers, []);
    const cms = await publicationFixtureCms();
    const plan = createAutumnPublicationPlan(source, cms);
    assert.equal(plan.operations.length, 24);
    assert.ok(plan.deployedAssets.length > 250);
    assert.ok(
        plan.operations.every(
            (operation) =>
                operation.actualPrice > 0 && operation.action === 'publish',
        ),
    );
    assert.deepEqual(
        assertAuthoritativeAutumnPublicationPlan(source, plan),
        plan,
    );
    assert.equal(
        publicationDigest(
            createAutumnPublicationPlan(source, {
                ...cms,
                entities: [...cms.entities].reverse(),
            }),
        ),
        publicationDigest(plan),
    );
});
test('missing/duplicate identities, changed names, inherited drafts and missing reviewed attributes fail closed', async () => {
    const source = await publicationFixtureSource();
    const original = await publicationFixtureCms();
    for (const mutate of [
        (cms: typeof original) => {
            cms.entities.pop();
        },
        (cms: typeof original) => {
            cms.entities[1].id = cms.entities[0].id;
        },
        (cms: typeof original) => {
            cms.entities.push(structuredClone(cms.entities[0]));
        },
        (cms: typeof original) => {
            cms.entities[0].parentId = cms.entities[1].id;
        },
        (cms: typeof original) => {
            cms.entities[0].attributes.pop();
        },
        (cms: typeof original) => {
            cms.entities[0].attributes[0].value = 'UnsupportedModel';
        },
    ]) {
        const cms = structuredClone(original);
        mutate(cms);
        assert.throws(() => createAutumnPublicationPlan(source, cms));
    }
});
test('zero/negative/decimal/internal prices and missing required CMS content are rejected without seed price fallback', async () => {
    const source = await publicationFixtureSource();
    const original = await publicationFixtureCms();
    const priceId = original.definitions.find(
        (definition) => definition.category === 'prices',
    )?.id;
    for (const value of ['0', '-1', '1.5', 'NaN', '2147483648']) {
        const cms = structuredClone(original);
        const price = cms.entities[0].attributes.find(
            (attribute) => attribute.attributeDefinitionId === priceId,
        );
        assert.ok(price);
        price.value = value;
        assert.throws(
            () => createAutumnPublicationPlan(source, cms),
            /Actual positive ordinary price/,
        );
    }
    const cms = structuredClone(original);
    cms.definitions.push({
        ...cms.definitions[0],
        id: 99001,
        name: 'extra-required',
        defaultValue: null,
    });
    assert.throws(() => createAutumnPublicationPlan(source, cms), /Incomplete/);
});
test('self-consistent reduced assets or changed review data never pass authoritative plan reconstruction', async () => {
    const source = await publicationFixtureSource();
    const original = createAutumnPublicationPlan(
        source,
        await publicationFixtureCms(),
    );
    const reduced = structuredClone(original);
    reduced.deployedAssets = reduced.deployedAssets.slice(0, 1);
    validateAutumnPublicationPlan(reduced);
    assert.throws(
        () => assertAuthoritativeAutumnPublicationPlan(source, reduced),
        /authoritative/,
    );
    const altered = structuredClone(original);
    altered.sourceFingerprint = 'a'.repeat(64);
    assert.throws(
        () => assertAuthoritativeAutumnPublicationPlan(source, altered),
        /authoritative/,
    );
    const missingReview = structuredClone(original);
    delete missingReview.operations[0].reviewedAttributes['functions.recycler'];
    assert.throws(
        () => assertAuthoritativeAutumnPublicationPlan(source, missingReview),
        /authoritative/,
    );
});
test('changed source/model bytes block publication authority', async () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const reader = repositoryReader(root);
    const source = await inspectAutumnSource(async (path) =>
        path === 'apps/garden/public/assets/models/LeafRake.glb'
            ? Buffer.from('changed')
            : reader(path),
    );
    assert.ok(
        source.blockers.some((blocker) => blocker.code === 'CHANGED_BYTES'),
    );
    assert.throws(() => createAutumnPublicationPlan(source, {}), /blocked/);
});
test('three published candidates retain exact four units/current ordinary prices and get new full fingerprints with sales off', async () => {
    const source = await publicationFixtureSource();
    const directory = await publicationFixtureDirectory();
    const window = { availableFrom: null, availableUntil: null };
    const candidates = createAutumnPublishedPackCandidates(
        source,
        directory,
        window,
    );
    assert.equal(candidates.length, 3);
    for (const candidate of candidates) {
        assert.equal(candidate.snapshot.publication, 'published');
        assert.equal(candidate.sale.enabled, false);
        assert.match(
            candidate.snapshot.productVersionId,
            /^[a-z-]+:[a-f0-9]{64}$/,
        );
        assert.equal(
            candidate.snapshot.lines.reduce(
                (sum, line) => sum + line.quantity,
                0,
            ),
            4,
        );
        assert.equal(
            candidate.snapshot.chargedSunflowers,
            candidate.snapshot.lines.reduce(
                (sum, line) =>
                    sum + line.paidSunflowersByUnit.reduce((a, b) => a + b, 0),
                0,
            ),
        );
        for (const line of candidate.snapshot.lines) {
            assert.equal(line.variant, null);
            assert.deepEqual(
                line.paidSunflowersByUnit,
                line.recyclingSunflowersByUnit,
            );
        }
    }
    assert.deepEqual(
        createAutumnPublishedPackCandidates(source, directory, window),
        candidates,
    );
    const repriced = structuredClone(directory);
    const changed = repriced.find(
        (row) => row.information.name === 'HarvestPumpkinSquatCream',
    );
    assert.ok(changed);
    changed.prices.sunflowers += 1;
    const repricedCandidates = createAutumnPublishedPackCandidates(
        source,
        repriced,
        window,
    );
    assert.notEqual(
        repricedCandidates.find(
            (candidate) => candidate.snapshot.productId === 'autumn-harvest',
        )?.snapshot.productVersionId,
        candidates.find(
            (candidate) => candidate.snapshot.productId === 'autumn-harvest',
        )?.snapshot.productVersionId,
    );
});
test('candidates reject projected/missing/internal/duplicate published identities, price drift and unspecified/malformed availability', async () => {
    const source = await publicationFixtureSource();
    const directory = await publicationFixtureDirectory();
    for (const mutate of [
        (rows: typeof directory) => {
            rows.pop();
        },
        (rows: typeof directory) => {
            rows[0].id = -1;
        },
        (rows: typeof directory) => {
            rows[1].id = rows[0].id;
        },
        (rows: typeof directory) => {
            rows[0].prices.sunflowers = 0;
        },
        (rows: typeof directory) => {
            rows[0].functions.recycler = true;
        },
    ]) {
        const rows = structuredClone(directory);
        mutate(rows);
        assert.throws(() =>
            createAutumnPublishedPackCandidates(source, rows, {
                availableFrom: null,
                availableUntil: null,
            }),
        );
    }
    for (const window of [
        undefined,
        {},
        { availableFrom: 'bad', availableUntil: null },
        { availableFrom: null, availableUntil: null, saleEnabled: true },
    ])
        assert.throws(() =>
            createAutumnPublishedPackCandidates(source, directory, window),
        );
});
test('deployment proof requires actual exact bounded bytes, allowed reviewed hosts and private freshness provenance', async () => {
    const source = await publicationFixtureSource();
    const plan = createAutumnPublicationPlan(
        source,
        await publicationFixtureCms(),
    );
    // Isolate streaming proof behavior with one reviewed URL; authority reconstruction
    // above separately requires the complete exact asset set before real apply.
    const bytes = Buffer.from('test bytes');
    plan.deployedAssets = [
        {
            path: 'apps/garden/public/assets/models/LeafRake.glb',
            url: 'https://vrt.gredice.com/assets/models/LeafRake.glb',
            bytes: bytes.length,
            sha256: sha256(bytes),
        },
    ];
    const proof = await verifyAutumnPublicationDeployment(
        plan,
        async (_url, options) => {
            assert.equal(options?.redirect, 'error');
            assert.equal(options?.cache, 'no-store');
            return new Response(bytes);
        },
    );
    assertVerifiedAutumnDeployment(plan, proof);
    proof.observations[0].sha256 = '0'.repeat(64);
    assert.equal(
        verifiedAutumnDeploymentObservations(plan, proof)[0].sha256,
        sha256(bytes),
    );
    const originalNow = Date.now;
    Date.now = () => originalNow() + 300_001;
    try {
        assert.throws(
            () => assertVerifiedAutumnDeployment(plan, proof),
            /Fresh actual/,
        );
    } finally {
        Date.now = originalNow;
    }
    assert.throws(
        () => assertVerifiedAutumnDeployment(plan, structuredClone(proof)),
        /Fresh actual/,
    );
    proof.verifiedAt -= 1;
    assert.throws(
        () => assertVerifiedAutumnDeployment(plan, proof),
        /Fresh actual/,
    );
    await assert.rejects(
        verifyAutumnPublicationDeployment(
            plan,
            async () => new Response('wrong bytes'),
        ),
        /hash differs|size exceeded/,
    );
    plan.deployedAssets[0].url =
        'https://example.invalid/assets/models/LeafRake.glb';
    let accessed = false;
    await assert.rejects(
        verifyAutumnPublicationDeployment(plan, async () => {
            accessed = true;
            return new Response(bytes);
        }),
        /Unreviewed/,
    );
    assert.equal(accessed, false);
});
test('default CLI is offline and produces specific unresolved preparation report without DB/env/network access', async () => {
    const temporary = await mkdtemp(
        join(tmpdir(), 'gredice-publication-offline-'),
    );
    const output = join(temporary, 'output');
    try {
        const execute = promisify(execFile);
        await assert.rejects(
            execute(
                process.execPath,
                [
                    '--import',
                    'tsx',
                    '--conditions=react-server',
                    fileURLToPath(
                        new URL(
                            './autumn-publication-plan.ts',
                            import.meta.url,
                        ),
                    ),
                    output,
                ],
                {
                    env: {
                        ...process.env,
                        POSTGRES_URL: 'not-a-database-url',
                        REDIS_URL: 'invalid',
                    },
                },
            ),
        );
        const report = JSON.parse(
            await readFile(join(output, 'report.json'), 'utf8'),
        );
        assert.equal(report.status, 'blocked');
        assert.equal(report.unresolved.length, 24);
        assert.equal(report.releaseReady, false);
        await assert.rejects(
            execute(process.execPath, [
                '--import',
                'tsx',
                '--conditions=react-server',
                fileURLToPath(
                    new URL('./autumn-publication-plan.ts', import.meta.url),
                ),
                output,
            ]),
        );
    } finally {
        await rm(temporary, { recursive: true, force: true });
    }
});
