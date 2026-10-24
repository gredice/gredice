import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadReviewedAutumnStarterPackEvidence } from '../apps/api/lib/garden/autumnStarterPackEvidence';
import {
    autumnStarterPackRecipes,
    canonicalGardenPackJson,
    getAutumnStarterPackVersion,
    type prepareAutumnStarterPacks,
} from '../apps/api/lib/garden/autumnStarterPackPreparation';
import { gardenPackOfferSchema } from '../apps/api/lib/garden/gardenPackCatalogue';
import { gameAssetModels } from '../packages/game/src/data/gameAssetModels.generated';

export const familyNames = [
    'harvest-pumpkins',
    'garden-scarecrow',
    'harvest-crates',
    'harvest-wheelbarrow',
    'autumn-aster-pots',
    'autumn-shrub',
    'woodland-mushrooms',
    'fallen-log',
    'autumn-leaf-piles',
    'leaf-rake',
    'autumn-blanket-bench',
    'garden-tea-table',
];
export const sha256 = (bytes: Uint8Array | string) =>
    createHash('sha256').update(bytes).digest('hex');
export const fingerprint = (value: unknown) =>
    sha256(canonicalGardenPackJson(value));
const apiRequire = createRequire(
    new URL('../apps/api/package.json', import.meta.url),
);
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const maximumBytes = 10_000_000;
const maximumAssetBytes = 50_000_000;
export function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Expected object');
    return Object.fromEntries(Object.entries(value));
}
function list(value: unknown, maximum = 10_000): unknown[] {
    if (!Array.isArray(value) || value.length > maximum)
        throw new Error(`Expected bounded array (${maximum})`);
    return value;
}
function text(value: unknown) {
    if (typeof value !== 'string' || value.length === 0 || value.length > 2_000)
        throw new Error('Expected bounded nonempty string');
    return value;
}
function digest(value: unknown) {
    const hash = text(value);
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Expected SHA256');
    return hash;
}
function exactKeys(value: Record<string, unknown>, keys: string[]) {
    if (Object.keys(value).some((key) => !keys.includes(key)))
        throw new Error('Unknown input fields');
}
function safePath(path: string) {
    if (
        isAbsolute(path) ||
        path.includes('\\') ||
        path.split('/').some((part) => ['..', '.', ''].includes(part))
    )
        throw new Error(`Unsafe relative path: ${path}`);
    return path;
}
export async function boundedFile(path: string, limit = maximumBytes) {
    const metadata = await stat(path);
    if (!metadata.isFile() || metadata.size > limit)
        throw new Error(`Expected regular file up to ${limit} bytes: ${path}`);
    const bytes = await readFile(path);
    if (bytes.length > limit)
        throw new Error(`File grew beyond ${limit} bytes: ${path}`);
    return bytes;
}
export function repositoryReader(root: string) {
    return async (path: string) => {
        safePath(path);
        const [base, target] = await Promise.all([
            realpath(root),
            realpath(resolve(root, path)),
        ]);
        const rel = relative(base, target);
        if (rel.startsWith('..') || isAbsolute(rel))
            throw new Error(`Path escapes repository: ${path}`);
        return boundedFile(target, maximumAssetBytes);
    };
}
function parse(bytes: Uint8Array) {
    if (bytes.length > maximumBytes) throw new Error('JSON exceeds 10 MB');
    return JSON.parse(new TextDecoder().decode(bytes));
}
function references(
    value: unknown,
): { path: string; sha256: string; bytes?: number }[] {
    if (Array.isArray(value)) return value.flatMap(references);
    if (!value || typeof value !== 'object') return [];
    const entry = object(value);
    const own =
        entry.path && entry.sha256
            ? [
                  {
                      path: safePath(text(entry.path)),
                      sha256: digest(entry.sha256),
                      ...(typeof entry.bytes === 'number'
                          ? { bytes: entry.bytes }
                          : {}),
                  },
              ]
            : [];
    return [...own, ...Object.values(entry).flatMap(references)];
}
function runtimeBindings(source: string) {
    // Read only the established declarative registry grammar; never execute renderers.
    // Unsupported expressions fail closed instead of silently omitting registrations.
    const body = source.match(
        /^export const entityNameMap = \{\n([\s\S]*?)^\} satisfies Record<string, React\.ComponentType<EntityInstanceProps>>;/m,
    )?.[1];
    if (!body) throw new Error('Unsupported runtime registry declaration');
    const bindings = new Map<string, string>();
    for (const line of body.split('\n')) {
        const value = line.trim();
        if (!value || value.startsWith('//')) continue;
        const property = value.match(
            /^([A-Za-z][A-Za-z0-9_]*)(?:\s*:\s*([A-Za-z][A-Za-z0-9_]*))?,$/,
        );
        if (!property || bindings.has(property[1]))
            throw new Error(
                'Unsupported or duplicate runtime registry property',
            );
        bindings.set(property[1], property[2] ?? property[1]);
    }
    return bindings;
}
export type Blocker = {
    gate: string;
    code: string;
    subject: string;
    detail: string;
};
export async function inspectAutumnSource(
    readBytes: (path: string) => Promise<Uint8Array>,
) {
    const blockers: Blocker[] = [];
    const files = new Map<
        string,
        { path: string; sha256: string; bytes: number }
    >();
    const add = (code: string, subject: string, detail: string) =>
        blockers.push({ gate: 'source', code, subject, detail });
    async function inspect(path: string, expected?: string, bytes?: number) {
        const data = await readBytes(safePath(path));
        const hash = sha256(data);
        const previous = files.get(path);
        if (previous && previous.sha256 !== hash)
            throw new Error(`File changed while reading: ${path}`);
        files.set(path, { path, sha256: hash, bytes: data.length });
        if (
            (expected && hash !== expected) ||
            (bytes !== undefined && bytes !== data.length)
        )
            add(
                'CHANGED_BYTES',
                path,
                `Expected ${expected ?? 'recorded size'}, got ${hash} (${data.length} bytes)`,
            );
        return data;
    }
    const selectionBytes = await inspect(
        'docs/autumn-release-2026/pilot-selection.json',
    );
    const selection = object(parse(selectionBytes));
    exactKeys(selection, [
        'schemaVersion',
        'scope',
        'pickerMembers',
        'families',
        'additionalSources',
        'sourceInputs',
        'legacyDependencies',
        'products',
        'excludedIssues',
        'excludedIssueParts',
        'foundationIssues',
        'exclusionNote',
    ]);
    if (selection.schemaVersion !== 1 || selection.scope !== 'autumn-ab-pilot')
        throw new Error('Unsupported pilot selection');
    const excluded = [
        ...Array.from({ length: 11 }, (_, index) => 4960 + index),
        4974,
        4975,
        4977,
        4978,
        4979,
        4980,
        4981,
        4992,
        4993,
        4994,
        4995,
        4996,
        4997,
        4998,
    ];
    if (
        canonicalGardenPackJson(selection.excludedIssues) !==
            canonicalGardenPackJson(excluded) ||
        canonicalGardenPackJson(selection.foundationIssues) !==
            canonicalGardenPackJson([2631, 2726, 4921, 4971, 4973, 4976])
    )
        throw new Error(
            'Pilot exclusions/foundations changed; require explicit scope review',
        );
    const partials = list(selection.excludedIssueParts, 1).map(object);
    if (partials.length !== 1 || partials[0].issue !== 4972)
        throw new Error('Tea/chestnut issue scope must remain explicit');
    text(partials[0].excluded);
    text(selection.exclusionNote);
    const pickerMembers = list(selection.pickerMembers, 24).map(object);
    if (
        pickerMembers.length !== 24 ||
        new Set(pickerMembers.map((entry) => entry.name)).size !== 24
    )
        throw new Error('Exact audited picker membership required');
    for (const member of pickerMembers) {
        exactKeys(member, ['name', 'collections']);
        const collections = list(member.collections, 6);
        if (
            !collections.length ||
            collections.some(
                (id) =>
                    ![
                        'harvest',
                        'woodland',
                        'evening',
                        'garden',
                        'chestnuts',
                        'pumpkin-night',
                    ].includes(text(id)),
            )
        )
            throw new Error('Unsupported picker membership');
    }
    const selected = list(selection.families, 12).map(object);
    if (
        selected.length !== 12 ||
        selected.some(
            (entry, index) =>
                entry.issue !== 4948 + index ||
                entry.manifest !==
                    `docs/${familyNames[index]}-2026/release-manifest.json`,
        )
    )
        throw new Error(
            'Pilot must select exactly the twelve ordered A/B families',
        );
    if (
        canonicalGardenPackJson(selection.products) !==
        canonicalGardenPackJson(
            autumnStarterPackRecipes.map((recipe) => recipe.productId),
        )
    )
        throw new Error('Unexpected pilot products');
    const bindings = runtimeBindings(
        new TextDecoder().decode(
            await inspect('packages/game/src/entities/entityNameMap.ts'),
        ),
    );
    for (const path of [
        'assets/game-assets.json',
        'packages/game/src/data/gameAssetModels.generated.ts',
        'packages/game/src/hud/autumnItemCollections.ts',
        'packages/game/src/hud/ItemsHud.tsx',
        'packages/game/src/internalSceneBlockData.ts',
        'apps/api/lib/garden/autumnStarterPackPreparation.ts',
        'apps/api/lib/garden/gardenPackCatalogue.ts',
        'apps/api/lib/garden/gardenPackEligibility.ts',
        'apps/api/lib/garden/autumnStarterPackEvidence.ts',
    ])
        await inspect(path);
    const assets = object(parse(await inspect('assets/game-assets.json')));
    const assetEntries = list(assets.assets).map(object);
    const families = [];
    const seenNames = new Set<string>();
    const models = new Map<
        string,
        {
            name: string;
            path: string;
            sha256: string;
            url: string;
            sourcePath: string;
        }
    >();
    const items = [];
    for (const entry of selected) {
        exactKeys(entry, ['issue', 'manifest', 'sha256']);
        const path = text(entry.manifest);
        try {
            const manifest = object(
                parse(await inspect(path, digest(entry.sha256))),
            );
            if (
                manifest.state !== 'unpublished' ||
                manifest.publicationIssue !== 5000
            )
                add(
                    'UNEXPECTED_MANIFEST_STATE',
                    path,
                    'Pilot source manifest must retain unpublished preparation state',
                );
            const familyModels = list(manifest.models, 20).map(object);
            const familyItems = list(manifest.items, 30).map(object);
            for (const ref of references(manifest))
                await inspect(ref.path, ref.sha256, ref.bytes);
            for (const model of familyModels) {
                const name = text(model.name);
                const hash = digest(model.sha256);
                const asset = assetEntries.filter((item) => item.name === name);
                const runtime = Object.entries(gameAssetModels).find(
                    ([key]) => key === name,
                )?.[1];
                if (asset.length !== 1 || !runtime) {
                    add(
                        'MODEL_NOT_REGISTERED',
                        name,
                        'Must uniquely resolve through asset registry and generated model URL',
                    );
                    continue;
                }
                const sourcePath = `assets/${text(assets.sourceDirectory)}/${text(asset[0].source)}`;
                await inspect(sourcePath);
                const expectedPath = `apps/garden/public/assets/models/${text(asset[0].output)}`;
                const expectedUrl = `/assets/models/${text(asset[0].output)}?v=${hash.slice(0, 12)}`;
                if (
                    model.path !== expectedPath ||
                    asset[0].version !== hash.slice(0, 12) ||
                    runtime.url !== expectedUrl ||
                    new URL(text(model.url), 'https://vrt.gredice.com').href !==
                        `https://vrt.gredice.com${expectedUrl}`
                )
                    add(
                        'MODEL_VERSION_MISMATCH',
                        name,
                        'Manifest, generated URL, asset registry and GLB hash must agree',
                    );
                if (models.has(name))
                    add(
                        'DUPLICATE_MODEL',
                        name,
                        'Model appears in multiple selected families',
                    );
                models.set(name, {
                    name,
                    path: expectedPath,
                    sha256: hash,
                    url: expectedUrl,
                    sourcePath,
                });
            }
            for (const item of familyItems) {
                const name = text(item.name);
                if (seenNames.has(name))
                    add(
                        'DUPLICATE_ITEM',
                        name,
                        'Runtime identity appears in multiple selected families',
                    );
                seenNames.add(name);
                const binding = bindings.get(name);
                const collections = list(
                    pickerMembers.find((member) => member.name === name)
                        ?.collections ?? [],
                    6,
                ).map(text);
                if (!binding)
                    add(
                        'ITEM_NOT_REGISTERED',
                        name,
                        'Missing runtime renderer binding',
                    );
                else {
                    const component = await inspect(
                        `packages/game/src/entities/${binding}.tsx`,
                    );
                    for (const match of new TextDecoder()
                        .decode(component)
                        .matchAll(/from ['"](@gredice\/js\/[^'"]+)['"]/g)) {
                        const dependency = relative(
                            repositoryRoot,
                            apiRequire.resolve(match[1]),
                        );
                        await inspect(dependency);
                    }
                }
                if (!collections.length)
                    add(
                        'ITEM_NOT_IN_PICKER',
                        name,
                        'Missing ordinary Jesen collection membership',
                    );
                // Explicit alias or unique family model. Do not guess alias-name GLB URLs.
                const assetName =
                    typeof item.asset === 'string'
                        ? item.asset
                        : familyModels.length === 1
                          ? text(familyModels[0].name)
                          : name;
                if (!models.has(assetName))
                    add(
                        'ITEM_ASSET_MISSING',
                        name,
                        `Missing selected asset ${assetName}`,
                    );
                if (item.catalogueId !== null)
                    add(
                        'UNEXPECTED_CATALOGUE_ID',
                        name,
                        'Do not install real IDs into unpublished source metadata',
                    );
                items.push({
                    name,
                    familyIssue: entry.issue,
                    assetName,
                    binding: binding ?? null,
                    collections,
                    attributes: object(item.attributes),
                    information: object(item.information),
                    cover: text(item.cover),
                    topDown: text(item.topDown),
                    catalogueId: null,
                });
            }
            families.push({
                issue: entry.issue,
                path,
                state: manifest.state,
                items: familyItems.length,
                models: familyModels.length,
                manifestSha256: digest(entry.sha256),
            });
        } catch (error) {
            add(
                'INVALID_FAMILY',
                path,
                error instanceof Error ? error.message : 'Invalid family',
            );
        }
    }
    const extraSources = list(selection.additionalSources, 3).map(object);
    if (
        extraSources.length !== 3 ||
        new Set(extraSources.map((entry) => entry.path)).size !== 3 ||
        extraSources.some(
            (entry) =>
                !['Squat', 'Gourd', 'Group'].some(
                    (shape) =>
                        entry.path ===
                        `assets/game-assets/HarvestPumpkin${shape}.blend`,
                ),
        )
    )
        throw new Error('Exact three pumpkin source inventories required');
    for (const value of extraSources) {
        const entry = object(value);
        exactKeys(entry, ['path', 'sha256', 'reason']);
        await inspect(text(entry.path), digest(entry.sha256));
    }
    const legacy = list(selection.legacyDependencies, 2).map(object);
    if (
        legacy.length !== 2 ||
        new Set(legacy.map((entry) => entry.name)).size !== 2
    )
        throw new Error('Both exact legacy recipe dependencies required');
    for (const raw of legacy) {
        const entry = object(raw);
        exactKeys(entry, ['name', 'modelUrl', 'catalogueId', 'files', 'note']);
        const name = text(entry.name);
        if (!['StoneMedium', 'EnamelGardenLamp'].includes(name))
            throw new Error('Out-of-scope legacy recipe dependency');
        for (const ref of references(entry))
            await inspect(ref.path, ref.sha256, ref.bytes);
        if (!bindings.has(name))
            add('ITEM_NOT_REGISTERED', name, 'Missing legacy recipe renderer');
        const runtime = Object.entries(gameAssetModels).find(
            ([key]) => key === name,
        )?.[1];
        if (!runtime || runtime.url !== entry.modelUrl)
            add(
                'MODEL_VERSION_MISMATCH',
                name,
                'Legacy URL must retain its actual versioned/unversioned identity',
            );
    }
    if (items.length !== 24 || models.size !== 16)
        add(
            'PILOT_COUNTS_CHANGED',
            'selection',
            `Expected 24 identities / 16 GLBs, got ${items.length} / ${models.size}`,
        );
    let reviewedEvidence:
        | Awaited<ReturnType<typeof loadReviewedAutumnStarterPackEvidence>>
        | undefined;
    try {
        await inspect(
            'apps/api/lib/garden/autumnStarterPackEvidence.reviewed.json',
        );
        reviewedEvidence = await loadReviewedAutumnStarterPackEvidence(
            async (path) => inspect(path),
        );
    } catch (error) {
        add(
            'STARTER_PROOF_CHANGED',
            'reviewed arrangements',
            error instanceof Error ? error.message : 'Invalid proof',
        );
    }
    const sourceInputs = list(selection.sourceInputs, 250).map(object);
    const pinnedSourcePaths = new Set<string>();
    for (const input of sourceInputs) {
        exactKeys(input, ['path', 'sha256']);
        const path = text(input.path);
        if (pinnedSourcePaths.has(path))
            throw new Error(`Duplicate source input: ${path}`);
        pinnedSourcePaths.add(path);
        await inspect(path, digest(input.sha256));
    }
    for (const path of files.keys()) {
        if (
            /\.(tsx?|json)$/.test(path) &&
            path !== 'docs/autumn-release-2026/pilot-selection.json' &&
            !pinnedSourcePaths.has(path)
        )
            add(
                'UNPINNED_SOURCE',
                path,
                'Selected runtime/evidence source requires an explicit audited byte pin',
            );
    }
    const inventory = [...files.values()].sort((a, b) =>
        a.path.localeCompare(b.path, 'en'),
    );
    return {
        blockers,
        selection,
        families,
        items,
        models: [...models.values()],
        files: inventory,
        sourceFingerprint: fingerprint(inventory),
        reviewedEvidence,
    };
}

