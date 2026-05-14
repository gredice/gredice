import assert from 'node:assert/strict';
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
});
