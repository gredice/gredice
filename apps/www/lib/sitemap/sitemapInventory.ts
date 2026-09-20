import { normalizeSitemapPath } from './sitemapPolicy.ts';

/**
 * Route families used to report the sitemap inventory. Every family carries the
 * page-level reason for its inclusion policy so a change to the sitemap can be
 * reviewed without re-deriving the intent from the generator code.
 */
export const sitemapRouteFamilies = [
    {
        id: 'home',
        label: 'Naslovnica',
        reason: 'Jedina kanonska ulazna stranica.',
        matches: (path: string) => path === '/',
    },
    {
        id: 'plants',
        label: 'Biljke',
        reason: 'Katalog biljaka: hub i detalji sorti su jedinstveni sadržaj.',
        matches: (path: string) => isWithin(path, '/biljke'),
    },
    {
        id: 'blocks',
        label: 'Blokovi',
        reason: 'Stranice blokova opisuju virtualne predmete iz igre i ostaju indeksirane.',
        matches: (path: string) => isWithin(path, '/blokovi'),
    },
    {
        id: 'operations',
        label: 'Radnje',
        reason: 'Vodiči za radnje u vrtu.',
        matches: (path: string) => isWithin(path, '/radnje'),
    },
    {
        id: 'plant-health',
        label: 'Bolesti i štetnici',
        reason: 'Zdravstveni vodiči za biljke.',
        matches: (path: string) =>
            isWithin(path, '/bolesti') || isWithin(path, '/stetnici'),
    },
    {
        id: 'seeds',
        label: 'Sjeme',
        reason: 'Katalog sjemena i brendova.',
        matches: (path: string) => isWithin(path, '/sjeme'),
    },
    {
        id: 'gardens',
        label: 'Javni vrtovi',
        reason: 'Javni vrtovi s vlastitim sadržajem; početni vrtovi bez izmjena se izostavljaju.',
        matches: (path: string) => isWithin(path, '/vrtovi'),
    },
    {
        id: 'news',
        label: 'Novosti',
        reason: 'Objave i zapisi promjena su zasebni članci.',
        matches: (path: string) => isWithin(path, '/novosti'),
    },
    {
        id: 'users',
        label: 'Korisnici',
        reason: 'Javni profili korisnika.',
        matches: (path: string) => isWithin(path, '/korisnici'),
    },
    {
        id: 'commerce',
        label: 'Ponuda i dostava',
        reason: 'Komercijalne stranice s cijenama, dostavom i ponudama.',
        matches: (path: string) =>
            isWithin(path, '/cjenik') ||
            isWithin(path, '/dostava') ||
            isWithin(path, '/outlet') ||
            isWithin(path, '/suncokreti') ||
            isWithin(path, '/podignuta-gredica'),
    },
    {
        id: 'legal',
        label: 'Pravno',
        reason: 'Obvezni pravni dokumenti.',
        matches: (path: string) =>
            isWithin(path, '/legalno') ||
            isWithin(path, '/povrati-i-povrat-novca'),
    },
    {
        id: 'content',
        label: 'Sadržajne stranice',
        reason: 'Uredničke i informativne stranice.',
        matches: () => true,
    },
] as const;

export type SitemapRouteFamilyId = (typeof sitemapRouteFamilies)[number]['id'];

export type SitemapInventoryRecord = {
    path: string;
    lastmod?: string | null;
    /** HTTP status observed while probing the deployed page. */
    status?: number | null;
    /** `false` when the rendered page asks robots not to index it. */
    indexable?: boolean | null;
    /** Canonical URL rendered by the page, when probed. */
    canonical?: string | null;
    /** `false` when the probed page rendered no meaningful body content. */
    hasContent?: boolean | null;
    /** Search Console impressions, when a report was supplied. */
    impressions?: number | null;
};

export type SitemapInventoryRow = {
    family: SitemapRouteFamilyId;
    label: string;
    reason: string;
    total: number;
    withLastmod: number;
    withoutLastmod: number;
    okStatus: number;
    otherStatus: number;
    indexable: number;
    noIndex: number;
    canonicalMismatch: number;
    emptyContent: number;
    impressions: number | null;
};

function isWithin(path: string, base: string) {
    return path === base || path.startsWith(`${base}/`);
}

export function resolveSitemapRouteFamily(path: string) {
    const [pathname = '/'] = normalizeSitemapPath(path).split('?');
    const family = sitemapRouteFamilies.find((candidate) =>
        candidate.matches(pathname),
    );

    // The trailing family matches everything, so this only guards refactors.
    return family ?? sitemapRouteFamilies[sitemapRouteFamilies.length - 1];
}

function canonicalPathOf(canonical: string | null | undefined) {
    if (!canonical) {
        return null;
    }

    try {
        return normalizeSitemapPath(new URL(canonical).pathname);
    } catch {
        return normalizeSitemapPath(canonical);
    }
}

export function summarizeSitemapInventory(
    records: ReadonlyArray<SitemapInventoryRecord>,
): SitemapInventoryRow[] {
    const rowsByFamily = new Map<SitemapRouteFamilyId, SitemapInventoryRow>();

    for (const record of records) {
        const family = resolveSitemapRouteFamily(record.path);
        const row = rowsByFamily.get(family.id) ?? {
            family: family.id,
            label: family.label,
            reason: family.reason,
            total: 0,
            withLastmod: 0,
            withoutLastmod: 0,
            okStatus: 0,
            otherStatus: 0,
            indexable: 0,
            noIndex: 0,
            canonicalMismatch: 0,
            emptyContent: 0,
            impressions: null,
        };

        row.total += 1;
        if (record.lastmod) {
            row.withLastmod += 1;
        } else {
            row.withoutLastmod += 1;
        }

        if (typeof record.status === 'number') {
            if (record.status >= 200 && record.status < 300) {
                row.okStatus += 1;
            } else {
                row.otherStatus += 1;
            }
        }

        if (record.indexable === true) {
            row.indexable += 1;
        } else if (record.indexable === false) {
            row.noIndex += 1;
        }

        const canonicalPath = canonicalPathOf(record.canonical);
        if (
            canonicalPath &&
            canonicalPath !== normalizeSitemapPath(record.path)
        ) {
            row.canonicalMismatch += 1;
        }

        if (record.hasContent === false) {
            row.emptyContent += 1;
        }

        if (typeof record.impressions === 'number') {
            row.impressions = (row.impressions ?? 0) + record.impressions;
        }

        rowsByFamily.set(family.id, row);
    }

    return sitemapRouteFamilies
        .map((family) => rowsByFamily.get(family.id))
        .filter((row): row is SitemapInventoryRow => Boolean(row));
}

export function formatSitemapInventoryMarkdown(
    rows: ReadonlyArray<SitemapInventoryRow>,
) {
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const header = [
        '| Obitelj ruta | URL-ova | S lastmod | Bez lastmod | 2xx | Ostali status | Index | Noindex | Kanonsko odstupanje | Prazan sadržaj | Prikazi | Razlog |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ];
    const body = rows.map((row) =>
        [
            row.label,
            row.total,
            row.withLastmod,
            row.withoutLastmod,
            row.okStatus,
            row.otherStatus,
            row.indexable,
            row.noIndex,
            row.canonicalMismatch,
            row.emptyContent,
            row.impressions ?? '—',
            row.reason,
        ].join(' | '),
    );

    return [
        `Ukupno URL-ova u sitemapu: ${total.toString()}`,
        '',
        ...header,
        ...body.map((line) => `| ${line} |`),
        '',
    ].join('\n');
}