export function inspectDirectory(
    value: unknown,
    items: Awaited<ReturnType<typeof inspectAutumnSource>>['items'],
) {
    const rows = list(value).map(object);
    const blockers: Blocker[] = [];
    const seenIds = new Set<number>();
    const seenNames = new Set<string>();
    for (const row of rows) {
        const name = text(object(row.information).name);
        if (
            typeof row.id !== 'number' ||
            !Number.isSafeInteger(row.id) ||
            row.id <= 0 ||
            row.id > 2_147_483_647 ||
            seenIds.has(row.id) ||
            seenNames.has(name)
        )
            throw new Error(
                `Invalid or duplicate published directory identity: ${name}`,
            );
        seenIds.add(row.id);
        seenNames.add(name);
    }
    const resolved = items.map((item) => {
        const row = rows.find(
            (row) => object(row.information).name === item.name,
        );
        if (!row) {
            blockers.push({
                gate: 'catalogue',
                code: 'MISSING_PUBLISHED_ITEM',
                subject: item.name,
                detail: `Publish reviewed family #${item.familyIssue} after runtime byte readback; no ID/price guessed`,
            });
            return { name: item.name, catalogueId: null, price: null };
        }
        const attributes = object(row.attributes);
        const functions = object(row.functions);
        const price = object(row.prices).sunflowers;
        const mismatches = Object.keys(item.attributes).filter(
            (key) => attributes[key] !== item.attributes[key],
        );
        const information = object(row.information);
        for (const key of ['label', 'shortDescription', 'fullDescription'])
            if (information[key] !== item.information[key])
                mismatches.push(`information.${key}`);
        const cover =
            row.image && object(row.image).cover
                ? object(object(row.image).cover).url
                : null;
        const expectedCover = new URL(item.cover, 'https://www.gredice.com')
            .href;
        if (cover !== expectedCover) mismatches.push('image.cover.url');
        if (
            object(row.entityType).name !== 'block' ||
            functions.raisedBed !== false ||
            functions.recycler !== false ||
            typeof price !== 'number' ||
            !Number.isSafeInteger(price) ||
            price <= 0 ||
            price > 2_147_483_647 ||
            mismatches.length
        )
            blockers.push({
                gate: 'catalogue',
                code: 'INVALID_PUBLISHED_ITEM',
                subject: item.name,
                detail: `Check positive ordinary price, decorative type/functions and reviewed attributes: ${mismatches.join(', ')}`,
            });
        return { name: item.name, catalogueId: row.id, price };
    });
    return { rows, resolved, blockers };
}

