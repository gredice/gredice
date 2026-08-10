import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const httpDataSourcePattern =
    /\bclientPublic\b|\bgetServerGrediceApiOrigin\b|\bfetch\s*\(/u;

test('news pages read CMS data from storage without API fallbacks', () => {
    const source = readFileSync(
        new URL('../lib/news.ts', import.meta.url),
        'utf8',
    );

    assert.match(source, /getCmsPages/u);
    assert.doesNotMatch(source, httpDataSourcePattern);
    assert.doesNotMatch(source, /return \[\];/u);
});

test('blog and changelog detail routes generate published slugs statically', () => {
    const routes = [
        '../app/[slug]/page.tsx',
        '../app/sto-je-novo/[slug]/page.tsx',
    ];

    for (const relativePath of routes) {
        const source = readFileSync(
            new URL(relativePath, import.meta.url),
            'utf8',
        );
        assert.match(source, /generateStaticParams/u, relativePath);
        assert.match(source, /export const revalidate = 3600/u, relativePath);
        assert.doesNotMatch(source, /force-dynamic/u, relativePath);
    }
});

test('article Open Graph images are eligible for static generation', () => {
    const routes = [
        '../app/[slug]/opengraph-image.tsx',
        '../app/sto-je-novo/[slug]/opengraph-image.tsx',
    ];

    for (const relativePath of routes) {
        const source = readFileSync(
            new URL(relativePath, import.meta.url),
            'utf8',
        );
        assert.match(source, /export const revalidate = 3600/u, relativePath);
        assert.doesNotMatch(source, /force-dynamic/u, relativePath);
    }
});

test('the News build receives its direct storage connection', () => {
    const turboConfig = readFileSync(
        new URL('../turbo.json', import.meta.url),
        'utf8',
    );

    assert.match(turboConfig, /"POSTGRES_URL"/u);
});
