import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { directoriesClient } from '../src/directories-api';

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

function response() {
    return new Response(JSON.stringify([]), {
        headers: { 'content-type': 'application/json' },
        status: 200,
    });
}

describe('directoriesClient block catalogue version', () => {
    it('versions the block directory request for the farm-animal homes release', async () => {
        let requestedUrl = '';
        globalThis.fetch = async (input) => {
            requestedUrl =
                input instanceof Request ? input.url : input.toString();
            return response();
        };

        await directoriesClient().GET('/entities/block');

        assert.equal(
            requestedUrl,
            'https://api.gredice.com/api/directories/entities/block?v=farm-animals-2026-08-17-1',
        );
    });

    it('does not version other directory requests', async () => {
        let requestedUrl = '';
        globalThis.fetch = async (input) => {
            requestedUrl =
                input instanceof Request ? input.url : input.toString();
            return response();
        };

        await directoriesClient().GET('/entities/plant');

        assert.equal(
            requestedUrl,
            'https://api.gredice.com/api/directories/entities/plant',
        );
    });
});