export function inspectProducts(
    value: unknown,
    prepared: ReturnType<typeof prepareAutumnStarterPacks>,
) {
    if (!prepared.ready)
        throw new Error(
            'Cannot validate products before directory and reviewed recipe preflight',
        );
    const offers = list(value, 3).map((value) =>
        gardenPackOfferSchema.parse(value),
    );
    if (
        offers.length !== 3 ||
        new Set(offers.map((offer) => offer.snapshot.productId)).size !== 3
    )
        throw new Error('Exactly three distinct pilot offers required');
    return offers.map((offer) => {
        const expected = prepared.offers.find(
            (candidate) =>
                candidate.snapshot.productId === offer.snapshot.productId,
        );
        const proof = prepared.evidence.find(
            (candidate) => candidate.productId === offer.snapshot.productId,
        );
        if (!expected || !proof)
            throw new Error(
                `Out-of-scope product: ${offer.snapshot.productId}`,
            );
        // Publication/window changes require a new fingerprint; contents, prices and all other immutable fields must remain exact.
        const allowed = {
            ...expected.snapshot,
            publication: offer.snapshot.publication,
            availableFrom: offer.snapshot.availableFrom,
            availableUntil: offer.snapshot.availableUntil,
            productVersionId: offer.snapshot.productVersionId,
        };
        if (
            canonicalGardenPackJson(allowed) !==
            canonicalGardenPackJson(offer.snapshot)
        )
            throw new Error(
                `Product differs from exact reviewed recipe/current individual prices: ${offer.snapshot.productId}`,
            );
        const {
            productId: _product,
            productVersionId: _version,
            ...evidence
        } = proof;
        if (
            getAutumnStarterPackVersion(offer.snapshot, evidence) !==
            offer.snapshot.productVersionId
        )
            throw new Error(
                `Invalid immutable product version fingerprint: ${offer.snapshot.productId}`,
            );
        return {
            ...offer,
            sale: {
                enabled: false,
                availableFrom: offer.sale.availableFrom,
                availableUntil: offer.sale.availableUntil,
            },
        };
    });
}

