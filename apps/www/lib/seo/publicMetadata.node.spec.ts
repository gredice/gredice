import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildPublicOgImagePath,
    createPublicMetadata,
    isValidPublicOgSearchParams,
    PUBLIC_OG_IMAGE_SIZE,
    parsePublicOgCardSearchParams,
    sanitizePublicOgImageUrl,
} from './publicMetadata.ts';

const localUnsignedSigningConfig = {
    allowUnsigned: true,
    configurationValid: true,
} as const;
const configuredSigningConfig = {
    secret: 'test-preview-secret',
    allowUnsigned: false,
    configurationValid: true,
} as const;

test('creates complete page-specific Open Graph and Twitter metadata', () => {
    const metadata = createPublicMetadata(
        {
            title: 'Biljke',
            description:
                'Istraži biljke koje možeš posaditi u svojim gredicama.',
            path: '/biljke',
            eyebrow: 'Katalog biljaka',
            imageAlt: '  Naslovna slika\n biljnog kataloga  ',
            keywords: ['biljke', 'vrt'],
        },
        localUnsignedSigningConfig,
    );

    assert.deepEqual(metadata.alternates, { canonical: '/biljke' });
    assert.deepEqual(metadata.openGraph, {
        type: 'website',
        locale: 'hr_HR',
        siteName: 'Gredice',
        title: 'Biljke',
        description: 'Istraži biljke koje možeš posaditi u svojim gredicama.',
        url: '/biljke',
        images: [
            {
                url: '/api/og/public?title=Biljke&description=Istra%C5%BEi+biljke+koje+mo%C5%BEe%C5%A1+posaditi+u+svojim+gredicama.&eyebrow=Katalog+biljaka',
                width: PUBLIC_OG_IMAGE_SIZE.width,
                height: PUBLIC_OG_IMAGE_SIZE.height,
                alt: 'Naslovna slika biljnog kataloga',
                type: 'image/png',
            },
        ],
    });
    assert.deepEqual(metadata.twitter, {
        card: 'summary_large_image',
        title: 'Biljke',
        description: 'Istraži biljke koje možeš posaditi u svojim gredicama.',
        images: [
            {
                url: '/api/og/public?title=Biljke&description=Istra%C5%BEi+biljke+koje+mo%C5%BEe%C5%A1+posaditi+u+svojim+gredicama.&eyebrow=Katalog+biljaka',
                alt: 'Naslovna slika biljnog kataloga',
            },
        ],
    });
    assert.deepEqual(metadata.keywords, ['biljke', 'vrt']);
});

