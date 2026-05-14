import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

function runAppCommand(command, env = {}) {
    const binDir = mkdtempSync(resolve(tmpdir(), 'gredice-app-command-'));
    const nextPath = resolve(binDir, 'next');
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

    const result = spawnSync(
        process.execPath,
        ['--experimental-strip-types', '../../scripts/run-app-command.mjs', command],
        {
            cwd: resolve(import.meta.dirname, '..', 'apps', 'app'),
            env: childEnv,
            encoding: 'utf8',
        },
    );
    rmSync(binDir, { recursive: true, force: true });
    return result;
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
        const result = runAppCommand('dev', {
            GREDICE_PORT_OFFSET: '12',
            GREDICE_API_START_PORT: '13005',
        });
        assert.equal(result.status, 0, result.stderr);

        const output = JSON.parse(result.stdout);
        assert.deepEqual(output.args, ['dev', '-p', '3123']);
        assert.equal(output.apiHost, 'http://localhost:3125');
    });

    it('points local API calls at the API start port for start commands', () => {
        const result = runAppCommand('start', {
            GREDICE_PORT_OFFSET: '12',
            GREDICE_API_START_PORT: '13005',
        });
        assert.equal(result.status, 0, result.stderr);

        const output = JSON.parse(result.stdout);
        assert.deepEqual(output.args, ['start', '-p', '3003']);
        assert.equal(output.apiHost, 'http://localhost:13005');
    });
});
