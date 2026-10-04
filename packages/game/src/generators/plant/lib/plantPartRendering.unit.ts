import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolvePlantPartCastShadow } from './plantPartRendering';

describe('plant part rendering', () => {
    it('casts shadows by default', () => {
        assert.equal(resolvePlantPartCastShadow(undefined), true);
    });

    it('preserves an explicit shadow override', () => {
        assert.equal(resolvePlantPartCastShadow(true), true);
        assert.equal(resolvePlantPartCastShadow(false), false);
    });
});