/** Artifacts can be inspected, never promoted to external release acceptance. */
export async function inspectArtifacts(
    value: unknown,
    root: string,
    sourceFingerprint: string,
) {
    const evidence = object(value);
    exactKeys(evidence, ['schemaVersion', 'sourceFingerprint', 'artifacts']);
    if (
        evidence.schemaVersion !== 1 ||
        evidence.sourceFingerprint !== sourceFingerprint
    )
        throw new Error(
            'Evidence must match the current selected source fingerprint',
        );
    const seen = new Set<string>();
    const records = [];
    const readBytes = repositoryReader(root);
    for (const raw of list(evidence.artifacts, 100)) {
        const artifact = object(raw);
        exactKeys(artifact, ['kind', 'path', 'sha256', 'note']);
        if (artifact.note !== undefined) text(artifact.note);
        const path = safePath(text(artifact.path));
        if (seen.has(path))
            throw new Error(`Duplicate evidence artifact: ${path}`);
        seen.add(path);
        if (
            ![
                'headless',
                'production-profile',
                'physical-device',
                'deployed-readback',
                'rollout-readback',
            ].includes(text(artifact.kind))
        )
            throw new Error('Unsupported evidence kind');
        const hash = digest(artifact.sha256);
        if (sha256(await readBytes(path)) !== hash)
            throw new Error(`Evidence artifact bytes changed: ${path}`);
        records.push({
            ...artifact,
            reviewStatus: 'requires-independent-review',
            acceptedAsReleaseGate: false,
        });
    }
    return records;
}

