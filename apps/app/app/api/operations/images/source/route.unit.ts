import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const photo = 'https://cdn.gredice.com/operations/5089/photo.jpg';
let signedIn = true;
mock.module('../../../../../lib/auth/auth.ts', {
    namedExports: {
        withAuth: (roles: string[], handler: () => Promise<Response>) => {
            assert.deepEqual(roles, ['admin']);
            return signedIn ? handler() : new Response(null, { status: 401 });
        },
    },
});
mock.module('@gredice/storage', {
    namedExports: {
        getOperationById: async (id: number) => ({
            imageUrls: id === 5089 ? [photo] : [],
        }),
    },
});
const { GET } = await import('./route.ts');
function request(src = photo, operationId = 5089) {
    const params = new URLSearchParams({
        src,
        operationId: String(operationId),
    });
    return new Request(
        `http://localhost/api/operations/images/source?${params}`,
    );
}

test('only an admin can read an original attached to the specified operation on an allowed origin', async (t) => {
    const fetchImage = t.mock.method(globalThis, 'fetch', async () => {
        throw new Error('Unexpected fetch');
    });
    signedIn = false;
    assert.equal((await GET(request())).status, 401);
    signedIn = true;
    assert.equal((await GET(request(photo, 5090))).status, 404);
    assert.equal(
        (await GET(request('https://example.com/photo.jpg'))).status,
        400,
    );
    assert.equal(fetchImage.mock.callCount(), 0);
});

test('passes through the original image bytes without following redirects or serving active content', async (t) => {
    const bytes = new Uint8Array([255, 216, 255, 224]);
    t.mock.method(
        globalThis,
        'fetch',
        async (src: RequestInfo | URL, options?: RequestInit) => {
            assert.equal(src, photo);
            assert.equal(options?.redirect, 'error');
            return new Response(bytes, {
                headers: { 'content-type': 'image/jpeg' },
            });
        },
    );
    const response = await GET(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test('reports unavailable originals without passing HTML through to the editor', async (t) => {
    t.mock.method(
        globalThis,
        'fetch',
        async () =>
            new Response('<title>Error</title>', {
                headers: { 'content-type': 'text/html' },
            }),
    );
    assert.equal((await GET(request())).status, 502);
});
