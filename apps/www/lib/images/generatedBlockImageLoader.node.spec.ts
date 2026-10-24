import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getImageProps } from 'next/image';
import sharp from 'sharp';
import { generatedBlockImageLoader } from './generatedBlockImageLoader';

const source = 'https://www.gredice.com/assets/blocks/Tree.webp?v=content-hash';
test('generated block srcsets collapse oversized variants without losing mobile choices', () => {
    const { props } = getImageProps({
        alt: 'Tree',
        src: source,
        fill: true,
        sizes: '(min-width: 1280px) 16vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw',
        loader: generatedBlockImageLoader,
    });
    const variants = (props.srcSet ?? '').split(', ').map((entry) => {
        const url = new URL(
            entry.split(' ')[0] ?? '',
            'https://www.gredice.com',
        );
        assert.equal(url.searchParams.get('url'), source);
        assert.equal(url.searchParams.get('q'), '75');
        return Number(url.searchParams.get('w'));
    });
    assert.ok(variants.length > 0);
    assert.ok(variants.every((width) => width <= 640));
    assert.ok(variants.some((width) => width < 640));
    assert.ok(new Set(variants).size < variants.length);
    assert.equal(props.loading, 'lazy');
});
test('content replacement changes keys and fixed small images retain resolution and quality', () => {
    const small = generatedBlockImageLoader({
        src: source,
        width: 96,
        quality: 75,
    });
    assert.equal(
        new URL(small, 'https://www.gredice.com').searchParams.get('w'),
        '96',
    );
    assert.notEqual(
        small,
        generatedBlockImageLoader({
            src: source.replace('content-hash', 'changed-content'),
            width: 96,
            quality: 75,
        }),
    );
    assert.equal(
        small,
        generatedBlockImageLoader({ src: source, width: 96, quality: 60 }),
    );
});

test('every generated public block source satisfies the 640px loader contract', async () => {
    const directory = new URL('../../public/assets/blocks/', import.meta.url);
    const files = (await readdir(directory)).filter((name) =>
        name.endsWith('.webp'),
    );
    assert.ok(files.length > 0);
    await Promise.all(
        files.map(async (name) => {
            const metadata = await sharp(
                fileURLToPath(new URL(name, directory)),
            ).metadata();
            assert.equal(metadata.width, 640, name);
        }),
    );
});
