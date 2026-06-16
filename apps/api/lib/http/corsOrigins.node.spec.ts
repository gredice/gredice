import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAllowedCorsOrigin, resolveCorsOrigin } from './corsOrigins';

describe('CORS origins', () => {
    it('allows production app origins', () => {
        assert.equal(isAllowedCorsOrigin('https://vrt.gredice.com'), true);
        assert.equal(isAllowedCorsOrigin('https://www.gredice.com'), true);
        assert.equal(isAllowedCorsOrigin('https://app.gredice.com'), true);
        assert.equal(isAllowedCorsOrigin('https://farma.gredice.com'), true);
    });

    it('allows local development origins', () => {
        assert.equal(isAllowedCorsOrigin('http://localhost:3001'), true);
        assert.equal(isAllowedCorsOrigin('http://127.0.0.1:3005'), true);
        assert.equal(isAllowedCorsOrigin('https://app.gredice.test'), true);
        assert.equal(isAllowedCorsOrigin('http://vrt.gredice.test:3001'), true);
    });

    it('allows known Gredice Vercel preview project origins', () => {
        assert.equal(
            isAllowedCorsOrigin(
                'https://app-git-renovate-hono-4x-gredice.vercel.app',
            ),
            true,
        );
        assert.equal(
            isAllowedCorsOrigin('https://api-1lj8kdwr0-gredice.vercel.app'),
            true,
        );
    });

    it('rejects untrusted origins', () => {
        assert.equal(resolveCorsOrigin('https://example.com'), undefined);
        assert.equal(
            resolveCorsOrigin('https://evil-gredice.vercel.app'),
            undefined,
        );
        assert.equal(resolveCorsOrigin('http://app.gredice.com'), undefined);
    });

    it('echoes trusted origins for credentialed CORS responses', () => {
        assert.equal(
            resolveCorsOrigin('https://vrt.gredice.com'),
            'https://vrt.gredice.com',
        );
    });
});
