import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    autumnStarterPackRecipes,
    prepareAutumnStarterPacks,
} from '../apps/api/lib/garden/autumnStarterPackPreparation';
import {
    type Blocker,
    boundedFile,
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
const argumentsList = process.argv.slice(2);
const destination = argumentsList.shift();
const options = new Map<string, string>();
for (let index = 0; index < argumentsList.length; index += 2) {
    const key = argumentsList[index];
    const value = argumentsList[index + 1];
    if (
        !['--catalogue', '--products', '--evidence'].includes(key) ||
        !value ||
        options.has(key)
    )
        throw new Error('Unknown, duplicate or missing option');
    options.set(key, value);
}
if (!destination)
    throw new Error(
        'Usage: pnpm preflight:autumn-release <new-output-directory> [--catalogue <published-export.json>] [--products <offers.json>] [--evidence <artifact-index.json>]',
    );
const source = await inspectAutumnSource(repositoryReader(root));
const blockers: Blocker[] = [...source.blockers];
const inputs: { kind: string; path: string; sha256: string; bytes: number }[] =
    [];
async function input(kind: string) {
    const configured = options.get(`--${kind}`);
    if (!configured) return undefined;
    const path = resolve(configured);
    const bytes = await boundedFile(path);
    inputs.push({ kind, path, sha256: sha256(bytes), bytes: bytes.length });
    return JSON.parse(bytes.toString('utf8'));
}
const add = (gate: string, code: string, subject: string, detail: string) =>
    blockers.push({ gate, code, subject, detail });
let directory: ReturnType<typeof inspectDirectory> | undefined;
let preparation: ReturnType<typeof prepareAutumnStarterPacks> | undefined;
let legacy: ReturnType<typeof inspectLegacyDirectory> | undefined;
let products: ReturnType<typeof inspectProducts> = [];
let artifacts: Awaited<ReturnType<typeof inspectArtifacts>> = [];
try {
    const catalogue = await input('catalogue');
    if (catalogue === undefined) {
        for (const item of source.items)
            add(
                'catalogue',
                'NO_PUBLISHED_DIRECTORY',
                item.name,
                `Supply a read-only published-directory export to reconcile family #${item.familyIssue}; source metadata contains no real ID/price`,
            );
        for (const recipe of ['StoneMedium', 'EnamelGardenLamp'])
            add(
                'catalogue',
                'NO_PUBLISHED_DIRECTORY',
                recipe,
                'Supply the legacy included dependency from the actual published directory',
            );
    } else {
        directory = inspectDirectory(catalogue, source.items);
        blockers.push(...directory.blockers);
        legacy = inspectLegacyDirectory(directory.rows);
        blockers.push(...legacy.blockers);
        if (source.reviewedEvidence) {
            preparation = prepareAutumnStarterPacks(
                catalogue,
                source.reviewedEvidence,
            );
            for (const message of preparation.errors)
                add(
                    'products',
                    'RECIPE_PREFLIGHT_BLOCKED',
                    'three starter products',
                    message,
                );
        }
    }
} catch (error) {
    add(
        'catalogue',
        'INVALID_INPUT',
        'published export',
        error instanceof Error ? error.message : 'Invalid catalogue input',
    );
}
try {
    const supplied = await input('products');
    if (supplied === undefined)
        for (const product of [
            'autumn-harvest',
            'autumn-woodland',
            'autumn-evening',
        ])
            add(
                'products',
                'NO_REVIEWED_PRODUCT',
                product,
                'Supply exact reviewed offers only after published-directory and immutable-version preflight; never use fixture IDs',
            );
    else if (!preparation?.ready || source.blockers.length)
        add(
            'products',
            'DEPENDENCY_BLOCKED',
            'offers',
            'Cannot validate supplied products until source and exact published recipes resolve',
        );
    else {
        products = inspectProducts(supplied, preparation);
        for (const product of products)
            if (product.snapshot.publication !== 'published')
                add(
                    'products',
                    'DRAFT_PRODUCT',
                    product.snapshot.productId,
                    'Draft-to-published promotion requires a new immutable content-derived version; preflight does not publish it',
                );
    }
} catch (error) {
    add(
        'products',
        'INVALID_INPUT',
        'offers',
        error instanceof Error ? error.message : 'Invalid product input',
    );
}
try {
    const evidence = await input('evidence');
    if (evidence !== undefined)
        artifacts = await inspectArtifacts(
            evidence,
            root,
            source.sourceFingerprint,
        );
} catch (error) {
    add(
        'evidence',
        'INVALID_INPUT',
        'artifact index',
        error instanceof Error ? error.message : 'Invalid artifact input',
    );
}
// Hash matching local inputs is not independent live/device acceptance. These gates always remain external.
for (const [gate, detail] of [
    [
        'deployment',
        'Independently read back the exact deployed Garden/WWW asset bytes, runtime SHA and catalogue identities before publication. Offline files cannot certify live URLs.',
    ],
    [
        'storage-rollout',
        'Review/apply ordered generated DDL plus exact source-owned pack integrity/provenance guards through the authorized release process; verify real readiness.',
    ],
    [
        'combined-qa',
        'Review final-candidate CI and small/medium/dense seasonal/weather/quality/2D/audio/cleanup matrix against the selected launch scope.',
    ],
    [
        'physical-device',
        'Independent physical touch/audio/sustained-frame/thermal review is required; local artifacts or self-attested booleans cannot clear it.',
    ],
    [
        'live-acceptance',
        'Authorized individual purchase and pack purchase/partial placement/reload/repeat/refund/store/retrieve/withdrawal readback remains required.',
    ],
    [
        'publication',
        'Review final manifest, catalogue/product publication, configuration, Croatian release copy and rollback; all emitted offer sales stay disabled.',
    ],
])
    add(gate, 'EXTERNAL_REVIEW_REQUIRED', 'release candidate', detail);
let headCommit: string | null = null;
let headTree: string | null = null;
let workingTreeStatus: string | null = null;
try {
    headCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 5_000,
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    headTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 5_000,
        maxBuffer: 1_000_000,
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    workingTreeStatus = execFileSync(
        'git',
        ['status', '--porcelain=v1', '--untracked-files=normal'],
        {
            cwd: root,
            encoding: 'utf8',
            timeout: 5_000,
            maxBuffer: 1_000_000,
            stdio: ['ignore', 'pipe', 'ignore'],
        },
    );
} catch {
    /* Source archives are supported; selected bytes are the identity. */
}
const manifest = {
    schemaVersion: 1,
    scope: source.selection.scope,
    headCommit,
    headTree,
    workingTreeStatus,
    gitProvenanceNote:
        'HEAD identifies the base checkout, not necessarily inspected working bytes. Selected byte fingerprint is authoritative; dirty status is preserved. Archives may have null Git provenance.',
    sourceFingerprint: source.sourceFingerprint,
    sourceFiles: source.files,
    families: source.families,
    models: source.models,
    items: source.items.map((item) => ({
        ...item,
        ...(directory?.resolved.find((row) => row.name === item.name) ?? {}),
    })),
    legacyDependencies: Array.isArray(source.selection.legacyDependencies)
        ? source.selection.legacyDependencies.map((value) => {
              const dependency = object(value);
              const observed = legacy?.resolved.find(
                  (row) => row.name === dependency.name,
              );
              return {
                  ...dependency,
                  ...(observed ?? {
                      suppliedCatalogueId: null,
                      suppliedIndividualPrice: null,
                      metadataStatus: 'not-supplied',
                  }),
              };
          })
        : [],
    recipePlan: autumnStarterPackRecipes.map((recipe) => {
        const proof = source.reviewedEvidence?.[recipe.arrangementId];
        return {
            ...recipe,
            previewUrl: `https://vrt.gredice.com/assets/arrangements/${recipe.arrangementId}.png`,
            included: proof?.included ?? [],
            scenery: proof?.scenery ?? [],
            captureSource: proof?.recapture?.source ?? {
                commit: proof?.sourceCommit ?? null,
            },
            note: 'Desktop/high proof source only; original low/static captures are not relabelled as fresh evidence.',
        };
    }),
    products,
    recipes: preparation?.evidence ?? [],
    excludedIssues: source.selection.excludedIssues,
    excludedIssueParts: source.selection.excludedIssueParts,
    foundationIssues: source.selection.foundationIssues,
    exclusionNote: source.selection.exclusionNote,
    note: 'Consolidated local inventory; proposed family prices are deliberately omitted. Supplied IDs/prices are not certified as deployed or published. No offers are installed and all emitted sales are disabled.',
};
const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    headCommit,
    headTree,
    workingTreeStatus,
    gitProvenanceNote:
        'HEAD identifies the base checkout, not necessarily inspected working bytes. Selected byte fingerprint is authoritative; dirty status is preserved. Archives may have null Git provenance.',
    sourceFingerprint: source.sourceFingerprint,
    sourceStatus: source.blockers.length ? 'blocked' : 'source-ready',
    releaseStatus: 'release-blocked',
    counts: {
        families: source.families.length,
        itemIdentities: source.items.length,
        modelAssets: source.models.length,
        inspectedFiles: source.files.length,
        recipeProducts: 3,
        recipeItems: 12,
    },
    suppliedInputs: inputs,
    recipePreflight: preparation
        ? { ready: preparation.ready, errors: preparation.errors }
        : null,
    inspectedArtifacts: artifacts,
    blockers,
    trustBoundary:
        'Offline structural/byte checks only. No network, database, environment changes, publication or independent hardware/live verification. A hashed artifact is not proof of its assertions. Release readiness can never be obtained from this command.',
};
const output = resolve(destination);
await mkdir(output); // Refuse overwrite, including an existing empty directory.
for (const [filename, value] of [
    ['manifest.json', manifest],
    ['report.json', report],
])
    await writeFile(
        resolve(output, filename),
        `${JSON.stringify(value, null, 2)}\n`,
        { flag: 'wx' },
    );
console.log(
    `${report.sourceStatus}; ${report.releaseStatus}; ${blockers.length} actionable blockers. Review ${output}/report.json`,
);
process.exitCode = 1;
