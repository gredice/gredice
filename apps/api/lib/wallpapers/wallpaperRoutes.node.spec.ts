import assert from 'node:assert/strict';
import test from 'node:test';
import type { MiddlewareHandler } from 'hono';
import {
    createWallpaperRoutes,
    type WallpaperRouteDeps,
} from '../../app/api/[...route]/wallpaperRoutes';
import type { AuthVariables } from '../hono/authValidator';
import { macOSDynamicWallpaperFramePathnames } from './macOSDynamicWallpaperBlobs';
import {
    decryptMacOSDynamicWallpaperBytes,
    encryptMacOSDynamicWallpaperBytes,
} from './macOSDynamicWallpaperEncryption';

const conversionId = '11111111-1111-4111-8111-111111111111';
const encryptionKey = 'ERERERERERERERERERERERERERERERERERERERERERE';

function testAuth(): MiddlewareHandler<{ Variables: AuthVariables }> {
    return async (context, next) => {
        context.set('authContext', {
            accountId: 'account-1',
            userId: 'user-1',
            user: {
                accountIds: ['account-1'],
                id: 'user-1',
                isTemporary: false,
                role: 'user',
            },
        });
        await next();
    };
}

function unauthorizedAuth(): MiddlewareHandler<{
    Variables: AuthVariables;
}> {
    return async (context) => context.json({ error: 'Unauthorized' }, 401);
}

function pngHeader(width = 3440, height = 1440) {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 13);
    bytes.set(new TextEncoder().encode('IHDR'), 12);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
}

function wallpaperRequest() {
    return {
        branding: 'gredice',
        conversionId,
        encryptionKey,
        gardenId: 42,
        size: 'ultrawide',
        template: 'standard',
    };
}

function encryptedPng(pathname: string, width = 3440, height = 1440) {
    return encryptMacOSDynamicWallpaperBytes({
        bytes: pngHeader(width, height),
        encodedKey: encryptionKey,
        pathname,
    });
}

function requestInit(method: 'DELETE' | 'POST' = 'POST') {
    return {
        body: JSON.stringify(wallpaperRequest()),
        headers: { 'Content-Type': 'application/json' },
        method,
    };
}

function deps(overrides: Partial<WallpaperRouteDeps> = {}): WallpaperRouteDeps {
    return {
        authValidator: () => testAuth(),
        createUpload: async ({ authorize }) => {
            await authorize({
                conversionId,
                gardenId: 42,
                phase: 'day',
            });
            return { clientToken: 'token', type: 'blob.generate-client-token' };
        },
        deleteBlobs: async () => undefined,
        encodeMacOSDynamicWallpaper: async () =>
            new TextEncoder().encode('heic'),
        getGarden: async () => ({ accountId: 'account-1' }),
        rateLimitAllows: async () => true,
        readBlob: async (pathname) => {
            const bytes = encryptedPng(pathname);
            return {
                bytes,
                contentType: 'application/octet-stream',
                size: bytes.byteLength,
            };
        },
        storeBlob: async ({ pathname }) => ({
            downloadUrl:
                'https://store.public.blob.vercel-storage.com/output.heic.bin',
            pathname,
        }),
        uploadRateLimitAllows: async () => true,
        ...overrides,
    };
}

test('macOS wallpaper upload authenticates before issuing a Blob token', async () => {
    let uploadCalls = 0;
    const app = createWallpaperRoutes(
        deps({
            authValidator: () => unauthorizedAuth(),
            createUpload: async () => {
                uploadCalls += 1;
                return {};
            },
        }),
    );

    const response = await app.request('/macos-dynamic/uploads', {
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
    });

    assert.equal(response.status, 401);
    assert.equal(uploadCalls, 0);
});

