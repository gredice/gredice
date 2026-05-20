import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getServerGrediceApiOrigin } from '../src/shared';

function withEnv(
    updates: Record<string, string | undefined>,
    callback: () => void,
) {
    const previousValues = new Map<string, string | undefined>();

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

describe('getServerGrediceApiOrigin', () => {
    it('uses the configured API host when available', () => {
        withEnv(
            {
                GREDICE_API_HOST: 'http://localhost:3125/',
                NODE_ENV: 'production',
                VERCEL_ENV: 'production',
            },
            () => {
                assert.equal(
                    getServerGrediceApiOrigin(),
                    'http://localhost:3125',
                );
            },
        );
    });

    it('uses localhost during local development', () => {
        withEnv(
            {
                GREDICE_API_HOST: undefined,
                NODE_ENV: 'development',
                VERCEL_ENV: undefined,
            },
            () => {
                assert.equal(
                    getServerGrediceApiOrigin(),
                    'http://localhost:3005',
                );
            },
        );
    });

    it('uses the hosted API for Vercel preview deployments', () => {
        withEnv(
            {
                GREDICE_API_HOST: undefined,
                NODE_ENV: 'production',
                VERCEL_ENV: 'preview',
            },
            () => {
                assert.equal(
                    getServerGrediceApiOrigin(),
                    'https://api.gredice.com',
                );
            },
        );
    });
});
