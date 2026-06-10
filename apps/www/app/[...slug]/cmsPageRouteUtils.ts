import type {
    CmsPageRenderMaxWidth,
    CmsPageRenderMode,
    SectionData,
} from '@gredice/ui/cms';

const defaultCmsPageRenderMode: CmsPageRenderMode = 'container';
const defaultCmsPageRenderMaxWidth: CmsPageRenderMaxWidth = 'lg';
const cmsPageRenderModes = new Set<CmsPageRenderMode>([
    'container',
    'fullWidth',
]);
const cmsPageRenderMaxWidths = new Set<CmsPageRenderMaxWidth>([
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
]);
function isSectionData(section: unknown): section is SectionData {
    return (
        section !== null &&
        typeof section === 'object' &&
        'component' in section &&
        typeof section.component === 'string'
    );
}

export function normalizeCmsRouteSlug(segments: string[]) {
    return segments
        .map((segment) => segment.trim())
        .filter(Boolean)
        .join('/');
}

export function parseCmsSectionData(value: unknown): SectionData[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(isSectionData);
}

export function parseCmsPageRenderMode(value: unknown): CmsPageRenderMode {
    return typeof value === 'string' &&
        cmsPageRenderModes.has(value as CmsPageRenderMode)
        ? (value as CmsPageRenderMode)
        : defaultCmsPageRenderMode;
}

export function parseCmsPageRenderMaxWidth(
    value: unknown,
): CmsPageRenderMaxWidth {
    return typeof value === 'string' &&
        cmsPageRenderMaxWidths.has(value as CmsPageRenderMaxWidth)
        ? (value as CmsPageRenderMaxWidth)
        : defaultCmsPageRenderMaxWidth;
}

const reservedFirstSegments = new Set([
    'biljke',
    'bolesti',
    'blokovi',
    'cesta-pitanja',
    'checkout',
    'cjenik',
    'development',
    'dostava',
    'kontakt',
    'legalno',
    'novosti',
    'o-nama',
    'outlet',
    'podignuta-gredica',
    'pozdrav',
    'preporuke',
    'pretraga',
    'racun',
    'radnje',
    'recepti',
    'stetnici',
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