test('keeps noindex share metadata generic when no canonical path is provided', () => {
    const robots = { index: false, follow: false };
    const metadata = createPublicMetadata(
        {
            title: 'Trag berbe',
            description: 'Javni trag berbe Gredice.',
            eyebrow: 'Od vrta do stola',
            robots,
        },
        localUnsignedSigningConfig,
    );

    assert.equal(metadata.alternates, undefined);
    assert.equal(metadata.openGraph && 'url' in metadata.openGraph, false);
    assert.deepEqual(metadata.robots, robots);
    const images = metadata.openGraph?.images;
    assert.ok(Array.isArray(images));
    assert.doesNotMatch(JSON.stringify(images[0]), /token|trag\//);
});

test('only accepts public Gredice, CDN, and Vercel Blob image origins', () => {
    const accepted = [
        'https://cdn.gredice.com/plants/rajcica.webp',
        'https://www.gredice.com/assets/blocks/GardenBox.webp',
        'https://www.gredice.com/seo-fallback.png',
        'https://vrt.gredice.com/assets/previews/garden.webp',
        'https://myegtvromcktt2y7.public.blob.vercel-storage.com/plants/cover.jpg',
        'https://7ql7fvz1vzzo6adz.public.blob.vercel-storage.com/operations/cover.jpg',
    ];

    for (const imageUrl of accepted) {
        assert.equal(sanitizePublicOgImageUrl(imageUrl), imageUrl);
    }

    const rejected = [
        'http://cdn.gredice.com/plant.webp',
        'https://cdn.gredice.com.evil.example/plant.webp',
        'https://www.gredice.com/api/og/public',
        'https://vrt.gredice.com/private/plant.webp',
        'https://user:password@cdn.gredice.com/plant.webp',
        'https://cdn.gredice.com:444/plant.webp',
        'https://attacker.public.blob.vercel-storage.com/plant.webp',
        'https://example.com/plant.webp',
        'not-a-url',
    ];

    for (const imageUrl of rejected) {
        assert.equal(sanitizePublicOgImageUrl(imageUrl), undefined);
    }
});

test('truncates and normalizes untrusted card query text', () => {
    const params = new URLSearchParams({
        title: `  Biljke\u0000${'a'.repeat(120)}  `,
        description: `Opis\n${'b'.repeat(220)}`,
        category: `  Katalog\tbiljaka  `,
        image: 'https://example.com/private.jpg',
    });
    const parsed = parsePublicOgCardSearchParams(params);

    assert.ok(parsed);
    assert.equal(Array.from(parsed.title).length, 96);
    assert.equal(Array.from(parsed.description).length, 190);
    assert.equal(parsed.eyebrow, 'Katalog biljaka');
    assert.equal(parsed.imageUrl, undefined);
    assert.match(parsed.title, /^Biljke a+/);
    assert.match(parsed.title, /…$/);
});

test('rejects missing card fields and invalid canonical paths', () => {
    assert.equal(
        parsePublicOgCardSearchParams(new URLSearchParams({ title: 'Biljke' })),
        null,
    );
    assert.throws(
        () =>
            createPublicMetadata(
                {
                    title: 'Biljke',
                    description: 'Opis.',
                    path: 'https://example.com/biljke',
                },
                localUnsignedSigningConfig,
            ),
        /root-relative/,
    );
    assert.throws(
        () =>
            buildPublicOgImagePath(
                {
                    title: '   ',
                    description: 'Opis.',
                },
                localUnsignedSigningConfig,
            ),
        /title must not be empty/,
    );
});

test('rejects high-cardinality query variants outside the public card schema', () => {
    assert.equal(
        isValidPublicOgSearchParams(
            new URLSearchParams({
                title: 'Biljke',
                description: 'Opis.',
                image: 'https://example.com/untrusted.jpg',
            }),
        ),
        false,
    );
    assert.equal(
        isValidPublicOgSearchParams(
            new URLSearchParams(
                'title=Biljke&title=Drugi+naslov&description=Opis.',
            ),
        ),
        false,
    );
    assert.equal(
        isValidPublicOgSearchParams(
            new URLSearchParams({
                title: 'Biljke',
                description: 'Opis.',
                cacheBuster: 'arbitrary',
            }),
        ),
        false,
    );
    assert.equal(
        isValidPublicOgSearchParams(
            new URLSearchParams({
                title: '  Biljke  ',
                description: 'Opis.',
            }),
        ),
        false,
    );
    assert.equal(
        isValidPublicOgSearchParams(
            new URLSearchParams({
                title: 'Biljke',
                description: 'Opis.',
                eyebrow: '   ',
            }),
        ),
        false,
    );
});

test('drops an oversized optional cover instead of creating an invalid card URL', () => {
    const path = buildPublicOgImagePath(
        {
            title: 'Biljke',
            description: 'Opis.',
            imageUrl: `https://cdn.gredice.com/cover.webp?q=${'&'.repeat(1_800)}`,
        },
        localUnsignedSigningConfig,
    );

    assert.match(path, /^\/api\/og\/public\?title=Biljke&description=Opis\.$/);
    assert.doesNotMatch(path, /image=/);
});

test('adds a canonical signature when a signing secret is configured', () => {
    const path = buildPublicOgImagePath(
        {
            title: 'Biljke',
            description: 'Opis.',
            eyebrow: 'Katalog biljaka',
        },
        configuredSigningConfig,
    );
    const url = new URL(path, 'https://www.gredice.com');

    assert.deepEqual(Array.from(url.searchParams.keys()), [
        'title',
        'description',
        'eyebrow',
        'sig',
    ]);
    assert.match(url.searchParams.get('sig') ?? '', /^[A-Za-z0-9_-]{43}$/);
});
