import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/experimental-ct-react';
import { FaunaTrajectoryFixture } from '../../../packages/game/tests/FaunaTrajectoryFixture';
import type {
    FaunaTrajectoryFrame,
    FaunaTrajectoryScenario,
} from '../../../packages/game/tests/faunaTrajectoryState';
import {
    compareFaunaBaseline,
    compareFaunaRenderCadences,
    validateFaunaTrajectoryReport,
} from '../scripts/fauna-trajectory-contract.mjs';

const durationSeconds = 24;
const scenarios: FaunaTrajectoryScenario[] = [
    'day',
    'night',
    'autumn-post-rain',
];
const baseUrl = process.env.GREDICE_GARDEN_BASE_URL ?? 'http://localhost:3101';
const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const fixtureFiles = [
    'packages/game/tests/FaunaTrajectoryFixture.tsx',
    'packages/game/tests/FaunaTrajectoryActors.tsx',
    'packages/game/tests/FaunaTrajectoryDriver.tsx',
    'packages/game/tests/faunaTrajectoryState.ts',
    'apps/garden/tests/fauna-trajectory.spec.tsx',
    'apps/garden/scripts/fauna-trajectory-contract.mjs',
];

async function readFaunaProvenance() {
    const allowedWitnessEdits = new Set([
        ...fixtureFiles,
        'apps/garden/playwright.config.ts',
    ]);
    const dirtyPaths = execFileSync(
        'git',
        ['status', '--porcelain', '-z', '--untracked-files=all'],
        { cwd: sourceRoot, encoding: 'utf8' },
    )
        .split('\0')
        .filter(Boolean)
        .map((entry) => entry.slice(3));
    expect(
        dirtyPaths.filter(
            (file) => mode === 'candidate' || !allowedWitnessEdits.has(file),
        ),
        'Candidate must be clean; reference permits only the named witness/config files',
    ).toEqual([]);
    const hash = createHash('sha256');
    for (const file of fixtureFiles)
        hash.update(await readFile(path.join(sourceRoot, file)));
    // Runtime bytes must match their recorded checkout commit even when the
    // supplemental witness/config files are uncommitted in the reference tree.
    execFileSync(
        'git',
        [
            'diff',
            '--exit-code',
            'HEAD',
            '--',
            'packages/game/src',
            'packages/js/src',
        ],
        { cwd: sourceRoot },
    );
    const runtime = createHash('sha256');
    const runtimeFiles = execFileSync(
        'git',
        ['ls-files', '-z', 'packages/game/src', 'packages/js/src'],
        { cwd: sourceRoot, encoding: 'utf8' },
    )
        .split('\0')
        .filter(Boolean);
    for (const file of runtimeFiles) {
        runtime.update(file);
        runtime.update(await readFile(path.join(sourceRoot, file)));
    }
    return {
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: sourceRoot,
            encoding: 'utf8',
        }).trim(),
        fixtureHash: hash.digest('hex'),
        runtimeHash: runtime.digest('hex'),
        configHash: createHash('sha256')
            .update(
                await readFile(
                    path.join(sourceRoot, 'apps/garden/playwright.config.ts'),
                ),
            )
            .digest('hex'),
        environment: {
            assetBaseUrl: baseUrl,
            reuseServer: process.env.GREDICE_PLAYWRIGHT_REUSE_SERVER === 'true',
            browserProject: 'chromium-webgl',
        },
    };
}
let frozenProvenance:
    | Awaited<ReturnType<typeof readFaunaProvenance>>
    | undefined;

const mode =
    process.env.FAUNA_TRAJECTORY_MODE === 'baseline' ? 'baseline' : 'candidate';
const captures: {
    scenario: FaunaTrajectoryScenario;
    fps: number;
    frames: FaunaTrajectoryFrame[];
    suspension: {
        pass: boolean;
        scope: 'manual-replay';
        automaticHiddenAdvances: number | undefined;
        hidden: FaunaTrajectoryFrame | undefined;
        resumed: FaunaTrajectoryFrame | undefined;
    };
}[] = [];

