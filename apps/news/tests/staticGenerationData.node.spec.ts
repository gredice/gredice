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
    assert.match(source, /unstable_cache/u);
    assert.match(source, /revalidate: 3600/u);
    assert.match(source, /revalidate: 86_400/u);
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

test('the changelog archive and weekly summaries use daily ISR', () => {
    const archiveSource = readFileSync(
        new URL('../app/sto-je-novo/page.tsx', import.meta.url),
        'utf8',
    );
    assert.match(archiveSource, /export const revalidate = 86_400;/u);
    assert.doesNotMatch(archiveSource, /force-dynamic|searchParams/u);

    const weeklyPageSource = readFileSync(
        new URL('../app/sto-je-novo/tjedan/[week]/page.tsx', import.meta.url),
        'utf8',
    );
    assert.match(weeklyPageSource, /generateStaticParams/u);
    assert.match(weeklyPageSource, /export const revalidate = 86_400;/u);
    assert.doesNotMatch(weeklyPageSource, /force-dynamic/u);

    const weeklyImageSource = readFileSync(
        new URL(
            '../app/sto-je-novo/tjedan/[week]/opengraph-image.tsx',
            import.meta.url,
        ),
        'utf8',
    );
    assert.match(weeklyImageSource, /export const revalidate = 86_400;/u);
    assert.doesNotMatch(weeklyImageSource, /force-dynamic/u);
});

test('the changelog archive eagerly loads only its first weekly cover', () => {
    const cardSource = readFileSync(
        new URL('../components/WeeklyChangelogCard.tsx', import.meta.url),
        'utf8',
    );
    assert.match(cardSource, /eager\?: boolean/u);
    assert.match(cardSource, /loading=\{eager \? 'eager' : 'lazy'\}/u);

    const timelineSource = readFileSync(
        new URL('../components/WeeklyChangelogTimeline.tsx', import.meta.url),
        'utf8',
    );
    assert.match(timelineSource, /eager=\{currentWeekIndex === 0\}/u);
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
