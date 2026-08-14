import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    blogArchiveMetadata,
    changelogArchiveMetadata,
} from '../../news/lib/newsArchiveMetadata.ts';
import {
    hasNewsFilterResults,
    isKnownNewsFilter,
} from '../../news/lib/newsFilters.ts';
import { plantArchivePath } from '../app/biljke/plantArchivePath.ts';
import {
    canonicalLegacyNewsQueryPath,
    canonicalPlantArchiveQueryPath,
} from '../src/canonicalQueryRedirects.ts';
import { matchesPageAlias } from '../src/pageAliases.ts';
import { canonicalLegacyPlantSortPathname } from '../src/plantSortPaths.ts';

const legacyPlantSortRedirects = [
    [
        '/biljke/grasak/sorte/grasak-deliket',
        '/biljke/grasak/sorte/grasak-delikett',
    ],
    [
        '/biljke/grah/sorte/grah-mahunar-zeleni-niski-starozagorski',
        '/biljke/mahuna/sorte/grah-mahunar-zeleni-niski-starozagorski',
    ],
    [
        '/biljke/mahuna/sorte/grah-zeleni-niski-starozagorski',
        '/biljke/mahuna/sorte/grah-mahunar-zeleni-niski-starozagorski',
    ],
    [
        '/biljke/rotkvica/sorte/rotkvica-schwarzer-winter',
        '/biljke/rotkvica/sorte/rotkvica-runder-schwarzer-winter',
    ],
    [
        '/biljke/bosiljak/sorte/bisiljak-italiano-classico',
        '/biljke/bosiljak/sorte/bosiljak-italiano-classico',
    ],
    [
        '/biljke/blitva/sorte/blitva-bright-lighs',
        '/biljke/blitva/sorte/blitva-bright-lights',
    ],
    [
        '/biljke/dinja/sorte/dinja-melona-ananas',
        '/biljke/dinja/sorte/dinja-ananas',
    ],
    [
        '/biljke/rajcica/sorte/rajcica-scatolone-2',
        '/biljke/rajcica/sorte/rajcica-scatolone',
    ],
    [
        '/biljke/salata/sorte/salata-puterica-zimska',
        '/biljke/salata/sorte/salata-puterica-zimska-rjavka',
    ],
    [
        '/biljke/paprika/sorte/paprika-californian-wonder',
        '/biljke/paprika/sorte/paprika-california-wonder',
    ],
    [
        '/biljke/luk/sorte/luk-blanca-barletta',
        '/biljke/luk/sorte/luk-bianca-di-barletta',
    ],
    [
        '/biljke/rotkva/sorte/rotkva-crna-zimska-nero-tondo-dinverno',
        '/biljke/rotkvica/sorte/rotkvica-crna-zimska-nero-tondo-d-inverno',
    ],
    [
        '/biljke/mahuna/sorte/grah-mahunar-meraviglia-di-veneyia-a-grano-nero',
        '/biljke/mahuna/sorte/grah-mahunar-meraviglia-di-venezia-a-grano-nero',
    ],
    [
        '/biljke/matovilac/sorte/matovilac-favor-f1',
        '/biljke/matovilac/sorte/matovilac-favor',
    ],
    [
        '/biljke/grah/sorte/grah-borloto-lingua-di-fuoco-2',
        '/biljke/grah/sorte/grah-borlotto-lingua-di-fuoco-2',
    ],
    [
        '/biljke/rotkvica/sorte/rotkvica-crna-zimska-nero-tondo-dinverno',
        '/biljke/rotkvica/sorte/rotkvica-crna-zimska-nero-tondo-d-inverno',
    ],
    [
        '/biljke/persin/sorte/persin-hablange',
        '/biljke/persin/sorte/persin-berlinski-poludugi',
    ],
] as const;

test('legacy plant-sort paths redirect to current canonical paths', () => {
    for (const [
        legacyPathname,
        canonicalPathname,
    ] of legacyPlantSortRedirects) {
        assert.equal(
            canonicalLegacyPlantSortPathname(legacyPathname),
            canonicalPathname,
            legacyPathname,
        );
    }
});

test('unknown plant-sort aliases are not redirected', () => {
    assert.equal(
        canonicalLegacyPlantSortPathname(
            '/biljke/rajcica/sorte/nepostojeca-sorta',
        ),
        null,
    );
});

test('page aliases match authoritative entity slugs', () => {
    assert.equal(
        matchesPageAlias(
            'Promijenjeni naziv',
            'stabilni-alias',
            'stabilni-alias',
        ),
        true,
    );
    assert.equal(
        matchesPageAlias('Promijenjeni naziv', 'nepostojeci', 'stabilni-alias'),
        false,
    );
});

test('missing plant-sort routes use a quiet not-found response', () => {
    const source = readFileSync(
        new URL(
            '../app/biljke/[alias]/sorte/[sortAlias]/page.tsx',
            import.meta.url,
        ),
        'utf8',
    );

    assert.doesNotMatch(source, /Base plant or sort not found/u);
    assert.doesNotMatch(source, /Invalid parameters for plant sort page/u);
});

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
    assert.equal(hasNewsFilterResults('older-valid-tag', 1), true);
    assert.equal(hasNewsFilterResults('Unrelated', 0), false);
    assert.equal(hasNewsFilterResults(undefined, 0), true);
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
        [
            '../app/biljke/[alias]/page.tsx',
            /path:\s*KnownPages\.Plant\(/u,
            /\.slug\s*\|\|/u,
        ],
        [
            '../app/biljke/[alias]/sorte/[sortAlias]/page.tsx',
            /path:\s*KnownPages\.PlantSort\(/u,
            /\.slug\s*\|\|/u,
        ],
        [
            '../app/blokovi/[alias]/page.tsx',
            /path:\s*KnownPages\.Block\(/u,
            /getBlockRouteAlias\(/u,
        ],
        [
            '../app/blokovi/biljke/[alias]/page.tsx',
            /path:\s*KnownPages\.BlockPlant\(/u,
            /\.slug\s*\|\|/u,
        ],
        [
            '../app/radnje/[alias]/page.tsx',
            /path:\s*KnownPages\.Operation\(/u,
            /\.slug\s*\|\|/u,
        ],
    ] as const;

    for (const [relativePath, pathPattern, aliasPattern] of routes) {
        const source = readFileSync(
            new URL(relativePath, import.meta.url),
            'utf8',
        );
        assert.match(source, pathPattern, relativePath);
        assert.match(source, aliasPattern, relativePath);
    }
});
