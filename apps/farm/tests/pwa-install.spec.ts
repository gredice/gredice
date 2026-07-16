import { expect, test } from '@playwright/test';

const expectedManifest = {
    name: 'Gredice Farm',
    short_name: 'Farm',
    description:
        'Upravljaj dnevnim zadacima, gredicama i obavijestima na farmi.',
    lang: 'hr',
    dir: 'ltr',
    id: '/',
    scope: '/',
    start_url: '/',
    display: 'standalone',
    theme_color: '#8B5E34',
    background_color: '#F5EFE6',
    orientation: 'any',
    icons: [
        {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
        },
        {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
        },
    ],
    screenshots: [
        {
            src: '/screenshots/farm-today-390x844.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Dnevni zadaci i sažetak rada u mobilnom prikazu',
        },
        {
            src: '/screenshots/farm-today-1280x720.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Dnevni zadaci i navigacija u širokom prikazu',
        },
    ],
    shortcuts: [
        {
            name: 'Raspored',
            short_name: 'Raspored',
            url: '/schedule',
            description: 'Otvori raspored poslova na farmi',
        },
        {
            name: 'Gredice',
            short_name: 'Gredice',
            url: '/raised-beds',
            description: 'Otvori pregled gredica',
        },
        {
            name: 'Obavijesti',
            short_name: 'Obavijesti',
            url: '/notifications',
            description: 'Otvori obavijesti farme',
        },
    ],
} as const;

const serviceWorkerAssets = [
    {
        constant: 'DEFAULT_ICON',
        height: 192,
        src: '/web-app-manifest-192x192.png',
        width: 192,
    },
    {
        constant: 'DEFAULT_BADGE',
        height: 96,
        src: '/notification-badge-96x96.png',
        width: 96,
    },
] as const;

function parsePngDimensions(bytes: Buffer) {
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(bytes.subarray(0, pngSignature.length)).toEqual(pngSignature);

    return {
        height: bytes.readUInt32BE(20),
        width: bytes.readUInt32BE(16),
    };
}

test('serves truthful standalone Farm install metadata', async ({
    request,
}) => {
    const response = await request.get('/manifest.json');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(
        /^application\/(?:manifest\+json|json)/u,
    );
    const manifest: unknown = await response.json();
    expect(manifest).toEqual(expectedManifest);
});

test('serves every declared image and push default at its exact PNG size', async ({
    request,
}) => {
    const declaredAssets = [
        ...expectedManifest.icons,
        ...expectedManifest.screenshots,
        ...serviceWorkerAssets.map((asset) => ({
            sizes: `${asset.width}x${asset.height}`,
            src: asset.src,
            type: 'image/png',
        })),
    ];
    const uniqueAssets = new Map(
        declaredAssets.map((asset) => [asset.src, asset]),
    );

    for (const asset of uniqueAssets.values()) {
        const response = await request.get(asset.src);
        expect(response.status(), asset.src).toBe(200);
        expect(response.headers()['content-type'], asset.src).toMatch(
            /^image\/png/u,
        );
        const [expectedWidth, expectedHeight] = asset.sizes
            .split('x')
            .map(Number);
        expect(parsePngDimensions(await response.body()), asset.src).toEqual({
            height: expectedHeight,
            width: expectedWidth,
        });
    }
});

test('keeps push defaults bound to the tested install assets', async ({
    request,
}) => {
    const response = await request.get('/push-notifications-sw.js');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(
        /^(?:application|text)\/javascript/u,
    );
    const source = await response.text();

    for (const asset of serviceWorkerAssets) {
        expect(source).toContain(`const ${asset.constant} = '${asset.src}';`);
    }
    expect(source).not.toContain("'/badge.svg'");
    expect(source).not.toContain("'/icon.svg'");
});

test('keeps the notification badge transparent and monochrome', async ({
    page,
}) => {
    await page.goto('/manifest.json');
    const pixels = await page.evaluate(async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();

        const canvas = document.createElement('canvas');
        canvas.height = image.naturalHeight;
        canvas.width = image.naturalWidth;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas context is unavailable.');
        }
        context.drawImage(image, 0, 0);
        const data = context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
        ).data;
        let hasColoredPixel = false;
        let transparentPixels = 0;
        let visiblePixels = 0;

        for (let index = 0; index < data.length; index += 4) {
            const alpha = data[index + 3];
            if (alpha === 0) {
                transparentPixels += 1;
                continue;
            }
            visiblePixels += 1;
            if (
                data[index] !== data[index + 1] ||
                data[index + 1] !== data[index + 2]
            ) {
                hasColoredPixel = true;
            }
        }

        return { hasColoredPixel, transparentPixels, visiblePixels };
    }, '/notification-badge-96x96.png');

    expect(pixels.transparentPixels).toBeGreaterThan(0);
    expect(pixels.visiblePixels).toBeGreaterThan(0);
    expect(pixels.hasColoredPixel).toBe(false);
});

test('keeps every install shortcut inside the real Farm workspace', async ({
    request,
}) => {
    for (const shortcut of expectedManifest.shortcuts) {
        expect(shortcut.url).toMatch(
            /^\/(?:schedule|raised-beds|notifications)$/u,
        );
        const response = await request.get(shortcut.url, {
            failOnStatusCode: false,
        });
        expect(response.status(), shortcut.url).toBeLessThan(400);
        expect(response.status(), shortcut.url).not.toBe(404);
    }
});
