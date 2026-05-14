import assert from 'node:assert/strict';
import test from 'node:test';
import * as llmsRoute from './llms.txt/route.ts';
import * as llmsFullRoute from './llms-full.txt/route.ts';

async function assertLlmsResponse(response: Response) {
    assert.equal(response.status, 200);
    assert.equal(
        response.headers.get('Content-Type'),
        'text/plain; charset=utf-8',
    );

    const body = await response.text();

    assert.match(body, /# Gredice/);
    assert.match(body, /## Core Resources/);
    assert.match(body, /## Company and Support/);
    assert.match(body, /## Policies/);
    assert.match(body, /\[Home\]\(https:\/\/www\.gredice\.com\/\)/);
    assert.match(body, /\[Plants\]\(https:\/\/www\.gredice\.com\/biljke\)/);
    assert.match(
        body,
        /\[Privacy policy\]\(https:\/\/www\.gredice\.com\/legalno\/politika-privatnosti\)/,
    );
}

test('llms.txt route serves plain text with core sections and canonical links', async () => {
    await assertLlmsResponse(llmsRoute.GET());
});

test('llms-full.txt route serves the same plain text response', async () => {
    assert.equal(llmsFullRoute.GET, llmsRoute.GET);

    await assertLlmsResponse(llmsFullRoute.GET());
});
