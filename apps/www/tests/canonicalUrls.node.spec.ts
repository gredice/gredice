import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    blogArchiveMetadata,
    changelogArchiveMetadata,
} from '../../news/lib/newsArchiveMetadata.ts';
import { isKnownNewsFilter } from '../../news/lib/newsFilters.ts';
import { plantArchivePath } from '../app/biljke/plantArchivePath.ts';
import {
    canonicalLegacyNewsQueryPath,
    canonicalPlantArchiveQueryPath,
} from '../src/canonicalQueryRedirects.ts';

test('legacy root news filters redirect to their current archives', () => {
    assert.equal(
        canonicalLegacyNewsQueryPath('/', new URLSearchParams('tag=Biljke')),
        '/novosti/sto-je-novo?tag=Biljke',
    );
    assert.equal(
        canonicalLegacyNewsQueryPath('/', new URLSearchParams('category=Vrt')),
        '/novosti?category=Vrt',
    );
    assert.equal(
        canonicalLegacyNewsQueryPath(
            '/',
            new URLSearchParams('type=changelog'),
        ),
        '/novosti/sto-je-novo',
    );
    assert.equal(
        canonicalLegacyNewsQueryPath('/', new URLSearchParams('type=blog')),
        '/novosti',
    );
    assert.equal(
        canonicalLegacyNewsQueryPath(
            '/biljke',
            new URLSearchParams('tag=Biljke'),
        ),
        null,
    );
    assert.equal(
        canonicalLegacyNewsQueryPath('/', new URLSearchParams()),
        null,
    );
});

test('the default plant list does not emit a duplicate view query', () => {
    assert.equal(
        canonicalPlantArchiveQueryPath(
            '/biljke',
            new URLSearchParams('pregled=popis'),
        ),
        '/biljke',
    );
    assert.equal(
        canonicalPlantArchiveQueryPath(
            '/biljke',
            new URLSearchParams(
                'pregled=popis&pretraga=raj%C4%8Dica&vrijemeZaSijanje=1',
            ),
        ),
        '/biljke?pretraga=raj%C4%8Dica&vrijemeZaSijanje=1',
    );
    assert.equal(
        canonicalPlantArchiveQueryPath(
            '/biljke',
            new URLSearchParams('pregled=kalendar'),
        ),
        null,
    );
    assert.equal(
        plantArchivePath({
            search: '',
            seedTimeOnly: false,
            view: 'popis',
        }),
        '/biljke',
    );
    assert.equal(
        plantArchivePath({
            search: 'rajčica',
            seedTimeOnly: true,
            view: 'popis',
        }),
        '/biljke?pretraga=raj%C4%8Dica&vrijemeZaSijanje=1',
    );
    assert.equal(
        plantArchivePath({
            search: '',
            seedTimeOnly: false,
            view: 'kalendar',
        }),
        '/biljke?pregled=kalendar',
    );
});

test('news filters reject stale and test-only values', () => {
    assert.equal(isKnownNewsFilter(['Biljke', 'Vrt'], ' biljke '), true);
    assert.equal(isKnownNewsFilter(['Biljke', 'Vrt'], undefined), true);
    assert.equal(isKnownNewsFilter(['Biljke', 'Vrt'], 'Unrelated'), false);
});

test('news archives declare stable public canonicals', () => {
    assert.equal(
        blogArchiveMetadata.alternates?.canonical,
        'https://www.gredice.com/novosti',
    );
    assert.equal(
        changelogArchiveMetadata.alternates?.canonical,
        'https://www.gredice.com/novosti/sto-je-novo',
    );
});

test('query-driven public archives declare stable canonicals', () => {
    const routes = [
        ['../app/page.tsx', /canonical:\s*KnownPages\.Landing/u],
        ['../app/biljke/page.tsx', /path:\s*KnownPages\.Plants/u],
        ['../app/radnje/page.tsx', /path:\s*KnownPages\.Operations/u],
        ['../app/blokovi/page.tsx', /path:\s*KnownPages\.Blocks/u],
        ['../app/blokovi/biljke/page.tsx', /path:\s*KnownPages\.BlockPlants/u],
        [
            '../app/blokovi/biljke/generator/page.tsx',
            /canonical:\s*KnownPages\.BlockPlantGenerator/u,
        ],
        [
            '../../news/app/page.tsx',
            /metadata:\s*Metadata\s*=\s*blogArchiveMetadata/u,
        ],
        [
            '../../news/app/sto-je-novo/page.tsx',
            /metadata:\s*Metadata\s*=\s*changelogArchiveMetadata/u,
        ],
    ] as const;

    for (const [relativePath, pattern] of routes) {
        const source = readFileSync(
            new URL(relativePath, import.meta.url),
            'utf8',
        );
        assert.match(source, pattern, relativePath);
    }
});

test('alias-backed entity metadata uses authoritative canonical paths', () => {
    const routes = [
        ['../app/biljke/[alias]/page.tsx', /path:\s*KnownPages\.Plant\(/u],
        [
            '../app/biljke/[alias]/sorte/[sortAlias]/page.tsx',
            /path:\s*KnownPages\.PlantSort\(/u,
        ],
        ['../app/blokovi/[alias]/page.tsx', /path:\s*KnownPages\.Block\(/u],
        [
            '../app/blokovi/biljke/[alias]/page.tsx',
            /path:\s*KnownPages\.BlockPlant\(/u,
        ],
        ['../app/radnje/[alias]/page.tsx', /path:\s*KnownPages\.Operation\(/u],
    ] as const;

    for (const [relativePath, pattern] of routes) {
        const source = readFileSync(
            new URL(relativePath, import.meta.url),
            'utf8',
        );
        assert.match(source, pattern, relativePath);
        assert.match(source, /\.slug\s*\|\|/u, relativePath);
    }
});
