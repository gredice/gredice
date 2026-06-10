import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { resolveAuthCookieSettingsForContext } from './cookieSecurity';

const originalCookieDomain = process.env.COOKIE_DOMAIN;

afterEach(() => {
    if (originalCookieDomain === undefined) {
        delete process.env.COOKIE_DOMAIN;
    } else {
        process.env.COOKIE_DOMAIN = originalCookieDomain;
    }
});

test('infers shared production cookie domain for Gredice apps', () => {
    delete process.env.COOKIE_DOMAIN;

    assert.deepEqual(
        resolveAuthCookieSettingsForContext({
            forwardedProto: 'https',
            host: 'app.gredice.com',
        }),
        {
            domain: 'gredice.com',
            secure: true,
        },
    );
});

test('infers shared local proxy cookie domain for Gredice apps', () => {
    delete process.env.COOKIE_DOMAIN;

    assert.deepEqual(
        resolveAuthCookieSettingsForContext({
            forwardedProto: 'https',
            host: 'app.gredice.test',
        }),
        {
            domain: 'gredice.test',
            secure: true,
        },
    );
});

test('keeps loopback auth cookies host scoped', () => {
    process.env.COOKIE_DOMAIN = 'gredice.test';

    assert.equal(
        resolveAuthCookieSettingsForContext({
            forwardedProto: 'http',
            host: 'localhost',
        }).domain,
        undefined,
    );
});
