import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    symlink,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    getAutumnStarterPackVersion,
    prepareAutumnStarterPacks,
} from '../apps/api/lib/garden/autumnStarterPackPreparation';
import { createAutumnStarterPackTestDirectory } from '../apps/api/lib/garden/autumnStarterPackPreparation.fixture';
import {
    boundedFile,
    fingerprint,
    inspectArtifacts,
    inspectAutumnSource,
    inspectDirectory,
    inspectLegacyDirectory,
    inspectProducts,
    object,
    repositoryReader,
    sha256,
} from './autumn-release-preflight-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const reader = repositoryReader(root);
const sourcePromise = inspectAutumnSource(reader);
const temporary = await mkdtemp(
    resolve(tmpdir(), 'gredice-autumn-preflight-tests-'),
);
after(() => rm(temporary, { recursive: true, force: true }));
async function fixture() {
    const source = await sourcePromise;
    const directory = source.items.map((item, index) => ({
        id: 10_000 + index,
        entityType: { name: 'block' },
        information: { ...item.information, name: item.name },
        attributes: item.attributes,
        functions: { raisedBed: false, recycler: false },
        prices: { sunflowers: 30 + index },
        image: {
            cover: { url: new URL(item.cover, 'https://www.gredice.com').href },
        },
    }));
    const legacy = createAutumnStarterPackTestDirectory()
        .filter((row) =>
            ['StoneMedium', 'EnamelGardenLamp'].includes(row.information.name),
        )
        .map((row, index) => ({ ...row, id: 20_000 + index }));
    return { source, directory: [...directory, ...legacy] };
}
async function offersFixture() {
    const { source, directory } = await fixture();
    const prepared = prepareAutumnStarterPacks(
        directory,
        source.reviewedEvidence,
    );
    assert.equal(prepared.ready, true, prepared.errors.join('; '));
    const offers = prepared.offers.map((offer, index) => {
        const snapshot = {
            ...offer.snapshot,
            publication: 'published' as const,
        };
        const {
            productId: _product,
            productVersionId: _version,
            ...proof
        } = prepared.evidence[index];
        snapshot.productVersionId = getAutumnStarterPackVersion(
            snapshot,
            proof,
        );
        return {
            snapshot,
            sale: { enabled: true, availableFrom: null, availableUntil: null },
        };
    });
    return { offers, prepared };
}

test('actual twelve families and reviewed starter bytes resolve without pretending catalogue or device readiness', async () => {
    const source = await sourcePromise;
    assert.deepEqual(source.blockers, []);
    assert.equal(source.items.length, 24);
    assert.equal(source.models.length, 16);
    assert.equal(source.families.length, 12);
    assert.ok(
        source.items.every((item) => item.binding && item.collections.length),
    );
    assert.ok(
        source.files.some(
            (file) => file.path === 'packages/game/src/entities/LeafRake.tsx',
        ),
    );
    assert.ok(
        source.files.some(
            (file) =>
                file.path ===
                'packages/game/src/entities/HarvestWheelbarrow.tsx',
        ),
    );
    assert.ok(
        source.files.some(
            (file) =>
                file.path === 'assets/game-assets/HarvestPumpkinSquat.blend',
        ),
    );
});

test('changed GLB bytes and selected renderer source fail their audited pins', async () => {
    for (const path of [
        'apps/garden/public/assets/models/LeafRake.glb',
        'packages/game/src/entities/HarvestWheelbarrow.tsx',
    ]) {
        const source = await inspectAutumnSource(async (file) =>
            file === path
                ? Buffer.concat([await reader(file), Buffer.from('\nchanged')])
                : reader(file),
        );
        assert.ok(
            source.blockers.some(
                (blocker) =>
                    blocker.code === 'CHANGED_BYTES' &&
                    blocker.subject === path,
            ),
        );
        assert.notEqual(
            source.sourceFingerprint,
            (await sourcePromise).sourceFingerprint,
        );
    }
});

