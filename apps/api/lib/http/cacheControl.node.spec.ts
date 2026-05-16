import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCacheControlValue, cacheControlPresets } from './cacheControl';

describe('buildCacheControlValue', () => {
    it('builds a public max-age header value by default', () => {
        assert.strictEqual(
            buildCacheControlValue({ maxAgeSeconds: 7 * 24 * 60 * 60 }),
            'public, max-age=604800',
        );
    });

    it('includes optional directives in a stable order', () => {
        assert.strictEqual(
            buildCacheControlValue({
                ...cacheControlPresets.weatherShortTerm,
                staleIfErrorSeconds: 120,
                mustRevalidate: true,
                noTransform: true,
                immutable: true,
            }),
            'public, max-age=300, s-maxage=300, stale-while-revalidate=60, stale-if-error=120, must-revalidate, no-transform, immutable',
        );
    });
});
