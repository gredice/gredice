import assert from 'node:assert/strict';
import test from 'node:test';
import type { MiddlewareHandler } from 'hono';
import {
    createWallpaperRoutes,
    type WallpaperRouteDeps,
} from '../../app/api/[...route]/wallpaperRoutes';
import type { AuthVariables } from '../hono/authValidator';

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

function wallpaperForm({
    includeNight = true,
    width = 3440,
}: {
    includeNight?: boolean;
    width?: number;
} = {}) {
    const form = new FormData();
    form.set('branding', 'gredice');
    form.set('gardenId', '42');
    form.set('size', 'ultrawide');
    form.set('template', 'standard');
    for (const phase of ['morning', 'day', 'evening', 'night']) {
        if (phase === 'night' && !includeNight) {
            continue;
        }
        form.set(
            phase,
            new File([pngHeader(width)], `${phase}.png`, {
                type: 'image/png',
            }),
        );
    }
    return form;
}

function deps(overrides: Partial<WallpaperRouteDeps> = {}): WallpaperRouteDeps {
    return {
        authValidator: () => testAuth(),
        encodeMacOSDynamicWallpaper: async () =>
            new TextEncoder().encode('heic'),
        getGarden: async () => ({ accountId: 'account-1' }),
        rateLimitAllows: async () => true,
        ...overrides,
    };
}

test('macOS wallpaper route authenticates before reading multipart input', async () => {
    let gardenReads = 0;
    const app = createWallpaperRoutes(
        deps({
            authValidator: () => unauthorizedAuth(),
            getGarden: async () => {
                gardenReads += 1;
                return null;
            },
        }),
    );

    const response = await app.request('/macos-dynamic', {
        body: wallpaperForm(),
        method: 'POST',
    });

    assert.equal(response.status, 401);
    assert.equal(gardenReads, 0);
});

test('macOS wallpaper route returns a finished private HEIC download', async () => {
    const capturedPhases: string[] = [];
    const app = createWallpaperRoutes(
        deps({
            encodeMacOSDynamicWallpaper: async ({ frames }) => {
                capturedPhases.push(...frames.keys());
                return new TextEncoder().encode('heic');
            },
        }),
    );

    const response = await app.request('/macos-dynamic', {
        body: wallpaperForm(),
        method: 'POST',
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/heic');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(
        response.headers.get('content-disposition'),
        'attachment; filename="gredice-vrt-standard-ultrawide-potpis-mac-dinamicka.heic"',
    );
    assert.deepEqual(capturedPhases, ['day', 'evening', 'night', 'morning']);
    assert.equal(await response.text(), 'heic');
});

test('macOS wallpaper route rejects missing frames and wrong dimensions', async () => {
    let conversions = 0;
    const app = createWallpaperRoutes(
        deps({
            encodeMacOSDynamicWallpaper: async () => {
                conversions += 1;
                return new Uint8Array();
            },
        }),
    );

    const missing = await app.request('/macos-dynamic', {
        body: wallpaperForm({ includeNight: false }),
        method: 'POST',
    });
    const wrongSize = await app.request('/macos-dynamic', {
        body: wallpaperForm({ width: 1200 }),
        method: 'POST',
    });

    assert.equal(missing.status, 400);
    assert.equal(wrongSize.status, 400);
    assert.equal(conversions, 0);
});

test('macOS wallpaper route hides cross-account gardens', async () => {
    const app = createWallpaperRoutes(
        deps({ getGarden: async () => ({ accountId: 'account-2' }) }),
    );

    const response = await app.request('/macos-dynamic', {
        body: wallpaperForm(),
        method: 'POST',
    });

    assert.equal(response.status, 404);
});

test('macOS wallpaper route rate limits conversion and maps encoder failure', async (t) => {
    const limited = createWallpaperRoutes(
        deps({ rateLimitAllows: async () => false }),
    );
    const limitedResponse = await limited.request('/macos-dynamic', {
        body: wallpaperForm(),
        method: 'POST',
    });
    assert.equal(limitedResponse.status, 429);
    assert.equal(limitedResponse.headers.get('retry-after'), '600');

    t.mock.method(console, 'error', () => undefined);
    const failing = createWallpaperRoutes(
        deps({
            encodeMacOSDynamicWallpaper: async () => {
                throw new Error('sandbox failed');
            },
        }),
    );
    const failedResponse = await failing.request('/macos-dynamic', {
        body: wallpaperForm(),
        method: 'POST',
    });
    assert.equal(failedResponse.status, 503);
});
