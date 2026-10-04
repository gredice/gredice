import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAllowedImpersonationOrigin } from './impersonationOrigins';

describe('isAllowedImpersonationOrigin', () => {
    it('allows impersonation controls from every session-aware app domain', () => {
        for (const origin of [
            'https://app.gredice.com',
            'https://www.gredice.com',
            'https://vrt.gredice.com',
            'https://farma.gredice.com',
            'https://dostava.gredice.com',
        ]) {
            assert.equal(isAllowedImpersonationOrigin(origin), true, origin);
        }
    });

    it('allows the delivery app local domain', () => {
        assert.equal(
            isAllowedImpersonationOrigin('https://dostava.gredice.test'),
            true,
        );
    });

    it('rejects untrusted or insecure origins', () => {
        assert.equal(
            isAllowedImpersonationOrigin('https://example.com'),
            false,
        );
        assert.equal(
            isAllowedImpersonationOrigin('http://dostava.gredice.com'),
            false,
        );
        assert.equal(isAllowedImpersonationOrigin(null), false);
    });
});
