import type { SectionData } from '@signalco/cms-core/SectionData';

export function normalizeCmsRouteSlug(segments: string[]) {
    return segments
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join('/');
}

function isSectionData(section: unknown): section is SectionData {
    if (!section || typeof section !== 'object') {
        return false;
    }

    if (!('component' in section)) {
        return false;
    }

    return typeof section.component === 'string';
}

export function parseCmsSectionData(value: unknown): SectionData[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(isSectionData);
}

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
