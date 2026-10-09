import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const output = path.join(here, '.output');
const gameRequire = createRequire(
    path.join(root, 'packages/game/package.json'),
);
const gardenRequire = createRequire(
    path.join(root, 'apps/garden/package.json'),
);
const toolRequire = createRequire(gameRequire.resolve('tsx/package.json'));
const { build } = toolRequire('esbuild');
const { chromium, devices } = gardenRequire('@playwright/test');
const sharp = gardenRequire('sharp');
const port = Number(process.env.POC_PORT ?? 4179);
const quick = process.argv.includes('--quick');
const bundles = process.argv.includes('--bundles');
const mobile = process.argv.includes('--mobile');
assert.ok(!(mobile && bundles), 'Run --mobile and --bundles separately');
const device = mobile ? devices['iPhone 14'] : null;
const serveOnly = process.argv.includes('--serve');
const repetitions = Number(process.env.POC_REPEATS ?? (quick ? 1 : 3));
const stamp = new Date()
    .toISOString()
    .replaceAll(':', '-')
    .replaceAll('.', '-');
const reportDir = path.join(output, stamp);
await mkdir(reportDir, { recursive: true });
await build({
    entryPoints: [path.join(here, 'client.mjs')],
    outfile: path.join(output, 'client.js'),
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"production"' },
});
// Pinned compiler is a transient pnpm tool; no application dependency is added.
execFileSync(
    'pnpm',
    [
        '--package=wabt@1.0.39',
        'dlx',
        'wat2wasm',
        path.join(here, 'transform.wat'),
        '-o',
        path.join(output, 'transform.wasm'),
    ],
    { cwd: root, stdio: 'inherit' },
);
const routes = new Map([
    ['/', [path.join(here, 'index.html'), 'text/html']],
    ['/client.js', [path.join(output, 'client.js'), 'text/javascript']],
    [
        '/transform.wasm',
        [path.join(output, 'transform.wasm'), 'application/wasm'],
    ],
    ...['BlockGrass', 'Tree', 'GardenBox'].map((name) => [
        `/assets/${name}.glb`,
        [
            path.join(root, `apps/garden/public/assets/models/${name}.glb`),
            'model/gltf-binary',
        ],
    ]),
]);
const server = createServer(async (req, res) => {
    const route = routes.get(
        new URL(req.url, `http://127.0.0.1:${port}`).pathname,
    );
    if (!route) {
        res.writeHead(404);
        res.end();
        return;
    }
    try {
        const data = await readFile(route[0]);
        res.writeHead(200, {
            'content-type': route[1],
            'cache-control': 'no-store',
            'cross-origin-opener-policy': 'same-origin',
            'cross-origin-embedder-policy': 'require-corp',
        });
        res.end(data);
    } catch {
        res.writeHead(500);
        res.end();
    }
});
await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
});
console.log(`POC available at http://127.0.0.1:${port}`);
if (serveOnly) {
    process.once('SIGINT', () => server.close());
    process.once('SIGTERM', () => server.close());
} else {
    let browser;
    try {
        const args = [
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            ...(process.platform === 'darwin'
                ? ['--use-gl=angle', '--use-angle=metal']
                : []),
        ];
        browser = await chromium.launch({
            headless: !process.argv.includes('--headed'),
            args,
        });
        const cdp = await browser.newBrowserCDPSession();
        const systemInfo = await cdp.send('SystemInfo.getInfo');
        const digest = createHash('sha256');
        const snapshotDir = path.join(reportDir, 'sources');
        await mkdir(snapshotDir, { recursive: true });
        for (const name of (await readdir(here))
            .filter((name) => /\.(mjs|wat|html)$/.test(name))
            .sort()) {
            const source = await readFile(path.join(here, name));
            digest.update(name).update(source);
            await writeFile(path.join(snapshotDir, name), source);
        }
        const bundle = await readFile(path.join(output, 'client.js'));
        const wasm = await readFile(path.join(output, 'transform.wasm'));
        await writeFile(path.join(snapshotDir, 'client.bundle.js'), bundle);
        await writeFile(path.join(snapshotDir, 'transform.wasm'), wasm);
        const report = {
            capturedAt: new Date().toISOString(),
            sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
                cwd: root,
                encoding: 'utf8',
            }).trim(),
            sourceStatus: execFileSync('git', ['status', '--short'], {
                cwd: root,
                encoding: 'utf8',
            }).trim(),
            experimentSourceSha256: digest.digest('hex'),
            bundleSha256: createHash('sha256').update(bundle).digest('hex'),
            wasmSha256: createHash('sha256').update(wasm).digest('hex'),
            bundleBytes: bundle.length,
            bundleGzipBytes: gzipSync(bundle).length,
            wasmBytes: wasm.length,
            node: process.version,
            platform: `${os.platform()} ${os.release()} ${os.arch()}`,
            cpuModel: os.cpus()[0]?.model,
            memoryBytes: os.totalmem(),
            browser: browser.version(),
            browserEngine: 'Chromium',
            deviceEmulation: device,
            cpuThrottleNote: mobile
                ? 'CDP slowdown relative to this host CPU; not calibrated to an iPhone A15. GPU is not throttled.'
                : null,
            headless: !process.argv.includes('--headed'),
            browserArgs: args,
            gpu: systemInfo.gpu.devices,
            measurements: [],
            cpu: [],
            visualComparisons: [],
        };
        for (const name of ['BlockGrass', 'Tree', 'GardenBox']) {
            const asset = await readFile(
                path.join(root, `apps/garden/public/assets/models/${name}.glb`),
            );
            report[`${name}Sha256`] = createHash('sha256')
                .update(asset)
                .digest('hex');
        }
        const allCases = quick
            ? [
                  {
                      name: bundles ? 'garden-no-shadows' : 'garden',
                      side: 16,
                      dpr: 1,
                      shadows: bundles ? 0 : 1,
                      layout: 'batched',
                  },
              ]
            : [
                  {
                      name: 'garden',
                      side: 16,
                      dpr: 1,
                      shadows: 1,
                      layout: 'batched',
                  },
                  {
                      name: 'large',
                      side: 32,
                      dpr: 1.5,
                      shadows: 1,
                      layout: 'batched',
                  },
                  {
                      name: 'large-no-shadows',
                      side: 32,
                      dpr: 1,
                      shadows: 0,
                      layout: 'batched',
                  },
                  {
                      name: 'draw-stress',
                      side: 32,
                      dpr: 1,
                      shadows: 0,
                      layout: 'individual',
                  },
              ];
        const mobileCases = [
            { name: 'phone-garden-native', side: 16, dpr: 3, cpuSlowdown: 1 },
            { name: 'phone-garden-4x', side: 16, dpr: 3, cpuSlowdown: 4 },
            { name: 'phone-large-4x', side: 32, dpr: 3, cpuSlowdown: 4 },
            {
                name: 'phone-large-4x-capped',
                side: 32,
                dpr: 1.5,
                cpuSlowdown: 4,
            },
        ].map((scenario) => ({ ...scenario, shadows: 1, layout: 'batched' }));
        const cases = mobile
            ? quick
                ? mobileCases.slice(1, 2)
                : mobileCases
            : bundles && !quick
              ? allCases.filter((scenario) =>
                    ['large-no-shadows', 'draw-stress'].includes(scenario.name),
                )
              : allCases;
        const backends = mobile
            ? ['webgl', 'webgpu']
            : bundles
              ? ['webgl', 'webgpu', 'webgpu-bundle']
              : ['webgl', 'webgpu', 'webgpu-gl'];
        const save = async () =>
            writeFile(
                path.join(reportDir, 'results.json'),
                `${JSON.stringify(report, null, 2)}\n`,
            );
        for (let repeat = 0; repeat < repetitions; repeat++)
            for (const scenario of cases) {
                const screenshots = new Map();
                // Rotate order across repeats to reduce systematic ordering bias.
                const order = backends.map(
                    (_, i) => backends[(i + repeat) % backends.length],
                );
                for (const backend of order) {
                    const context = await browser.newContext(
                        device ?? {
                            viewport: { width: 1000, height: 850 },
                            deviceScaleFactor: 1,
                        },
                    );
                    const page = await context.newPage();
                    const cpuSlowdown = scenario.cpuSlowdown ?? 1;
                    if (mobile) {
                        const pageCDP = await context.newCDPSession(page);
                        await pageCDP.send('Emulation.setCPUThrottlingRate', {
                            rate: cpuSlowdown,
                        });
                    }
                    const errors = [];
                    const warnings = [];
                    page.on('pageerror', (error) => errors.push(String(error)));
                    page.on('console', (message) => {
                        if (message.type() === 'error')
                            errors.push(message.text());
                        else if (message.type() === 'warning')
                            warnings.push(message.text());
                    });
                    try {
                        const query = new URLSearchParams({
                            ...scenario,
                            backend,
                            automation: '1',
                            ...(mobile ? { device: 'iphone14' } : {}),
                        });
                        await page.goto(`http://127.0.0.1:${port}/?${query}`);
                        await page.waitForFunction(
                            () =>
                                window.engineMigration ||
                                window.engineMigrationError,
                            undefined,
                            { timeout: 60000 },
                        );
                        const initError = await page.evaluate(
                            () => window.engineMigrationError,
                        );
                        if (initError) throw new Error(initError);
                        const result = await page.evaluate(
                            (quick) =>
                                window.engineMigration.sample({
                                    warmup: quick ? 20 : 90,
                                    frames: quick ? 60 : 240,
                                }),
                            quick,
                        );
                        if (mobile) {
                            assert.deepEqual(
                                result.meta.viewport,
                                device.viewport,
                            );
                            assert.deepEqual(result.meta.screen, device.screen);
                            assert.equal(
                                result.meta.reportedDpr,
                                device.deviceScaleFactor,
                            );
                            assert.ok(
                                result.meta.maxTouchPoints > 0,
                                'Touch emulation inactive',
                            );
                            assert.equal(
                                result.meta.backingWidth,
                                device.viewport.width * scenario.dpr,
                            );
                            assert.equal(
                                result.meta.backingHeight,
                                device.viewport.height * scenario.dpr,
                            );
                        }
                        if (bundles)
                            await page.evaluate(() =>
                                window.engineMigration.pose(Math.PI / 4 + 0.15),
                            );
                        const screenshotPath = path.join(
                            reportDir,
                            `${scenario.name}-${repeat}-${backend}.png`,
                        );
                        await page
                            .locator('canvas')
                            .screenshot({ path: screenshotPath });
                        const pixels = await sharp(screenshotPath)
                            .removeAlpha()
                            .raw()
                            .toBuffer({ resolveWithObject: true });
                        const stats = await sharp(screenshotPath).stats();
                        assert.ok(
                            stats.channels.some(
                                (channel) => channel.stdev > 10,
                            ),
                            'Blank canvas',
                        );
                        screenshots.set(backend, pixels);
                        assert.deepEqual(
                            errors,
                            [],
                            'Browser errors invalidate the measurement',
                        );
                        report.measurements.push({
                            scenario: scenario.name,
                            repeat,
                            cpuSlowdown,
                            warnings,
                            ...result,
                        });
                        console.log(
                            `${scenario.name} ${repeat} ${backend}: ${result.deliveredFps.toFixed(1)} FPS, CPU ${result.cpuMs.median.toFixed(3)} ms, GPU ${result.gpuMs?.median.toFixed(3) ?? 'unavailable'} ms, ${result.draws.median} draws, ${result.triangles.median} triangles`,
                        );
                        if (scenario.name === 'garden' && backend === 'webgl') {
                            report.cpu.push({
                                repeat,
                                ...(await page.evaluate(() =>
                                    window.engineMigration.cpu(),
                                )),
                            });
                        }
                        await save();
                    } finally {
                        await context.close();
                    }
                }
                const reference = screenshots.get('webgl');
                for (const backend of backends.slice(1)) {
                    const other = screenshots.get(backend);
                    assert.equal(
                        reference.data.length,
                        other.data.length,
                        'Different screenshot dimensions',
                    );
                    let sum = 0;
                    let changed = 0;
                    for (let i = 0; i < reference.data.length; i++) {
                        const delta = Math.abs(
                            reference.data[i] - other.data[i],
                        );
                        sum += delta;
                        if (delta > 10) changed++;
                    }
                    report.visualComparisons.push({
                        scenario: scenario.name,
                        repeat,
                        backend,
                        meanAbsoluteChannelError: sum / reference.data.length,
                        fractionChannelsOver10: changed / reference.data.length,
                    });
                    assert.ok(
                        changed / reference.data.length < 0.001,
                        'Visual mismatch: over 0.1% of color channels differ by >10/255',
                    );
                }
                const group = report.measurements.filter(
                    (result) =>
                        result.scenario === scenario.name &&
                        result.repeat === repeat,
                );
                const baseline = group.find(
                    (result) => result.meta.backend === 'webgl',
                );
                assert.ok(
                    group
                        .filter(
                            (result) => result.meta.backend !== 'webgpu-bundle',
                        )
                        .every(
                            (result) =>
                                result.triangles.median -
                                    result.meta.outputPassTriangles ===
                                baseline.triangles.median -
                                    baseline.meta.outputPassTriangles,
                        ),
                    'Scene/shadow triangle count mismatch',
                );
                assert.ok(
                    group.every(
                        (result) =>
                            result.meta.terrainCells ===
                                group[0].meta.terrainCells &&
                            result.meta.objects === group[0].meta.objects,
                    ),
                    'Scene population mismatch',
                );
                assert.ok(
                    group.every(
                        (result) =>
                            result.meta.sceneTriangles ===
                            group[0].meta.sceneTriangles,
                    ),
                    'Source geometry triangle mismatch',
                );
                await save();
            }
        report.completedAt = new Date().toISOString();
        await save();
        console.log(`Results: ${path.join(reportDir, 'results.json')}`);
    } finally {
        await browser?.close();
        await new Promise((resolve) => server.close(resolve));
    }
}
