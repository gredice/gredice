import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
    chmodSync,
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, resolve } from 'node:path';
import { describe, it } from 'node:test';
import {
    getAppAllowedDevOrigins,
    getAppByName,
    getAppDevPort,
    getWorktreeProxyHttpPort,
    getWorktreeProxyHttpsPort,
    getWorktreeSlug,
} from './app-registry.ts';
import {
    childProcessTreeOptions,
    processStatesIncludeLiveProcess,
    terminateChildProcessTree,
} from './process-tree.mjs';

function withEnv(updates, callback) {
    const previousValues = new Map();

    for (const [key, value] of Object.entries(updates)) {
        previousValues.set(key, process.env[key]);
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        callback();
    } finally {
        for (const [key, value] of previousValues) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

function runAppCommandForTest(command, env = {}) {
    const binDir = mkdtempSync(resolve(tmpdir(), 'gredice-app-command-'));
    const nextPath = resolve(binDir, 'next');
    const repoRoot = resolve(import.meta.dirname, '..');
    const childEnv = {
        ...process.env,
        ...env,
        PATH: `${binDir}${delimiter}${process.env.PATH}`,
    };
    if (!Object.hasOwn(env, 'GREDICE_API_HOST')) {
        delete childEnv.GREDICE_API_HOST;
    }
    writeFileSync(
        nextPath,
        [
            '#!/usr/bin/env node',
            "console.log(JSON.stringify({ args: process.argv.slice(2), apiHost: process.env.GREDICE_API_HOST }));",
        ].join('\n'),
    );
    chmodSync(nextPath, 0o755);

    try {
        return spawnSync(
            process.execPath,
            [
                '--experimental-strip-types',
                resolve(import.meta.dirname, 'run-app-command.mjs'),
                command,
            ],
            {
                cwd: resolve(repoRoot, 'apps', 'app'),
                env: childEnv,
                encoding: 'utf8',
            },
        );
    } finally {
        rmSync(binDir, { recursive: true, force: true });
    }
}

async function delay(milliseconds) {
    await new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

async function waitForFile(filePath, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
        if (existsSync(filePath)) {
            return true;
        }

        await delay(50);
    }

    return existsSync(filePath);
}

async function waitForChildExit(child, timeoutMs = 5000) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return { code: child.exitCode, signal: child.signalCode };
    }

    return await new Promise((resolvePromise, rejectPromise) => {
        const timeout = setTimeout(() => {
            rejectPromise(new Error(`Timed out waiting for child ${child.pid}`));
        }, timeoutMs);

        child.once('exit', (code, signal) => {
            clearTimeout(timeout);
            resolvePromise({ code, signal });
        });
        child.once('error', (error) => {
            clearTimeout(timeout);
            rejectPromise(error);
        });
    });
}

function spawnRunAppCommand(command, env = {}) {
    const binDir = mkdtempSync(resolve(tmpdir(), 'gredice-app-command-'));
    const nextPath = resolve(binDir, 'next');
    const repoRoot = resolve(import.meta.dirname, '..');
    const childEnv = {
        ...process.env,
        ...env,
        PATH: `${binDir}${delimiter}${process.env.PATH}`,
    };
    writeFileSync(
        nextPath,
        [
            '#!/usr/bin/env node',
            "import { writeFileSync } from 'node:fs';",
            'const readyPath = process.env.GREDICE_TEST_READY_PATH;',
            'const signalPath = process.env.GREDICE_TEST_SIGNAL_PATH;',
            'process.on("SIGINT", () => {',
            '    writeFileSync(signalPath, "SIGINT");',
            '    process.exit(0);',
            '});',
            'process.on("SIGTERM", () => {',
            '    writeFileSync(signalPath, "SIGTERM");',
            '    process.exit(0);',
            '});',
            'writeFileSync(readyPath, "ready");',
            'setInterval(() => {}, 1000);',
        ].join('\n'),
    );
    chmodSync(nextPath, 0o755);

    const child = spawn(
        process.execPath,
        [
            '--experimental-strip-types',
            resolve(import.meta.dirname, 'run-app-command.mjs'),
            command,
        ],
        {
            cwd: resolve(repoRoot, 'apps', 'app'),
            env: childEnv,
            stdio: 'ignore',
        },
    );

    return { binDir, child };
}

