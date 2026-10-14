import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicationDigest } from '../packages/storage/src/helpers/autumnPublicationPlan';
import {
    assertAuthoritativeAutumnPublicationPlan,
    createAutumnPublicationPlan,
    createAutumnPublishedPackCandidates,
} from './autumn-publication-plan-core';
import {
    boundedFile,
    inspectAutumnSource,
    repositoryReader,
    sha256,
} from './autumn-release-preflight-core';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const destination = args.shift();
const options = new Map<string, string>();
for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (
        ![
            '--mode',
            '--cms',
            '--catalogue',
            '--window',
            '--plan',
            '--digest',
            '--actor-id',
            '--actor-name',
            '--scope',
        ].includes(key) ||
        !value ||
        options.has(key)
    )
        throw new Error('Unknown, duplicate or missing option');
    options.set(key, value);
}
const mode = options.get('--mode') ?? 'plan';
if (
    !destination ||
    !['plan', 'candidates', 'export-cms', 'apply'].includes(mode)
)
    throw new Error(
        'Usage: pnpm plan:autumn-publication <new-output-directory> [--mode plan|candidates|export-cms|apply] [mode-specific options; see docs/autumn-publication-plan.md]',
    );
const allowed: Record<string, string[]> = {
    plan: ['--mode', '--cms'],
    candidates: ['--mode', '--catalogue', '--window'],
    'export-cms': ['--mode', '--scope'],
    apply: [
        '--mode',
        '--plan',
        '--digest',
        '--actor-id',
        '--actor-name',
        '--scope',
    ],
};
if ([...options.keys()].some((key) => !allowed[mode].includes(key)))
    throw new Error('Option is not valid for selected mode');
const output = resolve(destination);
await mkdir(output); // Fail before reads/writes if an existing output would be overwritten.
async function write(name: string, value: unknown) {
    await writeFile(
        resolve(output, name),
        `${JSON.stringify(value, null, 2)}\n`,
        { flag: 'wx' },
    );
}
const inputs: { option: string; sha256: string; bytes: number }[] = [];
async function input(key: string) {
    const path = options.get(key);
    if (!path) throw new Error(`Required local input: ${key}`);
    const bytes = await boundedFile(resolve(path));
    inputs.push({ option: key, sha256: sha256(bytes), bytes: bytes.length });
    return JSON.parse(bytes.toString('utf8'));
}
function requireScope() {
    if (options.get('--scope') !== 'autumn-ab-pilot')
        throw new Error('Explicit --scope autumn-ab-pilot required');
}
let stage = 'source';
let databaseOutcome: 'not-accessed' | 'unknown' | 'committed' | 'read-only' =
    'not-accessed';
