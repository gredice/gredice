import { expect, test } from '@playwright/test';

const expectedManifest = {
    id: '/',
    name: 'Gredice dostava',
    short_name: 'Dostava',
    description: 'Preuzimanje, dostava i praćenje Gredice uroda.',
    lang: 'hr',
    dir: 'ltr',
    start_url: '/',
    scope: 'https://dostava.gredice.com',
    launch_handler: {
        client_mode: ['navigate-existing', 'auto'],
    },
    display: 'standalone',
    display_override: ['standalone', 'browser'],
    background_color: '#f8fbf8',
    theme_color: '#166534',
    orientation: 'portrait',
    handle_links: 'preferred',
    prefer_related_applications: false,
    related_applications: [
        {
            platform: 'play',
            url: 'https://play.google.com/store/apps/details?id=com.gredice.dostava',
            id: 'com.gredice.dostava',
        },
    ],
    icons: [
        {
            src: '/web-app-manifest-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
        },
        {
            src: '/web-app-manifest-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
        },
    ],
} as const;

function parsePngDimensions(bytes: Buffer) {
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(bytes.subarray(0, pngSignature.length)).toEqual(pngSignature);

    return {
        height: bytes.readUInt32BE(20),
        width: bytes.readUInt32BE(16),
    };
}

test('serves the production Delivery PWA and Android companion contract', async ({
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

test('serves every declared Delivery install icon at its exact PNG size', async ({
    request,
}) => {
    for (const icon of expectedManifest.icons) {
        const response = await request.get(icon.src);

        expect(response.status(), icon.src).toBe(200);
        expect(response.headers()['content-type'], icon.src).toMatch(
            /^image\/png/u,
        );
        const [expectedWidth, expectedHeight] = icon.sizes
            .split('x')
            .map(Number);
        expect(parsePngDimensions(await response.body()), icon.src).toEqual({
            height: expectedHeight,
            width: expectedWidth,
        });
    }
});
