import assert from 'node:assert/strict';
import test from 'node:test';
import { createCmsPageMetadata } from './cmsPageMetadata.ts';

test('CMS metadata is page-specific across canonical, Open Graph and Twitter', () => {
    const metadata = createCmsPageMetadata({
        slug: 'dostava-povrca-zagreb',
        title: 'Dostava povrća u Zagrebu',
        metaTitle: 'Dostava povrća Zagreb – svježe iz tvoje gredice',
        metaDescription: 'Posadi, prati rast i naruči dostavu svojeg povrća.',
        seoImageUrl: 'https://cdn.gredice.com/dostava-povrca.jpg',
        noIndex: false,
    });

    assert.equal(metadata.alternates?.canonical, '/dostava-povrca-zagreb');
    assert.equal(typeof metadata.robots, 'object');
    if (!metadata.robots || typeof metadata.robots !== 'object') {
        assert.fail('Expected structured CMS robots metadata.');
    }
    assert.equal(metadata.robots.index, true);
    assert.equal(metadata.robots.follow, true);
    assert.ok(metadata.openGraph && 'type' in metadata.openGraph);
    assert.equal(metadata.openGraph.type, 'website');
    assert.equal(metadata.openGraph?.url, '/dostava-povrca-zagreb');
    assert.equal(metadata.openGraph?.title, metadata.title);
    assert.equal(metadata.openGraph?.description, metadata.description);
    assert.deepEqual(metadata.twitter, {
        card: 'summary_large_image',
        title: metadata.title,
        description: metadata.description,
        images: [
            {
                url: 'https://cdn.gredice.com/dostava-povrca.jpg',
                alt: 'Dostava povrća Zagreb – svježe iz tvoje gredice – Gredice',
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
        assert.fail('Expected structured CMS Open Graph image metadata.');
    }
    assert.equal(openGraphImage.width, 1200);
    assert.equal(openGraphImage.height, 630);
    assert.equal(openGraphImage.type, 'image/jpeg');
    assert.match(openGraphImage.alt ?? '', /Gredice/u);
});

test('no-index CMS pages also disable following', () => {
    const metadata = createCmsPageMetadata({
        slug: 'privremena-stranica',
        title: 'Privremena stranica',
        noIndex: true,
    });

    assert.equal(typeof metadata.robots, 'object');
    if (!metadata.robots || typeof metadata.robots !== 'object') {
        assert.fail('Expected structured CMS robots metadata.');
    }
    assert.equal(metadata.robots.index, false);
    assert.equal(metadata.robots.follow, false);
});