function spawnDevWithProxy(env = {}) {
    const binDir = mkdtempSync(resolve(tmpdir(), 'gredice-dev-proxy-'));
    const turboPath = resolve(binDir, 'turbo');
    const repoRoot = resolve(import.meta.dirname, '..');
    const childEnv = {
        ...process.env,
        ...env,
        PATH: `${binDir}${delimiter}${process.env.PATH}`,
        SKIP_DEV_PROXY: '1',
    };
    writeFileSync(
        turboPath,
        [
            '#!/usr/bin/env node',
            "import { writeFileSync } from 'node:fs';",
            'const readyPath = process.env.GREDICE_TEST_READY_PATH;',
            'const signalPath = process.env.GREDICE_TEST_SIGNAL_PATH;',
            'process.on("SIGINT", () => {',
            '    writeFileSync(signalPath, "SIGINT");',
            '    process.exit(0);',
            '});',
            'process.on("SIGTERM", () => {',
            '    writeFileSync(signalPath, "SIGTERM");',
            '    process.exit(0);',
            '});',
            'writeFileSync(readyPath, process.argv.slice(2).join(" "));',
            'setInterval(() => {}, 1000);',
        ].join('\n'),
    );
    chmodSync(turboPath, 0o755);

    const child = spawn(
        process.execPath,
        [
            '--experimental-strip-types',
            resolve(import.meta.dirname, 'dev-with-proxy.mjs'),
        ],
        {
            cwd: repoRoot,
            env: childEnv,
            stdio: 'ignore',
        },
    );

    return { binDir, child };
}