try {
    const source = await inspectAutumnSource(repositoryReader(root));
    if (source.blockers.length) {
        await write('report.json', {
            mode,
            status: 'blocked',
            sourceFingerprint: source.sourceFingerprint,
            blockers: source.blockers,
            releaseReady: false,
        });
        process.exitCode = 1;
    } else if (mode === 'plan') {
        stage = 'local-input';
        if (!options.has('--cms')) {
            await write('report.json', {
                mode,
                status: 'blocked',
                sourceFingerprint: source.sourceFingerprint,
                requiredInput:
                    'Bounded raw CMS block definitions/entities/latest revisions export; IDs and prices must be real',
                unresolved: source.items.map((item) => ({
                    name: item.name,
                    id: null,
                    reviewedAttributes: item.attributes,
                })),
                legacyDependencies: source.selection.legacyDependencies,
                releaseReady: false,
            });
            process.exitCode = 1;
        } else {
            const plan = createAutumnPublicationPlan(
                source,
                await input('--cms'),
            );
            await write('publication-plan.json', plan);
            await write('report.json', {
                mode,
                status: 'plan-prepared',
                planDigest: publicationDigest(plan),
                sourceFingerprint: source.sourceFingerprint,
                inputs,
                operations: plan.operations.map((operation) => ({
                    name: operation.name,
                    id: operation.expected.id,
                    action: operation.action,
                    actualPrice: operation.actualPrice,
                })),
                legacyDependencies: source.selection.legacyDependencies,
                blockedUntil: [
                    'fresh deployed byte verification',
                    'current locked CMS comparison',
                    'published-directory readback for product candidates',
                ],
                releaseReady: false,
            });
        }
    } else if (mode === 'candidates') {
        stage = 'local-input';
        const offers = createAutumnPublishedPackCandidates(
            source,
            await input('--catalogue'),
            await input('--window'),
        );
        await write('sales-disabled-candidates.json', offers);
        await write('report.json', {
            mode,
            status: 'candidates-prepared',
            inputs,
            sourceFingerprint: source.sourceFingerprint,
            products: offers.map((offer) => ({
                productId: offer.snapshot.productId,
                versionId: offer.snapshot.productVersionId,
                chargedSunflowers: offer.snapshot.chargedSunflowers,
            })),
            configurationInstalled: false,
            salesEnabled: false,
            releaseReady: false,
        });
    } else if (mode === 'export-cms') {
        requireScope();
        stage = 'database';
        databaseOutcome = 'read-only';
        const { exportAutumnPublicationCms } = await import(
            '../packages/storage/src/repositories/autumnPublicationRepo'
        );
        const { closeStorage } = await import(
            '../packages/storage/src/storage'
        );
        try {
            await write('cms-export.json', await exportAutumnPublicationCms());
        } finally {
            await closeStorage();
        }
        await write('report.json', {
            mode,
            status: 'read-only-cms-exported',
            releaseReady: false,
        });
    } else {
        stage = 'local-input';
        requireScope();
        const digest = options.get('--digest');
        const actorId = options.get('--actor-id');
        const actorName = options.get('--actor-name');
        if (!digest || !/^[a-f0-9]{64}$/.test(digest) || !actorId || !actorName)
            throw new Error(
                'Exact --digest and explicit --actor-id / --actor-name required',
            );
        if (
            execFileSync(
                'git',
                ['status', '--porcelain=v1', '--untracked-files=normal'],
                { cwd: root, encoding: 'utf8' },
            ).trim()
        )
            throw new Error('Apply requires a clean committed checkout');
        const plan = assertAuthoritativeAutumnPublicationPlan(
            source,
            await input('--plan'),
        );
        if (publicationDigest(plan) !== digest)
            throw new Error('Reviewed plan digest differs');
        stage = 'deployed-bytes';
        const { verifyAutumnPublicationDeployment } = await import(
            '../packages/storage/src/helpers/autumnPublicationDeployment'
        );
        const proof = await verifyAutumnPublicationDeployment(plan);
        stage = 'database';
        databaseOutcome = 'unknown';
        const { applyAutumnPublicationPlan } = await import(
            '../packages/storage/src/repositories/autumnPublicationRepo'
        );
        const { closeStorage } = await import(
            '../packages/storage/src/storage'
        );
        try {
            const result = await applyAutumnPublicationPlan(
                plan,
                digest,
                proof,
                { id: actorId, name: actorName },
            );
            databaseOutcome = 'committed';
            stage = 'report';
            await write('report.json', {
                mode,
                status: 'catalogue-batch-published',
                inputs,
                ...result,
            });
            if (result.refreshStatus !== 'completed') process.exitCode = 1;
        } finally {
            await closeStorage();
        }
    }
} catch (error) {
    // Database errors may carry clients/connection details. Never dump them.
    const detail =
        stage === 'database'
            ? 'Publication/export failed or stale CMS precondition. Commit response may be uncertain: retry only the same reviewed plan. No credential-bearing diagnostics are emitted.'
            : stage === 'report'
              ? 'Database committed; artifact reporting failed. Retry the same reviewed plan to repair reporting/refresh without another publication.'
              : stage === 'deployed-bytes'
                ? 'Reviewed deployed byte verification failed; no database access occurred.'
                : error instanceof Error
                  ? error.message
                  : 'Invalid local input';
    const report = {
        mode,
        status: 'blocked',
        stage,
        detail,
        databaseOutcome,
        inputs,
        releaseReady: false,
    };
    try {
        await write('error-report.json', report);
    } catch {
        process.stderr.write(`${JSON.stringify(report)}\n`);
    }
    process.exitCode = 1;
}
