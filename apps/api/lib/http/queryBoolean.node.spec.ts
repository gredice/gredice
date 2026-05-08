import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ZodError } from 'zod';
import { queryBooleanSchema } from './queryBoolean';

describe('queryBooleanSchema', () => {
    it('parses the true string as true', () => {
        assert.strictEqual(queryBooleanSchema.parse('true'), true);
    });

    it('parses the false string as false', () => {
        assert.strictEqual(queryBooleanSchema.parse('false'), false);
    });

    it('rejects other values instead of using JavaScript truthiness', () => {
        assert.throws(() => queryBooleanSchema.parse('0'), ZodError);
    });
});
