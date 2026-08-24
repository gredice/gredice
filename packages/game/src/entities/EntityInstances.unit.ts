import assert from 'node:assert/strict';
import test from 'node:test';
import { instancedBlockNames } from './EntityInstances';

test('suppresses legacy direct sheep blocks from the static entity render path', () => {
    assert.equal(instancedBlockNames.includes('Sheep'), true);
});
