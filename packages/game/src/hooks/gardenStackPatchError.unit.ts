import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getGardenStackPatchError } from './gardenStackPatchError';

test('reads a typed garden stack patch error', async () => {
    const message = await getGardenStackPatchError(
        new Response(JSON.stringify({ error: 'Garden stack changed' }), {
            status: 409,
        }),
    );

    assert.equal(message, 'Garden stack changed');
});

test('bounds an unstructured garden stack patch error', async () => {
    const message = await getGardenStackPatchError(
        new Response('x'.repeat(600), { status: 500 }),
    );

    assert.equal(message.length, 512);
});

test('bounds a structured garden stack patch error', async () => {
    const message = await getGardenStackPatchError(
        new Response(JSON.stringify({ error: 'x'.repeat(600) }), {
            status: 500,
        }),
    );

    assert.equal(message.length, 512);
});