describe('app registry worktree ports', () => {
    it('derives app dev ports from the worktree offset', () => {
        withEnv({ GREDICE_PORT_OFFSET: '12' }, () => {
            assert.equal(getAppDevPort(getAppByName('garden')), 3121);
        });
    });

    it('derives proxy ports from the same worktree offset', () => {
        withEnv({ GREDICE_PORT_OFFSET: '12' }, () => {
            assert.equal(getWorktreeProxyHttpPort(), 8120);
            assert.equal(getWorktreeProxyHttpsPort(), 8121);
        });
    });

    it('allows port-qualified local dev origins when the proxy uses a non-default HTTPS port', () => {
        withEnv({ GREDICE_PROXY_HTTPS_PORT: '8121' }, () => {
            assert.deepEqual(getAppAllowedDevOrigins(getAppByName('www')), [
                'www.gredice.test',
                'www.gredice.test:8121',
            ]);
        });
    });

    it('keeps bare local dev origins when the proxy uses the default HTTPS port', () => {
        withEnv({ GREDICE_PROXY_HTTPS_PORT: undefined }, () => {
            assert.deepEqual(getAppAllowedDevOrigins(getAppByName('www')), [
                'www.gredice.test',
            ]);
        });
    });

    it('creates stable worktree slugs for container and certificate paths', () => {
        assert.equal(getWorktreeSlug('Feature/ABC thing'), 'feature-abc-thing');
    });

    it('points local API calls at the app dev port for dev commands', () => {
        const result = runAppCommandForTest('dev', {
            GREDICE_PORT_OFFSET: '12',
            GREDICE_API_START_PORT: '13005',
        });
        assert.equal(result.status, 0, result.stderr);

        const output = JSON.parse(result.stdout);
        assert.deepEqual(output.args, ['dev', '-p', '3123']);
        assert.equal(output.apiHost, 'http://localhost:3125');
    });

    it('points local API calls at the API start port for start commands', () => {
        const result = runAppCommandForTest('start', {
            GREDICE_PORT_OFFSET: '12',
            GREDICE_API_START_PORT: '13005',
        });
        assert.equal(result.status, 0, result.stderr);

        const output = JSON.parse(result.stdout);
        assert.deepEqual(output.args, ['start', '-p', '3003']);
        assert.equal(output.apiHost, 'http://localhost:13005');
    });

    it('forwards SIGINT to the app command and exits with the interrupt code', async () => {
        const tempDir = mkdtempSync(resolve(tmpdir(), 'gredice-app-signal-'));
        const readyPath = resolve(tempDir, 'ready');
        const signalPath = resolve(tempDir, 'signal');
        const { binDir, child } = spawnRunAppCommand('dev', {
            GREDICE_TEST_READY_PATH: readyPath,
            GREDICE_TEST_SIGNAL_PATH: signalPath,
        });

        try {
            assert.equal(await waitForFile(readyPath), true);
            child.kill('SIGINT');
            const result = await waitForChildExit(child);

            assert.equal(result.code, 130);
            assert.equal(await waitForFile(signalPath), true);
            assert.equal(readFileSync(signalPath, 'utf8'), 'SIGINT');
        } finally {
            child.kill('SIGKILL');
            rmSync(binDir, { recursive: true, force: true });
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('forwards SIGINT from the dev wrapper to Turbo and exits with the interrupt code', async () => {
        const tempDir = mkdtempSync(resolve(tmpdir(), 'gredice-dev-signal-'));
        const readyPath = resolve(tempDir, 'ready');
        const signalPath = resolve(tempDir, 'signal');
        const { binDir, child } = spawnDevWithProxy({
            GREDICE_TEST_READY_PATH: readyPath,
            GREDICE_TEST_SIGNAL_PATH: signalPath,
        });

        try {
            assert.equal(await waitForFile(readyPath), true);
            assert.match(readFileSync(readyPath, 'utf8'), /^dev(?: |$)/);

            child.kill('SIGINT');
            const result = await waitForChildExit(child);

            assert.equal(result.code, 130);
            assert.equal(await waitForFile(signalPath), true);
            assert.equal(readFileSync(signalPath, 'utf8'), 'SIGINT');
        } finally {
            child.kill('SIGKILL');
            rmSync(binDir, { recursive: true, force: true });
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('terminates grandchildren in the spawned process group', async (context) => {
        if (process.platform === 'win32') {
            context.skip('POSIX process-group cleanup is not used on Windows.');
            return;
        }

        const tempDir = mkdtempSync(resolve(tmpdir(), 'gredice-process-tree-'));
        const childScriptPath = resolve(tempDir, 'child.mjs');
        const descendantScriptPath = resolve(tempDir, 'descendant.mjs');
        const readyPath = resolve(tempDir, 'ready');
        const signalPath = resolve(tempDir, 'signal');

        writeFileSync(
            descendantScriptPath,
            [
                "import { writeFileSync } from 'node:fs';",
                'const [readyPath, signalPath] = process.argv.slice(2);',
                'process.on("SIGTERM", () => {',
                '    writeFileSync(signalPath, "SIGTERM");',
                '    process.exit(0);',
                '});',
                'writeFileSync(readyPath, String(process.pid));',
                'setInterval(() => {}, 1000);',
            ].join('\n'),
        );
        writeFileSync(
            childScriptPath,
            [
                "import { spawn } from 'node:child_process';",
                'const [descendantScriptPath, readyPath, signalPath] = process.argv.slice(2);',
                'spawn(process.execPath, [descendantScriptPath, readyPath, signalPath], {',
                "    stdio: 'ignore',",
                '});',
                'setInterval(() => {}, 1000);',
            ].join('\n'),
        );

        const child = spawn(
            process.execPath,
            [childScriptPath, descendantScriptPath, readyPath, signalPath],
            {
                stdio: 'ignore',
                ...childProcessTreeOptions(),
            },
        );

        try {
            assert.equal(await waitForFile(readyPath), true);
            assert.equal(
                await terminateChildProcessTree(child, {
                    signal: 'SIGTERM',
                    gracefulTimeoutMs: 2000,
                }),
                true,
            );
            assert.equal(await waitForFile(signalPath), true);
            assert.equal(readFileSync(signalPath, 'utf8'), 'SIGTERM');
        } finally {
            child.kill('SIGKILL');
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('treats zombie-only process groups as stopped', () => {
        assert.equal(processStatesIncludeLiveProcess('Z\nZ+\n'), false);
        assert.equal(processStatesIncludeLiveProcess('Z\nS\n'), true);
    });
});
