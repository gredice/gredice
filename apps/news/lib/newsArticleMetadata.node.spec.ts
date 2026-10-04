import assert from 'node:assert/strict';
import test from 'node:test';
import { createNewsArticleMetadata } from './newsArticleMetadata.ts';

test('news article metadata keeps canonical, Open Graph and Twitter aligned', () => {
    const metadata = createNewsArticleMetadata({
        title: 'Koliko košta dostava povrća u Zagrebu?',
        excerpt: 'Cijene i uvjeti dostave iz tvoje gredice.',
        path: '/novosti/koliko-kosta-dostava-povrca-u-zagrebu',
        publishedAt: '2026-08-18T08:00:00.000Z',
        tags: ['Dostava povrća', 'Zagreb'],
        seoImageUrl: 'https://cdn.gredice.com/dostava-povrca.webp',
        noIndex: false,
    });

    const canonical = '/novosti/koliko-kosta-dostava-povrca-u-zagrebu';
    const image = 'https://cdn.gredice.com/dostava-povrca.webp';
    assert.equal(metadata.alternates?.canonical, canonical);
    assert.equal(typeof metadata.robots, 'object');
    if (!metadata.robots || typeof metadata.robots !== 'object') {
        assert.fail('Expected structured news robots metadata.');
    }
    assert.equal(metadata.robots.index, true);
    assert.equal(metadata.robots.follow, true);
    assert.ok(metadata.openGraph && 'type' in metadata.openGraph);
    assert.equal(metadata.openGraph.type, 'article');
    assert.equal(metadata.openGraph?.url, canonical);
    assert.equal(metadata.openGraph?.title, metadata.title);
    assert.equal(metadata.openGraph?.description, metadata.description);
    assert.deepEqual(metadata.twitter, {
        card: 'summary_large_image',
        title: metadata.title,
        description: metadata.description,
        images: [
            {
                url: image,
                alt: 'Koliko košta dostava povrća u Zagrebu? – Gredice',
            },
        ],
    });

    const openGraphImages = metadata.openGraph?.images;
    assert.ok(Array.isArray(openGraphImages));
    const openGraphImage = openGraphImages[0];
    assert.equal(typeof openGraphImage, 'object');
    if (
        !openGraphImage ||
        typeof openGraphImage === 'string' ||
        openGraphImage instanceof URL
    ) {
        assert.fail('Expected structured news Open Graph image metadata.');
    }
    assert.equal(openGraphImage.width, 1200);
    assert.equal(openGraphImage.height, 630);
    assert.equal(openGraphImage.type, 'image/webp');
});

test('news metadata preserves supported image types and omits unknown types', () => {
    const imageCases = [
        ['cover.avif?download=1', 'image/avif'],
        ['cover.GIF#preview', 'image/gif'],
        ['cover.jpg', 'image/jpeg'],
        ['cover.png', 'image/png'],
        ['cover.webp', 'image/webp'],
    ] as const;

    for (const [fileName, expectedType] of imageCases) {
        const metadata = createNewsArticleMetadata({
            title: 'Primjer',
            path: '/novosti/primjer',
            publishedAt: '2026-08-18T08:00:00.000Z',
            tags: [],
            seoImageUrl: `https://cdn.gredice.com/${fileName}`,
        });
        const images = metadata.openGraph?.images;
        assert.ok(Array.isArray(images));
        const image = images[0];
        assert.ok(
            image && typeof image === 'object' && !(image instanceof URL),
        );
        assert.equal(image.type, expectedType);
    }

    const metadata = createNewsArticleMetadata({
        title: 'Primjer',
        path: '/novosti/primjer',
        publishedAt: '2026-08-18T08:00:00.000Z',
        tags: [],
        seoImageUrl: 'https://cdn.gredice.com/cover.bin',
    });
    const images = metadata.openGraph?.images;
    assert.ok(Array.isArray(images));
    const image = images[0];
    assert.ok(image && typeof image === 'object' && !(image instanceof URL));
    assert.equal('type' in image, false);
});

test('news metadata declares the known PNG type of its generated fallback', () => {
    const metadata = createNewsArticleMetadata({
        title: 'Primjer',
        path: '/novosti/primjer',
        publishedAt: '2026-08-18T08:00:00.000Z',
        tags: [],
    });
    const images = metadata.openGraph?.images;
    assert.ok(Array.isArray(images));
    const image = images[0];
    assert.ok(image && typeof image === 'object' && !(image instanceof URL));
    assert.equal(image.type, 'image/png');
});
