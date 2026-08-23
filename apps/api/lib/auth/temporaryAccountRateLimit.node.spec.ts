import assert from 'node:assert/strict';
import test from 'node:test';
import { temporaryAccountClientAddress } from './temporaryAccountRateLimit';

test('uses the platform client address for temporary account rate limiting', () => {
    const headers = new Headers({
        'x-forwarded-for': 'spoofed, trusted-proxy',
        'x-vercel-forwarded-for': 'visitor-address, edge-proxy',
    });

    assert.equal(temporaryAccountClientAddress(headers), 'visitor-address');
});

test('uses the final forwarded address outside Vercel', () => {
    const headers = new Headers({
        'x-forwarded-for': 'spoofed, trusted-proxy',
    });

    assert.equal(temporaryAccountClientAddress(headers), 'trusted-proxy');
});
