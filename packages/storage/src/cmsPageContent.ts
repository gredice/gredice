import { supportedCmsPageSectionComponents } from './cmsPageSections';

export type CmsPageRenderMode = 'container' | 'fullWidth';
export type CmsSectionRenderMode = 'inherit' | CmsPageRenderMode;
export type CmsPageRenderMaxWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type CmsPageContentDocument = {
    renderMode: CmsPageRenderMode;
    renderMaxWidth: CmsPageRenderMaxWidth;
    sections: Record<string, unknown>[];
};

export const defaultCmsPageRenderMode: CmsPageRenderMode = 'container';
export const defaultCmsPageRenderMaxWidth: CmsPageRenderMaxWidth = 'lg';

const cmsPageRenderModes = new Set<CmsPageRenderMode>([
    'container',
    'fullWidth',
]);
const cmsSectionRenderModes = new Set<CmsSectionRenderMode>([
    'inherit',
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

function sectionRecords(value: unknown[]): Record<string, unknown>[] {
    return value.map((section, index) => {
        if (!isRecord(section)) {
            throw new Error(
                `Section at index ${index} must be an object with a component field.`,
            );
        }

        return section;
    });
}

function normalizeSectionRecordLayout(section: Record<string, unknown>) {
    const next = { ...section };
    const renderMode = normalizeCmsSectionRenderMode(next.renderMode);

    if (renderMode === 'inherit') {
        delete next.renderMode;
        delete next.renderMaxWidth;
        return next;
    }

    next.renderMode = renderMode;

    if (renderMode === 'container') {
        next.renderMaxWidth = normalizeCmsPageRenderMaxWidth(
            next.renderMaxWidth,
        );
    } else {
        delete next.renderMaxWidth;
    }

    return next;
}

export function normalizeCmsPageRenderMode(value: unknown): CmsPageRenderMode {
    return typeof value === 'string' &&
        cmsPageRenderModes.has(value as CmsPageRenderMode)
        ? (value as CmsPageRenderMode)
        : defaultCmsPageRenderMode;
}

export function normalizeCmsSectionRenderMode(
    value: unknown,
): CmsSectionRenderMode {
    return typeof value === 'string' &&
        cmsSectionRenderModes.has(value as CmsSectionRenderMode)
        ? (value as CmsSectionRenderMode)
        : 'inherit';
}

export function normalizeCmsPageRenderMaxWidth(
    value: unknown,
): CmsPageRenderMaxWidth {
    return typeof value === 'string' &&
        cmsPageRenderMaxWidths.has(value as CmsPageRenderMaxWidth)
        ? (value as CmsPageRenderMaxWidth)
        : defaultCmsPageRenderMaxWidth;
}

function parseCmsPageContentValue(value: unknown): CmsPageContentDocument {
    if (Array.isArray(value)) {
        return {
            renderMode: defaultCmsPageRenderMode,
            renderMaxWidth: defaultCmsPageRenderMaxWidth,
            sections: sectionRecords(value),
        };
    }

    if (isRecord(value) && Array.isArray(value.sections)) {
        return {
            renderMode: normalizeCmsPageRenderMode(value.renderMode),
            renderMaxWidth: normalizeCmsPageRenderMaxWidth(
                value.renderMaxWidth,
            ),
            sections: sectionRecords(value.sections),
        };
    }

    throw new Error(
        'Page content must be a JSON array of SectionData blocks or a CMS page content document.',
    );
}

export function parseCmsPageContent(
    content: string | null | undefined,
): CmsPageContentDocument {
    if (!content?.trim()) {
        return {
            renderMode: defaultCmsPageRenderMode,
            renderMaxWidth: defaultCmsPageRenderMaxWidth,
            sections: [],
        };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error(
            'Page content must be valid JSON SectionData blocks or a CMS page content document.',
        );
    }

    return parseCmsPageContentValue(parsed);
}

export function validateCmsPageContentSections(
    sections: Record<string, unknown>[],
) {
    sections.forEach((section, index) => {
        if (typeof section.component !== 'string') {
            throw new Error(
                `Section at index ${index} must define a string component.`,
            );
        }

        if (!supportedCmsPageSectionComponents.has(section.component)) {
            throw new Error(
                `Section at index ${index} has unsupported component: ${section.component}.`,
            );
        }

        if (section.renderMode !== undefined) {
            normalizeCmsSectionRenderMode(section.renderMode);
        }

        if (section.renderMaxWidth !== undefined) {
            normalizeCmsPageRenderMaxWidth(section.renderMaxWidth);
        }
    });
}

export function normalizeCmsPageContent(content: string | null | undefined) {
    const normalized = content?.trim();
    if (!normalized) {
        return null;
    }

    const parsed = parseCmsPageContent(normalized);
    validateCmsPageContentSections(parsed.sections);
    const sections = parsed.sections.map(normalizeSectionRecordLayout);

    const source: unknown = JSON.parse(normalized);
    if (Array.isArray(source)) {
        return JSON.stringify(sections);
    }

    const document: Partial<CmsPageContentDocument> & {
        sections: Record<string, unknown>[];
    } = {
        sections,
    };

    if (parsed.renderMode !== defaultCmsPageRenderMode) {
        document.renderMode = parsed.renderMode;
    }

    if (
        parsed.renderMode === 'container' &&
        parsed.renderMaxWidth !== defaultCmsPageRenderMaxWidth
    ) {
        document.renderMaxWidth = parsed.renderMaxWidth;
    }

    return JSON.stringify(document);
}