export function inspectLegacyDirectory(rows: Record<string, unknown>[]) {
    const blockers: Blocker[] = [];
    const resolved = ['StoneMedium', 'EnamelGardenLamp'].map((name) => {
        const matches = rows.filter(
            (row) => object(row.information).name === name,
        );
        const row = matches[0];
        if (matches.length !== 1 || !row) {
            blockers.push({
                gate: 'catalogue',
                code: 'MISSING_LEGACY_DEPENDENCY',
                subject: name,
                detail: 'Exact existing included dependency must uniquely resolve from the same published export',
            });
            return {
                name,
                suppliedCatalogueId: null,
                suppliedIndividualPrice: null,
                metadataStatus: 'blocked',
            };
        }
        const attributes = object(row.attributes);
        const functions = object(row.functions);
        const price = object(row.prices).sunflowers;
        const cover =
            row.image && object(row.image).cover
                ? object(object(row.image).cover).url
                : null;
        const valid =
            typeof row.id === 'number' &&
            Number.isSafeInteger(row.id) &&
            row.id > 0 &&
            row.id <= 2_147_483_647 &&
            typeof price === 'number' &&
            Number.isSafeInteger(price) &&
            price > 0 &&
            price <= 2_147_483_647 &&
            object(row.entityType).name === 'block' &&
            attributes.type === 'decoration' &&
            attributes.spanWidth === 1 &&
            attributes.spanDepth === 1 &&
            attributes.stackable === false &&
            attributes.placeableOnWater === false &&
            attributes.nightOnlyPurchase === false &&
            functions.raisedBed === false &&
            functions.recycler === false &&
            cover === `https://www.gredice.com/assets/blocks/${name}.webp`;
        if (!valid)
            blockers.push({
                gate: 'catalogue',
                code: 'INVALID_LEGACY_DEPENDENCY',
                subject: name,
                detail: 'Check positive unique identity/price, reviewed static1x1 decoration/functions/footprint and exact WWW cover; recipe preparation also validates eligibility/appearance',
            });
        return {
            name,
            suppliedCatalogueId: row.id,
            suppliedIndividualPrice: price,
            metadataStatus: valid ? 'metadata-matches' : 'blocked',
        };
    });
    return { resolved, blockers };
}
