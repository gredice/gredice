import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('web-push uses the WHATWG URL API on the provider request path', () => {
    const sourcePath = require.resolve('web-push/src/web-push-lib.js');
    const source = readFileSync(sourcePath, 'utf8');

    assert.doesNotMatch(source, /\burl\.parse\s*\(/u);
    assert.match(source, /new URL\(subscription\.endpoint\)/u);
    assert.match(source, /new URL\(requestDetails\.endpoint\)/u);
});