test('unknown or duplicated selection cannot add optional assets or silently remove pilot families', async () => {
    const selectionPath = 'docs/autumn-release-2026/pilot-selection.json';
    for (const mutate of [
        (selection: Record<string, unknown>) => {
            const families = selection.families;
            assert.ok(Array.isArray(families));
            selection.families = [...families.slice(0, 11), families[0]];
        },
        (selection: Record<string, unknown>) => {
            selection.products = ['autumn-harvest', 'unreviewed-extra'];
        },
        (selection: Record<string, unknown>) => {
            selection.extraApproval = true;
        },
    ]) {
        const selection = object(
            JSON.parse(new TextDecoder().decode(await reader(selectionPath))),
        );
        mutate(selection);
        const bytes = Buffer.from(JSON.stringify(selection));
        await assert.rejects(
            inspectAutumnSource((path) =>
                path === selectionPath ? Promise.resolve(bytes) : reader(path),
            ),
        );
    }
});

test('valid synthetic catalogue resolves identities, while absent and duplicate/internal identities fail closed', async () => {
    const { source, directory } = await fixture();
    assert.deepEqual(inspectDirectory(directory, source.items).blockers, []);
    assert.equal(inspectDirectory([], source.items).blockers.length, 24);
    assert.throws(
        () => inspectDirectory([...directory, directory[0]], source.items),
        /duplicate/,
    );
    assert.throws(
        () => inspectDirectory([{ ...directory[0], id: -1 }], source.items),
        /Invalid/,
    );
});

test('catalogue wrong cover, authored dimensions, Croatian metadata and nonpositive prices are actionable blockers', async () => {
    const { source, directory } = await fixture();
    const selected = directory[0];
    const variants = [
        {
            ...selected,
            attributes: {
                ...selected.attributes,
                height: 'bad',
                hitboxWidth: 999,
            },
        },
        {
            ...selected,
            image: { cover: { url: 'https://example.invalid/wrong.webp' } },
        },
        { ...selected, image: undefined },
        {
            ...selected,
            information: { ...selected.information, label: 'wrong identity' },
        },
        { ...selected, prices: { sunflowers: 0 } },
    ];
    for (const row of variants)
        assert.ok(
            inspectDirectory(
                [row, ...directory.slice(1)],
                source.items,
            ).blockers.some(
                (blocker) => blocker.code === 'INVALID_PUBLISHED_ITEM',
            ),
        );
});

test('exact published versions validate and emitted sales are always disabled', async () => {
    const { offers, prepared } = await offersFixture();
    const output = inspectProducts(offers, prepared);
    assert.equal(output.length, 3);
    assert.ok(output.every((offer) => !offer.sale.enabled));
    assert.ok(
        output.every(
            (offer, index) =>
                offer.snapshot.productVersionId !==
                prepared.offers[index].snapshot.productVersionId,
        ),
    );
});

test('products reject changed contents, original draft version reuse, stale prices, duplicate and out-of-scope grants', async () => {
    const { offers, prepared } = await offersFixture();
    for (const mutate of [
        (value: typeof offers) => {
            value[0].snapshot.productVersionId =
                prepared.offers[0].snapshot.productVersionId;
        },
        (value: typeof offers) => {
            value[0].snapshot.name.hr = 'Unreviewed';
        },
        (value: typeof offers) => {
            value[0].snapshot.chargedSunflowers += 1;
        },
        (value: typeof offers) => {
            value[1] = value[0];
        },
        (value: typeof offers) => {
            value[0].snapshot.productId = 'optional-extra';
        },
    ]) {
        const value = structuredClone(offers);
        mutate(value);
        assert.throws(() => inspectProducts(value, prepared));
    }
});

