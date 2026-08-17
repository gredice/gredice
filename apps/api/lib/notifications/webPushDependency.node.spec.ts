import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import type { RequestOptions } from 'node:https';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

type MockPushResponse = EventEmitter & {
    statusCode: number;
    headers: Record<string, string>;
};

test('web-push uses the WHATWG URL API on the provider request path', () => {
    const sourcePath = require.resolve('web-push/src/web-push-lib.js');
    const source = readFileSync(sourcePath, 'utf8');

    assert.doesNotMatch(source, /\burl\.parse\s*\(/u);
    assert.match(source, /new URL\(subscription\.endpoint\)/u);
    assert.match(source, /new URL\(requestDetails\.endpoint\)/u);
});

test('web-push removes IPv6 brackets from HTTPS request hostnames', async () => {
    const https = require('node:https');
    const webPush = require('web-push');
    const originalRequest = https.request;
    let requestOptions: RequestOptions | undefined;

    https.request = (
        options: RequestOptions,
        onResponse: (response: MockPushResponse) => void,
    ) => {
        requestOptions = options;
        const request = Object.assign(new EventEmitter(), {
            end() {
                const response = Object.assign(new EventEmitter(), {
                    statusCode: 201,
                    headers: {},
                });
                onResponse(response);
                queueMicrotask(() => response.emit('end'));
            },
        });

        return request;
    };

    try {
        await webPush.sendNotification({
            endpoint: 'https://[::1]:8443/push?topic=garden',
        });
    } finally {
        https.request = originalRequest;
    }

    assert.ok(requestOptions);
    assert.equal(requestOptions.hostname, '::1');
    assert.equal(requestOptions.port, '8443');
    assert.equal(requestOptions.path, '/push?topic=garden');
});
