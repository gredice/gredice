import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { resolvePublicOgImageDataUrl } from './resolvePublicOgImage.ts';

test('converts a trusted WebP cover to a bounded PNG data URL', async () => {
    const source = await sharp({
        create: {
            width: 16,
            height: 12,
            channels: 4,
            background: '#2e6f40',
        },
    })
        .webp()
        .toBuffer();
    const fetcher = async () =>
        new Response(source, {
            headers: { 'Content-Type': 'image/webp' },
        });

    const dataUrl = await resolvePublicOgImageDataUrl(
        'https://cdn.gredice.com/plants/cover.webp',
        fetcher,
    );

    assert.match(dataUrl ?? '', /^data:image\/png;base64,/);
    const converted = Buffer.from(dataUrl?.split(',', 2)[1] ?? '', 'base64');
    const metadata = await sharp(converted).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 16);
    assert.equal(metadata.height, 12);
});

test('does not fetch image URLs outside trusted public origins', async () => {
    let fetchCount = 0;
    const fetcher = async () => {
        fetchCount += 1;
        return new Response();
    };

    assert.equal(
        await resolvePublicOgImageDataUrl(
            'https://example.com/private.jpg',
            fetcher,
        ),
        undefined,
    );
    assert.equal(fetchCount, 0);
});

test('uses redirect error mode and rejects redirect responses', async () => {
    let redirectMode: RequestRedirect | undefined;
    const fetcher = async (_input: string, init: RequestInit) => {
        redirectMode = init.redirect;
        return new Response(null, {
            status: 302,
            headers: { Location: 'https://cdn.gredice.com/other.jpg' },
        });
    };

    assert.equal(
        await resolvePublicOgImageDataUrl(
            'https://cdn.gredice.com/cover.jpg',
            fetcher,
        ),
        undefined,
    );
    assert.equal(redirectMode, 'error');
});

test('rejects non-raster content types before conversion', async () => {
    const fetcher = async () =>
        new Response(null, {
            headers: { 'Content-Type': 'image/svg+xml' },
        });

    assert.equal(
        await resolvePublicOgImageDataUrl(
            'https://cdn.gredice.com/cover.svg',
            fetcher,
        ),
        undefined,
    );
});

test('rejects oversized and incorrectly typed response bodies', async () => {
    const oversizedFetcher = async () =>
        new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
            headers: {
                'Content-Length': String(6 * 1024 * 1024),
                'Content-Type': 'image/jpeg',
            },
        });
    const mismatchedFetcher = async () =>
        new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
            headers: { 'Content-Type': 'image/png' },
        });

    assert.equal(
        await resolvePublicOgImageDataUrl(
            'https://cdn.gredice.com/oversized.jpg',
            oversizedFetcher,
        ),
        undefined,
    );
    assert.equal(
        await resolvePublicOgImageDataUrl(
            'https://cdn.gredice.com/mismatched.png',
            mismatchedFetcher,
        ),
        undefined,
    );
});

test('stops streamed bodies that exceed the byte cap without Content-Length', async () => {
    const chunkSize = 3 * 1024 * 1024;
    const fetcher = async () =>
        new Response(
            new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(new Uint8Array(chunkSize));
                    controller.enqueue(new Uint8Array(chunkSize));
                    controller.close();
                },
            }),
            {
                headers: { 'Content-Type': 'image/png' },
            },
        );

    assert.equal(
        await resolvePublicOgImageDataUrl(
            'https://cdn.gredice.com/streamed.png',
            fetcher,
        ),
        undefined,
    );
});