test.describe('actual production fauna trajectories', () => {
    test.skip(
        mode !== 'baseline' && !process.env.FAUNA_TRAJECTORY_REFERENCE,
        'Supplemental parity replay requires an isolated frozen legacy reference; ordinary CI runs the independent runtime phase fixture',
    );
    // A fresh browser page for each replay also resets performance.now, asset
    // loading and hook mount order. Capture aggregation runs in one worker.
    test.describe.configure({ mode: 'serial' });
    test.beforeAll(async () => {
        frozenProvenance = await readFaunaProvenance();
    });
    for (const scenario of scenarios) {
        for (const fps of [30, 60]) {
            test(`${scenario} at ${fps} Hz`, async ({ mount, page }) => {
                test.setTimeout(120_000);
                const browserErrors: string[] = [];
                page.on('pageerror', (error) =>
                    browserErrors.push(error.message),
                );
                // CT uses a separate origin; return the unmodified production
                // asset bytes with CORS enabled for this browser fixture only.
                await page.route(`${baseUrl}/assets/**`, async (route) => {
                    const response = await route.fetch();
                    await route.fulfill({
                        response,
                        headers: {
                            ...response.headers(),
                            'access-control-allow-origin': '*',
                        },
                    });
                });
                await page.clock.install({
                    time: new Date('2026-10-22T12:00:00Z'),
                });
                await page.clock.pauseAt(new Date('2026-10-22T12:01:00Z'));
                const fixture = await mount(
                    <FaunaTrajectoryFixture
                        appBaseUrl={baseUrl}
                        scenario={scenario}
                    />,
                );
                await expect(
                    fixture.getByTestId('fauna-assets-ready'),
                ).toHaveText('true', { timeout: 30_000 });
                // Canvas measurement and React scheduling use queued timers;
                // release a fixed preparation interval before any actor frames.
                await page.clock.runFor(1000);
                expect(browserErrors).toEqual([]);
                await expect
                    .poll(
                        () =>
                            page.evaluate(() =>
                                window.faunaTrajectoryWitness?.ready(),
                            ),
                        { timeout: 30_000 },
                    )
                    .toBe(true);
                // Rain history is observed by actual Slugs before switching to the
                // post-rain habitat. Simulation has not advanced while assets loaded.
                if (scenario === 'autumn-post-rain') {
                    await page.clock.runFor(100);
                    await fixture.getByTestId('fauna-after-rain').click();
                    await page.clock.runFor(0);
                    await expect
                        .poll(() =>
                            page.evaluate(
                                () =>
                                    window.faunaTrajectoryWitness
                                        ?.snapshot()
                                        .actors.filter(
                                            (actor) => actor.species === 'Slug',
                                        ).length ?? 0,
                            ),
                        )
                        .toBe(2);
                    await expect
                        .poll(() =>
                            page.evaluate(
                                () =>
                                    window.faunaTrajectoryWitness
                                        ?.snapshot()
                                        .actors.filter(
                                            (actor) => actor.species === 'Bee',
                                        ).length ?? 0,
                            ),
                        )
                        .toBe(1);
                }
                const frames: FaunaTrajectoryFrame[] = [];
                const first = await page.evaluate(() =>
                    window.faunaTrajectoryWitness?.step(0),
                );
                expect(first).toBeDefined();
                if (!first) throw new Error('Missing actual actor driver');
                frames.push(first);
                for (let index = 1; index <= durationSeconds * fps; index++) {
                    const wallMs =
                        Math.floor((index * 1000) / fps) -
                        Math.floor(((index - 1) * 1000) / fps);
                    await page.clock.runFor(wallMs);
                    if (index === fps * 8) {
                        await page.evaluate(() =>
                            window.faunaTrajectoryWitness?.command({
                                species: 'Cow',
                                behavior: 'trot',
                            }),
                        );
                        await page.clock.runFor(0);
                    }
                    const frame = await page.evaluate(
                        (delta) => window.faunaTrajectoryWitness?.step(delta),
                        1 / fps,
                    );
                    if (!frame)
                        throw new Error(
                            'Driver disappeared during actual species replay',
                        );
                    frames.push(frame);
                }
                await page.evaluate(() => {
                    Object.defineProperty(document, 'hidden', {
                        configurable: true,
                        value: true,
                    });
                    document.dispatchEvent(new Event('visibilitychange'));
                });
                await expect
                    .poll(() =>
                        page.evaluate(
                            () =>
                                window.faunaTrajectoryWitness?.snapshot()
                                    .visible,
                        ),
                    )
                    .toBe(false);
                const hidden = await page.evaluate(() =>
                    window.faunaTrajectoryWitness?.snapshot(),
                );
                await page.clock.runFor(10_000);
                await page.evaluate(() =>
                    window.faunaTrajectoryWitness?.step(10),
                );
                const unchanged = await page.evaluate(() =>
                    window.faunaTrajectoryWitness?.snapshot(),
                );
                expect(unchanged).toEqual(hidden);
                const hiddenAttempts = await page.evaluate(() =>
                    window.faunaTrajectoryWitness?.automaticHiddenAdvances(),
                );
                expect(hiddenAttempts).toBe(0);
                await page.evaluate(() => {
                    Object.defineProperty(document, 'hidden', {
                        configurable: true,
                        value: false,
                    });
                    document.dispatchEvent(new Event('visibilitychange'));
                });
                await expect
                    .poll(() =>
                        page.evaluate(
                            () =>
                                window.faunaTrajectoryWitness?.snapshot()
                                    .visible,
                        ),
                    )
                    .toBe(true);
                const resumed = await page.evaluate(
                    (delta) => window.faunaTrajectoryWitness?.step(delta),
                    1 / fps,
                );
                expect(resumed?.time).toBeCloseTo(frames.at(-1)?.time ?? 0, 1);
                captures.push({
                    scenario,
                    fps,
                    frames,
                    suspension: {
                        pass: true,
                        scope: 'manual-replay',
                        automaticHiddenAdvances: hiddenAttempts,
                        hidden,
                        resumed,
                    },
                });
                await fixture.unmount();
                await page.clock.resume();
            });
        }
    }
    test.afterAll(async ({ browser }, testInfo) => {
        expect(browser.isConnected()).toBe(true);
        if (captures.length !== scenarios.length * 2) return;
        expect(
            await readFaunaProvenance(),
            'Capture source and fixture must stay frozen',
        ).toEqual(frozenProvenance);
        if (!frozenProvenance)
            throw new Error('Missing frozen capture provenance');
        const report = {
            schemaVersion: 1,
            mode,
            ...frozenProvenance,
            durationSeconds,
            captures,
        };
        validateFaunaTrajectoryReport(report);
        const output =
            process.env.FAUNA_TRAJECTORY_OUTPUT ??
            testInfo.outputPath(`fauna-trajectory-${mode}.json`);
        // Full joint traces can exceed a single JS string's size. Stream the
        // JSON frames while retaining the complete machine-readable report.
        const handle = await open(output, 'w');
        try {
            const { captures: reportCaptures, ...metadata } = report;
            await handle.write(
                `${JSON.stringify(metadata).slice(0, -1)},"captures":[`,
            );
            for (const [index, capture] of reportCaptures.entries()) {
                const { frames, ...captureMetadata } = capture;
                await handle.write(
                    `${index ? ',' : ''}${JSON.stringify(captureMetadata).slice(0, -1)},"frames":[`,
                );
                for (const [frameIndex, frame] of frames.entries()) {
                    await handle.write(
                        `${frameIndex ? ',' : ''}${JSON.stringify(frame)}`,
                    );
                }
                await handle.write(']}');
            }
            await handle.write(']}');
        } finally {
            await handle.close();
        }
        await testInfo.attach('actual-fauna-trajectories', {
            path: output,
            contentType: 'application/json',
        });
        if (mode === 'candidate') {
            const reference = process.env.FAUNA_TRAJECTORY_REFERENCE
                ? validateFaunaTrajectoryReport(
                      JSON.parse(
                          await readFile(
                              process.env.FAUNA_TRAJECTORY_REFERENCE,
                              'utf8',
                          ),
                      ),
                  )
                : undefined;
            if (reference) {
                const comparison = compareFaunaBaseline(reference, report);
                await testInfo.attach('actual-fauna-baseline-parity', {
                    body: JSON.stringify(comparison),
                    contentType: 'application/json',
                });
            }
            const cadence = scenarios.map((scenario) => {
                const ambient = captures.find(
                    (capture) =>
                        capture.scenario === scenario && capture.fps === 30,
                );
                const interactive = captures.find(
                    (capture) =>
                        capture.scenario === scenario && capture.fps === 60,
                );
                if (!ambient || !interactive)
                    throw new Error(
                        'Incomplete actual render cadence captures',
                    );
                return compareFaunaRenderCadences(
                    ambient,
                    interactive,
                    reference
                        ? {
                              ambient: reference.captures.find(
                                  (capture: (typeof captures)[number]) =>
                                      capture.scenario === scenario &&
                                      capture.fps === 30,
                              ),
                              interactive: reference.captures.find(
                                  (capture: (typeof captures)[number]) =>
                                      capture.scenario === scenario &&
                                      capture.fps === 60,
                              ),
                          }
                        : undefined,
                );
            });
            await testInfo.attach('actual-fauna-cadence', {
                body: JSON.stringify(cadence),
                contentType: 'application/json',
            });
        }
    });
});
