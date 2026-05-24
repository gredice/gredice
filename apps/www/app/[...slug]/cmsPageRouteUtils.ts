import {
    normalizeCmsPageRenderMaxWidth,
    normalizeCmsPageRenderMode,
    parseSectionData,
} from '@gredice/ui/cms';

export function normalizeCmsRouteSlug(segments: string[]) {
    return segments
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join('/');
}

export const parseCmsSectionData = parseSectionData;
export const parseCmsPageRenderMode = normalizeCmsPageRenderMode;
export const parseCmsPageRenderMaxWidth = normalizeCmsPageRenderMaxWidth;

const reservedFirstSegments = new Set([
    'biljke',
    'blokovi',
    'cesta-pitanja',
    'checkout',
    'cjenik',
    'development',
    'dostava',
    'kontakt',
    'legalno',
    'o-nama',
    'podignuta-gredica',
    'pozdrav',
    'preporuke',
    'pretraga',
    'racun',
    'radnje',
    'recepti',
    'sjetva',
    'suncokreti',
    'vrtovi',
]);

export function hasReservedFirstSegment(slug: string) {
    const firstSegment = slug.split('/')[0]?.toLowerCase();
    if (!firstSegment) {
        return false;
    }

    return reservedFirstSegments.has(firstSegment);
}