test('artifact booleans, stale source, duplicate paths, changed hashes and traversal cannot clear evidence gates', async () => {
    const source = await sourcePromise;
    const path = 'docs/autumn-release-2026/pilot-selection.json';
    const artifact = {
        kind: 'physical-device',
        path,
        sha256: sha256(await reader(path)),
        note: 'A hashed file is not hardware proof.',
    };
    const index = {
        schemaVersion: 1,
        sourceFingerprint: source.sourceFingerprint,
        artifacts: [artifact],
    };
    const output = await inspectArtifacts(
        index,
        root,
        source.sourceFingerprint,
    );
    assert.equal(output[0].acceptedAsReleaseGate, false);
    for (const value of [
        { ...index, passed: true },
        { ...index, sourceFingerprint: fingerprint('stale') },
        { ...index, artifacts: [artifact, artifact] },
        {
            ...index,
            artifacts: [{ ...artifact, sha256: fingerprint('wrong') }],
        },
        { ...index, artifacts: [{ ...artifact, path: '../secrets' }] },
    ])
        await assert.rejects(
            inspectArtifacts(value, root, source.sourceFingerprint),
        );
});

test('regular-file size bounds and escaping symlinks are checked before parsing', async () => {
    const path = resolve(temporary, 'too-large.json');
    await writeFile(path, '12345');
    await assert.rejects(boundedFile(path, 4), /up to 4 bytes/);
    await assert.rejects(boundedFile(temporary), /regular file/);
    const sandbox = resolve(temporary, 'sandbox');
    await mkdir(sandbox);
    await symlink(path, resolve(sandbox, 'escape.json'));
    await assert.rejects(
        repositoryReader(sandbox)('escape.json'),
        /escapes repository/,
    );
    await assert.rejects(repositoryReader(root)('../escape.json'), /Unsafe/);
});

test('actual CLI has offline blocked default, concrete missing names and overwrite refusal', async () => {
    const destination = resolve(temporary, 'default-report');
    const cli = resolve(root, 'scripts/autumn-release-preflight.ts');
    const args = [
        '--import',
        'tsx',
        '--conditions=react-server',
        cli,
        destination,
    ];
    const result = spawnSync(process.execPath, args, {
        cwd: resolve(root, 'apps/api'),
        encoding: 'utf8',
        env: {
            ...process.env,
            GREDICE_GARDEN_PACK_CATALOGUE_JSON:
                '{invalid-live-env-is-never-read}',
        },
    });
    assert.equal(result.status, 1, result.stderr);
    const report = object(
        JSON.parse(await readFile(resolve(destination, 'report.json'), 'utf8')),
    );
    assert.equal(report.sourceStatus, 'source-ready');
    assert.equal(report.releaseStatus, 'release-blocked');
    assert.equal(report.headCommit === null, report.headTree === null);
    if (report.headCommit !== null)
        assert.equal(typeof report.workingTreeStatus, 'string');
    assert.match(result.stdout, /actionable blockers/);
    const repeat = spawnSync(process.execPath, args, {
        cwd: resolve(root, 'apps/api'),
        encoding: 'utf8',
    });
    assert.notEqual(repeat.status, 0);
    assert.match(repeat.stderr, /EEXIST/);
});

test('legacy dependencies preserve real supplied identities and reject bad metadata without inventing source IDs', async () => {
    const rows = ['StoneMedium', 'EnamelGardenLamp'].map((name, index) => ({
        id: 200 + index,
        information: { name },
        entityType: { name: 'block' },
        attributes: {
            type: 'decoration',
            spanWidth: 1,
            spanDepth: 1,
            stackable: false,
            placeableOnWater: false,
            nightOnlyPurchase: false,
        },
        functions: { raisedBed: false, recycler: false },
        prices: { sunflowers: 20 },
        image: {
            cover: {
                url: `https://www.gredice.com/assets/blocks/${name}.webp`,
            },
        },
    }));
    const result = inspectLegacyDirectory(rows);
    assert.deepEqual(result.blockers, []);
    assert.equal(result.resolved[0].suppliedCatalogueId, 200);
    assert.equal(result.resolved[0].metadataStatus, 'metadata-matches');
    assert.ok(
        inspectLegacyDirectory([{ ...rows[0], id: -1 }, rows[1]]).blockers
            .length,
    );
    assert.ok(
        inspectLegacyDirectory([
            { ...rows[0], attributes: { ...rows[0].attributes, spanWidth: 2 } },
            rows[1],
        ]).blockers.length,
    );
    assert.ok(
        inspectLegacyDirectory([rows[0], rows[0], rows[1]]).blockers.length,
    );
});
