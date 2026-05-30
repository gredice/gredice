import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveBlockInstanceCapacity } from './blockInstanceCapacity';

describe('resolveBlockInstanceCapacity', () => {
    it('keeps the default capacity for small gardens', () => {
        assert.equal(resolveBlockInstanceCapacity(0), 100);
        assert.equal(resolveBlockInstanceCapacity(100), 100);
    });

    it('grows capacity in buckets when a block type exceeds the current buffer', () => {
        assert.equal(resolveBlockInstanceCapacity(101), 200);
        assert.equal(resolveBlockInstanceCapacity(190), 200);
        assert.equal(resolveBlockInstanceCapacity(191), 400);
    });
});