test('macOS wallpaper upload authorizes an owned garden and rate limits tokens', async () => {
    const accounts: string[] = [];
    const app = createWallpaperRoutes(
        deps({
            uploadRateLimitAllows: async (accountId) => {
                accounts.push(accountId);
                return true;
            },
        }),
    );

    const response = await app.request('/macos-dynamic/uploads', {
        body: '{}',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(accounts, ['account-1']);
});

test('macOS wallpaper route returns an encrypted HEIC download and deletes inputs', async () => {
    const capturedPhases: string[] = [];
    const deleted: string[][] = [];
    let storedBytes: Uint8Array<ArrayBufferLike> = new Uint8Array();
    let storedPathname = '';
    const app = createWallpaperRoutes(
        deps({
            deleteBlobs: async (pathnames) => {
                deleted.push([...pathnames]);
            },
            encodeMacOSDynamicWallpaper: async ({ frames }) => {
                capturedPhases.push(...frames.keys());
                return new TextEncoder().encode('heic');
            },
            storeBlob: async ({ bytes, pathname }) => {
                storedBytes = bytes;
                storedPathname = pathname;
                return {
                    downloadUrl:
                        'https://store.public.blob.vercel-storage.com/output.heic.bin',
                    pathname,
                };
            },
        }),
    );

    const response = await app.request('/macos-dynamic', requestInit());
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(capturedPhases, ['day', 'evening', 'night', 'morning']);
    assert.deepEqual(body, {
        downloadUrl:
            'https://store.public.blob.vercel-storage.com/output.heic.bin',
        fileName: 'gredice-vrt-standard-ultrawide-potpis-mac-dinamicka.heic',
        pathname: storedPathname,
    });
    assert.match(
        storedPathname,
        /wallpapers\/macos-dynamic\/output\/account-1\/11111111.*\.heic\.bin$/,
    );
    assert.equal(
        new TextDecoder().decode(
            decryptMacOSDynamicWallpaperBytes({
                bytes: storedBytes,
                encodedKey: encryptionKey,
                pathname: storedPathname,
            }),
        ),
        'heic',
    );
    assert.deepEqual(deleted, [
        [...macOSDynamicWallpaperFramePathnames(wallpaperRequest()).values()],
    ]);
});

test('macOS wallpaper route rejects missing frames and wrong dimensions', async () => {
    let conversions = 0;
    const paths = macOSDynamicWallpaperFramePathnames(wallpaperRequest());
    const missing = createWallpaperRoutes(
        deps({
            encodeMacOSDynamicWallpaper: async () => {
                conversions += 1;
                return new Uint8Array();
            },
            readBlob: async (pathname) => {
                if (pathname === paths.get('night')) {
                    return null;
                }
                const bytes = encryptedPng(pathname);
                return {
                    bytes,
                    contentType: 'application/octet-stream',
                    size: bytes.byteLength,
                };
            },
        }),
    );
    const wrongDimensions = createWallpaperRoutes(
        deps({
            encodeMacOSDynamicWallpaper: async () => {
                conversions += 1;
                return new Uint8Array();
            },
            readBlob: async (pathname) => {
                const bytes = encryptedPng(pathname, 1200);
                return {
                    bytes,
                    contentType: 'application/octet-stream',
                    size: bytes.byteLength,
                };
            },
        }),
    );

    const missingResponse = await missing.request(
        '/macos-dynamic',
        requestInit(),
    );
    const wrongSizeResponse = await wrongDimensions.request(
        '/macos-dynamic',
        requestInit(),
    );

    assert.equal(missingResponse.status, 400);
    assert.equal(wrongSizeResponse.status, 400);
    assert.equal(conversions, 0);
});

test('macOS wallpaper route hides cross-account gardens', async () => {
    let blobReads = 0;
    const app = createWallpaperRoutes(
        deps({
            getGarden: async () => ({ accountId: 'account-2' }),
            readBlob: async () => {
                blobReads += 1;
                return null;
            },
        }),
    );

    const response = await app.request('/macos-dynamic', requestInit());

    assert.equal(response.status, 404);
    assert.equal(blobReads, 0);
});

test('macOS wallpaper route rate limits conversion and cleans up encoder failure', async (t) => {
    const limitedDeletes: string[][] = [];
    const limited = createWallpaperRoutes(
        deps({
            deleteBlobs: async (pathnames) => {
                limitedDeletes.push([...pathnames]);
            },
            rateLimitAllows: async () => false,
        }),
    );
    const limitedResponse = await limited.request(
        '/macos-dynamic',
        requestInit(),
    );
    assert.equal(limitedResponse.status, 429);
    assert.equal(limitedResponse.headers.get('retry-after'), '600');
    assert.equal(limitedDeletes.length, 1);

    t.mock.method(console, 'error', () => undefined);
    const failedDeletes: string[][] = [];
    const failing = createWallpaperRoutes(
        deps({
            deleteBlobs: async (pathnames) => {
                failedDeletes.push([...pathnames]);
            },
            encodeMacOSDynamicWallpaper: async () => {
                throw new Error('sandbox failed');
            },
        }),
    );
    const failedResponse = await failing.request(
        '/macos-dynamic',
        requestInit(),
    );
    assert.equal(failedResponse.status, 503);
    assert.equal(failedDeletes.length, 1);
});

test('macOS wallpaper cleanup deletes only the authenticated conversion paths', async () => {
    const deleted: string[][] = [];
    const app = createWallpaperRoutes(
        deps({
            deleteBlobs: async (pathnames) => {
                deleted.push([...pathnames]);
            },
        }),
    );

    const response = await app.request('/macos-dynamic', requestInit('DELETE'));

    assert.equal(response.status, 204);
    assert.equal(deleted.length, 1);
    assert.equal(deleted[0]?.length, 5);
    assert.match(deleted[0]?.at(-1) ?? '', /output\/account-1/);
});
