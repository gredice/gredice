'use client';

import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { slugify } from '@gredice/js/slug';
import type {
    CmsPageContentKind,
    CmsPageState,
    SelectCmsPage,
} from '@gredice/storage';
import {
    type CmsPageSectionComponent,
    type CmsPageSectionPreset,
    type CmsPageTextSectionField,
    cmsPageSectionComponents,
    cmsPageSectionPresets,
} from '@gredice/storage/cmsPageSections';
import { Button } from '@gredice/ui/Button';
import { ButtonGroup, buttonGroupItemClassName } from '@gredice/ui/ButtonGroup';
import { Card } from '@gredice/ui/Card';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Container } from '@gredice/ui/Container';
import {
    type CmsPageRenderMaxWidth,
    type CmsPageRenderMode,
    type CmsSectionRenderMode,
    normalizeCmsPageRenderMaxWidth,
    normalizeCmsPageRenderMode,
    normalizeCmsSectionRenderMode,
    parseCmsPageContentDocument,
    SectionsView,
} from '@gredice/ui/cms';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import {
    Add,
    ArrowDown,
    ArrowUp,
    Auto,
    Close,
    Code,
    Delete,
    Desktop,
    Down,
    Duplicate,
    ExternalLink,
    FullWidth,
    Globe,
    Info,
    LayoutGrid,
    Megaphone,
    Mobile,
    Tablet,
} from '@gredice/ui/icons';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@gredice/ui/Menu';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { PanelSection } from '@gredice/ui/PanelSection';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import {
    SidePanelLayout,
    SidePanelToggleButton,
} from '@gredice/ui/SidePanelLayout';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    type ReactNode,
    useActionState,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    useTransition,
} from 'react';
import {
    AdminPageHeader,
    DesktopNavCollapseOnMount,
} from '../../../../components/admin/navigation';
import { sectionsComponentRegistry } from '../../../../components/shared/sectionsComponentRegistry';
import { KnownPages } from '../../../../src/KnownPages';
import type { CmsPageAutosaveState, CmsPageFormState } from './actions';
import { CmsPageCoverImageField } from './CmsPageCoverImageField';
import type {
    CmsPageEditableSection,
    CmsPageSectionData,
} from './CmsPageFormTypes';
import { CmsPageMarkdownEditor } from './CmsPageMarkdownEditor';
import { CmsPageSectionFields } from './CmsPageSectionFields';
import {
    CmsPageSectionLibrary,
    componentPreviewSectionData,
    type SectionInfoItem,
    SectionInfoModal,
} from './CmsPageSectionLibrary';
import { CmsPageSortablePreviewSection } from './CmsPageSortablePreviewSection';
import { CmsPageTagsInput } from './CmsPageTagsInput';
import {
    type CmsPreviewViewport,
    cmsPagePreviewViewportClassNames,
    useCmsPreviewViewportSupport,
} from './CmsPreviewViewport';

type CmsPageFormProps = {
    page?: SelectCmsPage;
    template?: CmsPageFormTemplate;
    formId?: string;
    breadcrumbs?: ReactNode;
    heading?: ReactNode;
    action: (
        previousState: CmsPageFormState,
        formData: FormData,
    ) => Promise<CmsPageFormState>;
    autosaveAction?: (formData: FormData) => Promise<CmsPageAutosaveState>;
    deleteAction?: () => Promise<void>;
};

type ParsedCmsPageSections = {
    isStructured: boolean;
    sections: CmsPageSectionData[];
    renderMode: CmsPageRenderMode;
    renderMaxWidth: CmsPageRenderMaxWidth;
};

export type CmsPageFormTemplate = {
    contentKind: CmsPageContentKind;
    title?: string;
    slug?: string;
    content?: string;
    category?: string;
    tags?: string[];
    metaTitle?: string;
    metaDescription?: string;
    metaImageUrl?: string;
    seoImageUrl?: string;
    publishedAt?: Date | string | null;
};

const cmsPageSectionComponentsByName = new Map<string, CmsPageSectionComponent>(
    cmsPageSectionComponents.map((component) => [
        component.component,
        component,
    ]),
);

const cmsPageSectionPresetDataByComponent = new Map(
    cmsPageSectionPresets.map((preset) => [preset.data.component, preset.data]),
);

const renderMaxWidthOptions: CmsPageRenderMaxWidth[] = [
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
];

const cmsPageNavigatorCollapsedStorageKey =
    'gredice:cms-pages:editor:navigator-collapsed';
const cmsPageRightPanelCollapsedStorageKeyPrefix =
    'gredice:cms-pages:editor:right-panel-collapsed:';

function readStoredPanelCollapsedState(key: string) {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const value = window.localStorage.getItem(key);
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }
    } catch {
        return null;
    }

    return null;
}

function writeStoredPanelCollapsedState(key: string, collapsed: boolean) {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(key, String(collapsed));
    } catch {
        // Ignore unavailable localStorage, for example private browsing quotas.
    }
}

function parseSections(content?: string | null): ParsedCmsPageSections {
    if (!content) {
        return {
            isStructured: true,
            sections: [],
            renderMode: normalizeCmsPageRenderMode(undefined),
            renderMaxWidth: normalizeCmsPageRenderMaxWidth(undefined),
        };
    }

    try {
        const parsed: unknown = JSON.parse(content);
        if (
            !Array.isArray(parsed) &&
            !(
                parsed &&
                typeof parsed === 'object' &&
                'sections' in parsed &&
                Array.isArray(parsed.sections)
            )
        ) {
            return {
                isStructured: false,
                sections: [],
                renderMode: normalizeCmsPageRenderMode(undefined),
                renderMaxWidth: normalizeCmsPageRenderMaxWidth(undefined),
            };
        }

        const document = parseCmsPageContentDocument(parsed);
        return {
            isStructured: true,
            renderMode: normalizeCmsPageRenderMode(document.renderMode),
            renderMaxWidth: normalizeCmsPageRenderMaxWidth(
                document.renderMaxWidth,
            ),
            sections: document.sectionsData.filter(
                (section): section is CmsPageSectionData =>
                    Boolean(section) &&
                    typeof section === 'object' &&
                    'component' in section &&
                    typeof section.component === 'string',
            ),
        };
    } catch {
        return {
            isStructured: false,
            sections: [],
            renderMode: normalizeCmsPageRenderMode(undefined),
            renderMaxWidth: normalizeCmsPageRenderMaxWidth(undefined),
        };
    }
}

function formatJsonContent(content: string) {
    if (!content.trim()) {
        return '';
    }

    const parsed: unknown = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
}

function editableSection(
    section: CmsPageSectionData,
    occurrence: number,
): CmsPageEditableSection {
    return {
        id: `${section.component}-${occurrence}`,
        data: section,
    };
}

function editableSections(sections: CmsPageSectionData[]) {
    const sectionCounts = new Map<string, number>();
    return sections.map((section) => {
        const occurrence = sectionCounts.get(section.component) ?? 0;
        sectionCounts.set(section.component, occurrence + 1);
        return editableSection(section, occurrence);
    });
}

function stringifySections(
    sections: CmsPageEditableSection[],
    renderMode: CmsPageRenderMode,
    renderMaxWidth: CmsPageRenderMaxWidth,
) {
    const data = sections.map((section) => section.data);
    if (data.length === 0) {
        return '';
    }

    if (renderMode === 'container' && renderMaxWidth === 'lg') {
        return JSON.stringify(data, null, 2);
    }

    const document: {
        renderMode?: CmsPageRenderMode;
        renderMaxWidth?: CmsPageRenderMaxWidth;
        sections: CmsPageSectionData[];
    } = {
        sections: data,
    };

    if (renderMode !== 'container') {
        document.renderMode = renderMode;
    }

    if (renderMode === 'container' && renderMaxWidth !== 'lg') {
        document.renderMaxWidth = renderMaxWidth;
    }

    return JSON.stringify(document, null, 2);
}

function sectionValue(section: CmsPageEditableSection, key: string) {
    const value = section.data[key];
    return typeof value === 'string' ? value : '';
}

function sectionListValue(section: CmsPageEditableSection, key: string) {
    const value = section.data[key];
    return Array.isArray(value) ? value : [];
}

function sectionLabel(component: string) {
    return cmsPageSectionComponentsByName.get(component)?.label ?? component;
}

function sectionSummary(section: CmsPageEditableSection) {
    const fields =
        cmsPageSectionComponentsByName.get(section.data.component)?.fields ??
        [];

    for (const field of fields) {
        if (
            field.type === 'feature-list' ||
            field.type === 'cta-list' ||
            field.type === 'url'
        ) {
            continue;
        }

        const value = sectionValue(section, field.key).trim();
        if (value.length > 0) {
            return value;
        }
    }

    const firstFeature = sectionListValue(section, 'features').find(
        (feature): feature is Record<string, unknown> =>
            Boolean(feature) && typeof feature === 'object',
    );
    if (typeof firstFeature?.header === 'string') {
        return firstFeature.header;
    }

    return '';
}

function sectionRenderMode(section: CmsPageEditableSection) {
    return normalizeCmsSectionRenderMode(section.data.renderMode);
}

function sectionRenderMaxWidth(section: CmsPageEditableSection) {
    return normalizeCmsPageRenderMaxWidth(section.data.renderMaxWidth);
}

function sectionRenderCustomIndicator(section: CmsPageEditableSection) {
    const renderMode = sectionRenderMode(section);
    if (renderMode === 'inherit') {
        return null;
    }

    if (renderMode === 'fullWidth') {
        return {
            icon: <FullWidth className="size-3.5" />,
            label: 'Puna širina',
        };
    }

    const size = sectionRenderMaxWidth(section).toUpperCase();
    return {
        icon: <LayoutGrid className="size-3.5" />,
        label: `Kontejner ${size}`,
        text: size,
    };
}

function PageRenderModeButtonGroup({
    value,
    onChange,
}: {
    value: CmsPageRenderMode;
    onChange: (value: CmsPageRenderMode) => void;
}) {
    return (
        <ButtonGroup legend="Prikaz stranice" size="sm">
            <Button
                type="button"
                variant={value === 'container' ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={value === 'container'}
                aria-label="Kontejner"
                title="Kontejner"
                onClick={() => onChange('container')}
            >
                <LayoutGrid className="size-4" />
            </Button>
            <Button
                type="button"
                variant={value === 'fullWidth' ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={value === 'fullWidth'}
                aria-label="Puna širina"
                title="Puna širina"
                onClick={() => onChange('fullWidth')}
            >
                <FullWidth className="size-4" />
            </Button>
        </ButtonGroup>
    );
}

function SectionRenderModeButtonGroup({
    value,
    onChange,
}: {
    value: CmsSectionRenderMode;
    onChange: (value: CmsSectionRenderMode) => void;
}) {
    return (
        <ButtonGroup legend="Prikaz sekcije" size="sm">
            <Button
                type="button"
                variant={value === 'inherit' ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={value === 'inherit'}
                aria-label="Auto"
                title="Auto"
                onClick={() => onChange('inherit')}
            >
                <span aria-hidden="true" className="text-xs font-semibold">
                    A
                </span>
            </Button>
            <Button
                type="button"
                variant={value === 'container' ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={value === 'container'}
                aria-label="Kontejner"
                title="Kontejner"
                onClick={() => onChange('container')}
            >
                <LayoutGrid className="size-4" />
            </Button>
            <Button
                type="button"
                variant={value === 'fullWidth' ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={value === 'fullWidth'}
                aria-label="Puna širina"
                title="Puna širina"
                onClick={() => onChange('fullWidth')}
            >
                <FullWidth className="size-4" />
            </Button>
        </ButtonGroup>
    );
}

function RenderMaxWidthButtonGroup({
    legend,
    value,
    onChange,
}: {
    legend: string;
    value: CmsPageRenderMaxWidth;
    onChange: (value: CmsPageRenderMaxWidth) => void;
}) {
    return (
        <ButtonGroup legend={legend} size="sm">
            {renderMaxWidthOptions.map((option) => (
                <Button
                    key={option}
                    type="button"
                    variant={value === option ? 'solid' : 'plain'}
                    size="sm"
                    className={buttonGroupItemClassName()}
                    aria-pressed={value === option}
                    aria-label={option.toUpperCase()}
                    title={option.toUpperCase()}
                    onClick={() => onChange(option)}
                >
                    {option.toUpperCase()}
                </Button>
            ))}
        </ButtonGroup>
    );
}

function moveSection(
    sections: CmsPageEditableSection[],
    sectionId: string,
    offset: number,
) {
    const index = sections.findIndex((section) => section.id === sectionId);
    const targetIndex = index + offset;
    if (index < 0 || targetIndex < 0 || targetIndex >= sections.length) {
        return sections;
    }

    const next = [...sections];
    const movingSections = next.splice(index, 1);
    if (movingSections.length !== 1) {
        return sections;
    }

    const [movingSection] = movingSections;
    if (!movingSection) {
        return sections;
    }

    next.splice(targetIndex, 0, movingSection);
    return next;
}

function copySection(
    section: CmsPageEditableSection,
    id: string,
): CmsPageEditableSection {
    return {
        id,
        data: structuredClone(section.data),
    };
}

function validateSection(section: CmsPageEditableSection) {
    const fields =
        cmsPageSectionComponentsByName.get(section.data.component)?.fields ??
        [];

    return fields
        .filter((field) => field.required)
        .filter((field) => {
            const value = section.data[field.key];
            if (field.type === 'feature-list' || field.type === 'cta-list') {
                return !Array.isArray(value) || value.length === 0;
            }

            return !(typeof value === 'string' && value.trim().length > 0);
        })
        .map((field) => `${field.label} je obavezno polje.`);
}

function sectionFieldErrors(section: CmsPageEditableSection) {
    const fields =
        cmsPageSectionComponentsByName.get(section.data.component)?.fields ??
        [];

    return new Map(
        fields
            .filter((field) => field.required)
            .filter((field) => {
                if (
                    field.type === 'feature-list' ||
                    field.type === 'cta-list'
                ) {
                    return sectionListValue(section, field.key).length === 0;
                }

                return sectionValue(section, field.key).trim().length === 0;
            })
            .map((field) => [field.key, `${field.label} je obavezno polje.`]),
    );
}

function isMarkdownBlockField(
    field: CmsPageSectionComponent['fields'][number],
): field is CmsPageTextSectionField & {
    key: 'markdown';
    type: 'textarea';
} {
    return field.type === 'textarea' && field.key === 'markdown';
}

function formatLastSavedAt(value: number | null) {
    if (!value) return null;
    return new Intl.DateTimeFormat('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(new Date(value));
}

function formatDateTimeLocalValue(value: Date | string | null | undefined) {
    if (!value) {
        return '';
    }

    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const pad = (part: number) => String(part).padStart(2, '0');
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
            date.getDate(),
        )}` + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

function normalizeCmsPageSlugInput(value: string) {
    return value
        .trim()
        .split('/')
        .map((segment) => slugify(segment))
        .filter((segment) => segment.length > 0)
        .join('/');
}

function automaticSlugForTitle(title: string, contentKind: CmsPageContentKind) {
    const normalizedTitle = normalizeCmsPageSlugInput(title);
    if (!normalizedTitle) {
        return '';
    }

    if (contentKind === 'blog') {
        return `novosti/${normalizedTitle}`;
    }

    if (contentKind === 'changelog') {
        return `novosti/sto-je-novo/${normalizedTitle}`;
    }

    return normalizedTitle;
}

function normalizeFormContentKind(
    value: CmsPageContentKind | string | null | undefined,
): CmsPageContentKind {
    if (value === 'blog' || value === 'changelog' || value === 'page') {
        return value;
    }

    return 'page';
}

function normalizeFormPageState(
    value: CmsPageState | string | null | undefined,
): CmsPageState {
    if (value === 'draft' || value === 'in-review' || value === 'published') {
        return value;
    }

    return 'draft';
}

function canonicalPathFromSlug(value: string) {
    const normalized = normalizeCmsPageSlugInput(value);
    return normalized ? `/${normalized}` : '';
}

function cmsPageOgPreviewUrl({
    contentKind,
    imageUrl,
    tags,
    title,
}: {
    contentKind: CmsPageContentKind;
    imageUrl: string;
    tags: string[];
    title: string;
}) {
    const searchParams = new URLSearchParams();
    searchParams.set('contentKind', contentKind);
    searchParams.set('title', title.trim() || 'Gredice');
    if (imageUrl.trim()) {
        searchParams.set('imageUrl', imageUrl.trim());
    }

    for (const tag of tags) {
        if (tag.trim()) {
            searchParams.append('tag', tag.trim());
        }
    }

    return `/admin/cms/pages/og-preview?${searchParams.toString()}`;
}

function updateSectionData(
    sectionId: string,
    data: CmsPageSectionData,
    setSections: React.Dispatch<React.SetStateAction<CmsPageEditableSection[]>>,
) {
    setSections((current) =>
        current.map((currentSection) =>
            currentSection.id === sectionId
                ? {
                      ...currentSection,
                      data,
                  }
                : currentSection,
        ),
    );
}

export function CmsPageForm({
    page,
    template,
    formId,
    breadcrumbs,
    heading,
    action,
    autosaveAction,
    deleteAction,
}: CmsPageFormProps) {
    const [state, formAction, pending] = useActionState(action, null);
    const [isDeletePending, startDeleteTransition] = useTransition();
    const reactId = useId();
    const resolvedFormId = formId ?? reactId;
    const initialContentKind = normalizeFormContentKind(
        page?.contentKind ?? template?.contentKind,
    );
    const [contentKind, setContentKind] =
        useState<CmsPageContentKind>(initialContentKind);
    const initialTitle = page?.title ?? template?.title ?? '';
    const initialSlug = page?.slug ?? template?.slug ?? '';
    const storedCanonicalPath = page?.canonicalPath ?? '';
    const initialCanonicalPath =
        storedCanonicalPath.trim().length > 0
            ? storedCanonicalPath
            : canonicalPathFromSlug(initialSlug);
    const [title, setTitle] = useState(initialTitle);
    const [slug, setSlug] = useState(initialSlug);
    const [isCustomSlug, setIsCustomSlug] = useState(
        () =>
            initialSlug.length > 0 &&
            initialSlug !== automaticSlugForTitle(initialTitle, contentKind),
    );
    const [canonicalPath, setCanonicalPath] = useState(initialCanonicalPath);
    const [isCustomCanonicalPath, setIsCustomCanonicalPath] = useState(
        () =>
            storedCanonicalPath.trim().length > 0 &&
            storedCanonicalPath !== canonicalPathFromSlug(initialSlug),
    );
    const currentPageState = normalizeFormPageState(page?.state);
    const isPublished = currentPageState === 'published';
    const isInReview = currentPageState === 'in-review';
    const [publishedAt, setPublishedAt] = useState(() =>
        formatDateTimeLocalValue(page?.publishedAt ?? template?.publishedAt),
    );
    const publishButtonLabel = page ? 'Objavi' : 'Kreiraj i objavi';
    const reviewButtonLabel = page ? 'Označi za pregled' : 'Kreiraj za pregled';
    const newSectionIdPrefix = useMemo(
        () => `${reactId}-${page?.id ?? 'new'}`,
        [page?.id, reactId],
    );
    const parsedSections = useMemo(
        () => parseSections(page?.content ?? template?.content),
        [page?.content, template?.content],
    );
    const [pageRenderMode, setPageRenderMode] = useState<CmsPageRenderMode>(
        parsedSections.renderMode,
    );
    const [pageRenderMaxWidth, setPageRenderMaxWidth] =
        useState<CmsPageRenderMaxWidth>(parsedSections.renderMaxWidth);
    const nextSectionId = useRef(parsedSections.sections.length);
    const [sections, setSections] = useState<CmsPageEditableSection[]>(() =>
        editableSections(parsedSections.sections),
    );
    const preserveFallbackContent =
        !parsedSections.isStructured && Boolean(page?.content);
    const [rawMode, setRawMode] = useState(preserveFallbackContent);
    const [rawContent, setRawContent] = useState(
        page?.content ?? template?.content ?? '',
    );
    const [rawError, setRawError] = useState<string | null>(null);
    const storedMetaTitle = page?.metaTitle ?? template?.metaTitle ?? '';
    const initialMetaTitle =
        storedMetaTitle.trim().length > 0 ? storedMetaTitle : initialTitle;
    const [metaTitle, setMetaTitle] = useState(initialMetaTitle);
    const [isCustomMetaTitle, setIsCustomMetaTitle] = useState(
        () =>
            storedMetaTitle.trim().length > 0 &&
            storedMetaTitle !== initialTitle,
    );
    const [metaDescription, setMetaDescription] = useState(
        page?.metaDescription ?? template?.metaDescription ?? '',
    );
    const [metaImageUrl, setMetaImageUrl] = useState(
        page?.metaImageUrl ?? template?.metaImageUrl ?? '',
    );
    const [seoImageUrl, setSeoImageUrl] = useState(
        page?.seoImageUrl ?? template?.seoImageUrl ?? '',
    );
    const [category, setCategory] = useState(
        page?.category ?? template?.category ?? '',
    );
    const [tags, setTags] = useState(() => page?.tags ?? template?.tags ?? []);
    const generatedOgPreviewUrl = useMemo(
        () =>
            cmsPageOgPreviewUrl({
                contentKind,
                imageUrl: metaImageUrl,
                tags,
                title,
            }),
        [contentKind, metaImageUrl, tags, title],
    );
    const effectiveOgPreviewUrl = seoImageUrl.trim()
        ? seoImageUrl.trim()
        : generatedOgPreviewUrl;
    const builderContent = useMemo(
        () => stringifySections(sections, pageRenderMode, pageRenderMaxWidth),
        [pageRenderMaxWidth, pageRenderMode, sections],
    );
    const serializedContent = rawMode
        ? rawContent
        : preserveFallbackContent && sections.length === 0
          ? (page?.content ?? '')
          : builderContent;
    const formRef = useRef<HTMLFormElement>(null);
    const [formRevision, setFormRevision] = useState(0);
    const autosaveSnapshot = useMemo(
        () => JSON.stringify({ content: serializedContent, formRevision }),
        [serializedContent, formRevision],
    );
    const latestAutosaveSnapshot = useRef(autosaveSnapshot);
    const [autosaveStatus, setAutosaveStatus] = useState('saved');
    const [autosaveMessage, setAutosaveMessage] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(
        () => page?.updatedAt?.getTime() ?? null,
    );
    const [lastSavedSnapshot, setLastSavedSnapshot] =
        useState(autosaveSnapshot);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
        null,
    );
    const [insertAtEnd, setInsertAtEnd] = useState(false);
    const [sectionSearch, setSectionSearch] = useState('');
    const [previewViewport, setPreviewViewport] =
        useState<CmsPreviewViewport>('auto');
    const {
        containerRef: previewViewportContainerRef,
        supportedViewports: supportedPreviewViewports,
    } = useCmsPreviewViewportSupport(previewViewport, setPreviewViewport, {
        disabled: rawMode,
    });
    const [navigatorCollapsed, setNavigatorCollapsed] = useState(false);
    const [navigatorStorageLoaded, setNavigatorStorageLoaded] = useState(false);
    const rightPanelStorageKey = useMemo(
        () =>
            `${cmsPageRightPanelCollapsedStorageKeyPrefix}${page?.id ?? 'create'}`,
        [page?.id],
    );
    const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
    const [rightPanelStorageLoaded, setRightPanelStorageLoaded] =
        useState(false);
    const [publishChecksExpanded, setPublishChecksExpanded] = useState(true);
    const [sectionInfoItem, setSectionInfoItem] =
        useState<SectionInfoItem | null>(null);
    const previousPublishReady = useRef(false);
    const sensors = useSensors(useSensor(PointerSensor));
    const rawReadinessContent = useMemo(
        () => parseSections(rawContent),
        [rawContent],
    );
    const readinessSections = useMemo(() => {
        if (!rawMode) {
            return sections;
        }

        return rawReadinessContent.isStructured
            ? editableSections(rawReadinessContent.sections)
            : [];
    }, [rawMode, rawReadinessContent, sections]);
    const contentReadinessWarning =
        rawMode &&
        rawContent.trim().length > 0 &&
        !rawReadinessContent.isStructured
            ? 'JSON fallback mora biti JSON niz sekcija za provjeru obaveznih polja.'
            : null;

    useEffect(() => {
        const storedCollapsed = readStoredPanelCollapsedState(
            cmsPageNavigatorCollapsedStorageKey,
        );
        setNavigatorCollapsed(storedCollapsed ?? false);
        setNavigatorStorageLoaded(true);
    }, []);

    useEffect(() => {
        if (!navigatorStorageLoaded) {
            return;
        }

        writeStoredPanelCollapsedState(
            cmsPageNavigatorCollapsedStorageKey,
            navigatorCollapsed,
        );
    }, [navigatorCollapsed, navigatorStorageLoaded]);

    useEffect(() => {
        setRightPanelStorageLoaded(false);
        const storedCollapsed =
            readStoredPanelCollapsedState(rightPanelStorageKey);
        setRightPanelCollapsed(storedCollapsed ?? false);
        setRightPanelStorageLoaded(true);
    }, [rightPanelStorageKey]);

    useEffect(() => {
        if (!rightPanelStorageLoaded) {
            return;
        }

        writeStoredPanelCollapsedState(
            rightPanelStorageKey,
            rightPanelCollapsed,
        );
    }, [rightPanelCollapsed, rightPanelStorageKey, rightPanelStorageLoaded]);

    const selectSection = (sectionId: string) => {
        setInsertAtEnd(false);
        setSelectedSectionId(sectionId);
    };

    const selectAppendTarget = () => {
        setInsertAtEnd(true);
        setSelectedSectionId(null);
    };

    useEffect(() => {
        latestAutosaveSnapshot.current = autosaveSnapshot;
    }, [autosaveSnapshot]);

    useEffect(() => {
        if (!autosaveAction) {
            return;
        }

        if (autosaveSnapshot === lastSavedSnapshot) {
            setAutosaveStatus('saved');
            return;
        }

        setAutosaveStatus('unsaved');
        const timer = setTimeout(async () => {
            const form = formRef.current;
            if (!form) {
                return;
            }

            const snapshotToSave = autosaveSnapshot;
            setAutosaveStatus('saving');
            const formData = new FormData(form);
            formData.set('content', serializedContent);

            const result = await autosaveAction(formData);
            if (latestAutosaveSnapshot.current !== snapshotToSave) {
                return;
            }

            if (!result.success) {
                setAutosaveStatus('failed');
                setAutosaveMessage(result.message);
                return;
            }

            setAutosaveStatus('saved');
            setAutosaveMessage(result.message);
            setLastSavedSnapshot(snapshotToSave);
            setLastSavedAt(Date.now());
        }, 600);

        return () => clearTimeout(timer);
    }, [
        autosaveAction,
        autosaveSnapshot,
        serializedContent,
        lastSavedSnapshot,
    ]);

    useEffect(() => {
        if (sections.length === 0) {
            setSelectedSectionId(null);
            return;
        }

        if (insertAtEnd && selectedSectionId === null) {
            return;
        }

        if (
            selectedSectionId &&
            sections.some((section) => section.id === selectedSectionId)
        ) {
            return;
        }

        setInsertAtEnd(false);
        setSelectedSectionId(sections[0]?.id ?? null);
    }, [insertAtEnd, sections, selectedSectionId]);

    const selectedSection = sections.find(
        (section) => section.id === selectedSectionId,
    );
    const selectedSectionErrors = selectedSection
        ? sectionFieldErrors(selectedSection)
        : new Map<string, string>();
    const selectedSectionIndex = selectedSectionId
        ? sections.findIndex((section) => section.id === selectedSectionId)
        : -1;
    const insertionIndex =
        insertAtEnd || selectedSectionIndex < 0
            ? undefined
            : selectedSectionIndex + 1;
    const selectedSectionComponent = selectedSection
        ? cmsPageSectionComponentsByName.get(selectedSection.data.component)
        : undefined;
    const missingSectionFields = readinessSections
        .map((section, index) => ({
            section,
            index,
            errors: validateSection(section),
        }))
        .filter((entry) => entry.errors.length > 0);
    const titleReady = title.trim().length > 0;
    const slugReady = normalizeCmsPageSlugInput(slug).length > 0;
    const contentStructured = !contentReadinessWarning;
    const hasContentSections = readinessSections.length > 0;
    const sectionReadinessItems =
        missingSectionFields.length > 0
            ? missingSectionFields.map((entry) => ({
                  id: `section-${entry.section.id}`,
                  checked: false,
                  label: `Sekcija ${entry.index + 1} (${sectionLabel(
                      entry.section.data.component,
                  )}) ima popunjena obavezna polja.`,
              }))
            : hasContentSections
              ? [
                    {
                        id: 'sections',
                        checked: true,
                        label: 'Sve sekcije imaju popunjena obavezna polja.',
                    },
                ]
              : [];
    const publishReadinessItems = [
        {
            id: 'title',
            checked: titleReady,
            label: 'Naslov stranice je upisan.',
        },
        {
            id: 'slug',
            checked: slugReady,
            label: 'Slug stranice je upisan.',
        },
        {
            id: 'content-kind',
            checked: Boolean(contentKind),
            label: 'Vrsta sadržaja je odabrana.',
        },
        ...(contentKind === 'blog'
            ? [
                  {
                      id: 'category',
                      checked: category.trim().length > 0,
                      label: 'Kategorija blog objave je upisana.',
                  },
              ]
            : []),
        {
            id: 'content-structure',
            checked: contentStructured,
            label: 'Sadržaj je ispravno strukturiran.',
        },
        {
            id: 'content-sections',
            checked: hasContentSections,
            label: 'Dodana je barem jedna sekcija.',
        },
        ...sectionReadinessItems,
        {
            id: 'meta-title',
            checked: metaTitle.trim().length > 0,
            label: 'Meta naslov je upisan.',
        },
        {
            id: 'meta-description',
            checked: metaDescription.trim().length > 0,
            label: 'Meta opis je upisan.',
        },
        {
            id: 'meta-description-length',
            checked: metaDescription.length <= 160,
            label: 'Meta opis ima najviše 160 znakova.',
        },
    ];
    const checkedReadinessCount = publishReadinessItems.filter(
        (item) => item.checked,
    ).length;
    const publishReadinessTotal = publishReadinessItems.length;
    const publishReady = checkedReadinessCount === publishReadinessTotal;
    const showPublishChecks = !publishReady || publishChecksExpanded;
    useEffect(() => {
        if (publishReady && !previousPublishReady.current) {
            setPublishChecksExpanded(false);
        }

        if (!publishReady && previousPublishReady.current) {
            setPublishChecksExpanded(true);
        }

        previousPublishReady.current = publishReady;
    }, [publishReady]);
    const previewViewportClassName =
        cmsPagePreviewViewportClassNames[previewViewport];
    const slugHelperText = isCustomSlug
        ? 'Prilagođeni slug. Sprema se normalizirano i ne smije zauzeti postojeću statičku rutu.'
        : 'Automatski se generira iz naslova. Sprema se normalizirano i ne smije zauzeti postojeću statičku rutu.';
    const canonicalPathHelperText = isCustomCanonicalPath
        ? 'Prilagođena canonical putanja.'
        : 'Automatski se popunjava iz sluga.';
    const metaTitleHelperText = isCustomMetaTitle
        ? 'Prilagođeni meta naslov.'
        : 'Automatski se popunjava iz naslova stranice.';
    const formattedLastSavedAt = formatLastSavedAt(lastSavedAt);
    const canDeletePage = Boolean(page && deleteAction && !isPublished);

    const handleDeletePage = () => {
        if (!deleteAction) {
            return;
        }

        startDeleteTransition(async () => {
            setDeleteError(null);
            try {
                await deleteAction();
            } catch (error) {
                setDeleteError(
                    error instanceof Error
                        ? error.message
                        : 'Brisanje stranice nije uspjelo.',
                );
            }
        });
    };

    const insertSectionData = (data: CmsPageSectionData, index?: number) => {
        const sectionId = nextSectionId.current;
        nextSectionId.current += 1;
        const id = `${newSectionIdPrefix}-${sectionId}`;
        setSections((current) => {
            const entry = { id, data: structuredClone(data) };
            if (typeof index === 'number') {
                const safeIndex = Math.max(0, Math.min(index, current.length));
                return [
                    ...current.slice(0, safeIndex),
                    entry,
                    ...current.slice(safeIndex),
                ];
            }

            return [...current, entry];
        });
        setInsertAtEnd(false);
        setSelectedSectionId(id);
    };

    const insertSection = (component: string, index?: number) => {
        insertSectionData({ component }, index);
    };

    const insertPreset = (preset: CmsPageSectionPreset, index?: number) => {
        insertSectionData(preset.data, index);
    };

    const pageDetailsPanel = (
        <PanelSection title="Stranica" contentClassName="px-4 pt-1">
            <Stack spacing={4}>
                <input
                    name="state"
                    type="hidden"
                    value={currentPageState}
                    readOnly
                />
                <SelectItems<CmsPageContentKind>
                    name="contentKind"
                    label="Vrsta sadržaja"
                    value={contentKind}
                    items={[
                        {
                            value: 'page',
                            label: 'Stranica',
                        },
                        {
                            value: 'blog',
                            label: 'Blog objava',
                        },
                        {
                            value: 'changelog',
                            label: 'Changelog zapis',
                        },
                    ]}
                    onValueChange={(nextContentKind) => {
                        setContentKind(nextContentKind);
                        if (!isCustomSlug) {
                            const nextSlug = automaticSlugForTitle(
                                title,
                                nextContentKind,
                            );
                            setSlug(nextSlug);
                            if (!isCustomCanonicalPath) {
                                setCanonicalPath(
                                    canonicalPathFromSlug(nextSlug),
                                );
                            }
                        }
                    }}
                />
                <Input
                    name="title"
                    label="Naslov"
                    value={title}
                    fullWidth
                    onChange={(event) => {
                        const nextTitle = event.target.value;
                        setTitle(nextTitle);
                        if (!isCustomSlug) {
                            const nextSlug = automaticSlugForTitle(
                                nextTitle,
                                contentKind,
                            );
                            setSlug(nextSlug);
                            if (!isCustomCanonicalPath) {
                                setCanonicalPath(
                                    canonicalPathFromSlug(nextSlug),
                                );
                            }
                        }
                        if (!isCustomMetaTitle) {
                            setMetaTitle(nextTitle);
                        }
                    }}
                    required
                />
                <Input
                    name="slug"
                    label="Slug"
                    value={slug}
                    fullWidth
                    placeholder="npr. sezonski-vodic"
                    helperText={slugHelperText}
                    endDecorator={
                        isCustomSlug ? (
                            <span className="mr-1 flex items-center gap-1">
                                <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                                    Prilagođeno
                                </span>
                                <IconButton
                                    aria-label="Vrati automatski slug"
                                    className="size-7 text-muted-foreground"
                                    size="xs"
                                    title="Vrati automatski slug"
                                    type="button"
                                    variant="plain"
                                    onClick={() => {
                                        const nextSlug = automaticSlugForTitle(
                                            title,
                                            contentKind,
                                        );
                                        setIsCustomSlug(false);
                                        setSlug(nextSlug);
                                        if (!isCustomCanonicalPath) {
                                            setCanonicalPath(
                                                canonicalPathFromSlug(nextSlug),
                                            );
                                        }
                                    }}
                                >
                                    <Close className="size-3.5" />
                                </IconButton>
                            </span>
                        ) : undefined
                    }
                    onChange={(event) => {
                        const nextSlug = event.target.value;
                        setIsCustomSlug(true);
                        setSlug(nextSlug);
                        if (!isCustomCanonicalPath) {
                            setCanonicalPath(canonicalPathFromSlug(nextSlug));
                        }
                    }}
                    required
                />
                <Stack spacing={1}>
                    <Typography level="body3" semiBold>
                        Prikaz stranice
                    </Typography>
                    <Row spacing={2} className="flex-wrap">
                        <PageRenderModeButtonGroup
                            value={pageRenderMode}
                            onChange={setPageRenderMode}
                        />
                        {pageRenderMode === 'container' && (
                            <RenderMaxWidthButtonGroup
                                legend="Maksimalna širina stranice"
                                value={pageRenderMaxWidth}
                                onChange={setPageRenderMaxWidth}
                            />
                        )}
                    </Row>
                </Stack>
                <Input
                    name="category"
                    label="Kategorija"
                    value={category}
                    fullWidth
                    helperText={
                        contentKind === 'blog'
                            ? 'Obavezno za Blog objave. Koristi se za filtriranje.'
                            : 'Opcionalno. Najčešće se koristi za Blog objave.'
                    }
                    onChange={(event) => setCategory(event.target.value)}
                    required={contentKind === 'blog'}
                />
                <CmsPageTagsInput
                    name="tags"
                    label="Tagovi"
                    value={tags}
                    helperText="Upiši tag i pritisni Enter, Tab ili zarez za dodavanje."
                    placeholder="npr. Vrt, Biljke"
                    onChange={(nextTags) => {
                        setTags(nextTags);
                        setFormRevision((current) => current + 1);
                    }}
                />
                <Input
                    name="publishedAt"
                    label="Datum objave"
                    type="datetime-local"
                    value={publishedAt}
                    fullWidth
                    helperText="Određuje javni datum i poredak novosti. Ako ostane prazno, objava dobiva trenutno vrijeme pri objavi."
                    onChange={(event) => setPublishedAt(event.target.value)}
                />
                <CmsPageCoverImageField
                    name="metaImageUrl"
                    pageId={page?.id}
                    value={metaImageUrl}
                    onChange={(nextMetaImageUrl) => {
                        setMetaImageUrl(nextMetaImageUrl);
                        setFormRevision((current) => current + 1);
                    }}
                />
                {autosaveAction && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-3">
                            <Typography level="body3" secondary>
                                Zadnje spremanje
                            </Typography>
                            <Typography
                                level="body3"
                                className={
                                    autosaveStatus === 'failed'
                                        ? 'text-right text-red-600'
                                        : 'text-right'
                                }
                                secondary={autosaveStatus !== 'failed'}
                                semiBold={autosaveStatus !== 'saved'}
                            >
                                {autosaveStatus === 'failed'
                                    ? 'Spremanje nije uspjelo.'
                                    : autosaveStatus === 'unsaved'
                                      ? 'Nespremljene promjene'
                                      : autosaveStatus === 'saving'
                                        ? 'Spremanje u tijeku...'
                                        : (formattedLastSavedAt ??
                                          'Nije dostupno')}
                            </Typography>
                        </div>
                        {autosaveStatus === 'failed' && autosaveMessage ? (
                            <Typography
                                level="body3"
                                className="text-right text-red-600"
                            >
                                {autosaveMessage}
                            </Typography>
                        ) : null}
                    </div>
                )}
            </Stack>
        </PanelSection>
    );

    const sectionLibraryPanel = (
        <PanelSection title="Biblioteka" contentClassName="px-3 pt-1">
            <CmsPageSectionLibrary
                query={sectionSearch}
                components={cmsPageSectionComponents}
                componentsRegistry={sectionsComponentRegistry}
                presets={cmsPageSectionPresets}
                searchLabel="Pretraga"
                onQueryChange={setSectionSearch}
                onInsertComponent={(component) =>
                    insertSection(component, insertionIndex)
                }
                onInsertPreset={(preset) =>
                    insertPreset(preset, insertionIndex)
                }
            />
        </PanelSection>
    );

    const seoPanel = (
        <PanelSection title="SEO" contentClassName="px-4 pt-1">
            <Stack spacing={4}>
                <Input
                    name="metaTitle"
                    label="Meta naslov"
                    value={metaTitle}
                    helperText={metaTitleHelperText}
                    endDecorator={
                        isCustomMetaTitle ? (
                            <span className="mr-1 flex items-center gap-1">
                                <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
                                    Prilagođeno
                                </span>
                                <IconButton
                                    aria-label="Vrati automatski meta naslov"
                                    className="size-7 text-muted-foreground"
                                    size="xs"
                                    title="Vrati automatski meta naslov"
                                    type="button"
                                    variant="plain"
                                    onClick={() => {
                                        setIsCustomMetaTitle(false);
                                        setMetaTitle(title);
                                    }}
                                >
                                    <Close className="size-3.5" />
                                </IconButton>
                            </span>
                        ) : undefined
                    }
                    onChange={(event) => {
                        setIsCustomMetaTitle(true);
                        setMetaTitle(event.target.value);
                    }}
                />
                <Input
                    name="metaDescription"
                    label="Meta opis"
                    value={metaDescription}
                    maxLength={160}
                    helperText={`${metaDescription.length}/160 znakova`}
                    onChange={(event) => setMetaDescription(event.target.value)}
                />
                <Stack spacing={2}>
                    <div className="space-y-1">
                        <Typography level="body3" semiBold>
                            OG pregled
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            {seoImageUrl.trim()
                                ? 'Koristi se prilagođena SEO slika.'
                                : 'Koristi se generirana OG slika s naslovom, tagovima, logotipom i naslovnom slikom ako postoji.'}
                        </Typography>
                    </div>
                    <div className="overflow-hidden rounded-md border bg-muted">
                        {/** biome-ignore lint/performance/noImgElement: Admin preview renders generated and arbitrary SEO image URLs. */}
                        <img
                            alt="OG pregled CMS stranice"
                            className="aspect-[1200/630] w-full object-cover"
                            src={effectiveOgPreviewUrl}
                        />
                    </div>
                </Stack>
                <CmsPageCoverImageField
                    name="seoImageUrl"
                    pageId={page?.id}
                    value={seoImageUrl}
                    label="SEO slika"
                    modalTitle="SEO slika"
                    usage="seo"
                    emptyLabel="Nema prilagođene SEO slike."
                    uploadEmptyLabel="Odaberite jednu sliku za SEO override."
                    description="Opcionalno. Ako je postavljena, koristi se umjesto generirane OG slike za društvene mreže."
                    onChange={(nextSeoImageUrl) => {
                        setSeoImageUrl(nextSeoImageUrl);
                        setFormRevision((current) => current + 1);
                    }}
                />
                <Input
                    name="canonicalPath"
                    label="Canonical putanja"
                    value={canonicalPath}
                    helperText={canonicalPathHelperText}
                    placeholder="/primjer-stranice"
                    onChange={(event) => {
                        setIsCustomCanonicalPath(true);
                        setCanonicalPath(event.target.value);
                    }}
                />
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        name="noIndex"
                        defaultChecked={page?.noIndex ?? false}
                    />
                    Isključi iz indeksiranja (noindex)
                </label>
                <div className="rounded-md border bg-muted/20 p-3">
                    <Typography level="body3" semiBold>
                        {metaTitle || title || 'Meta naslov'}
                    </Typography>
                    <Typography
                        level="body3"
                        className="line-clamp-3"
                        secondary
                    >
                        {metaDescription ||
                            'Meta opis za javni prikaz stranice.'}
                    </Typography>
                </div>
            </Stack>
        </PanelSection>
    );

    const publishReadinessPanel = (
        <PanelSection
            title="Spremnost za objavu"
            action={
                <div className="flex items-center gap-2 pr-1 text-xs font-medium text-muted-foreground">
                    <Checkbox
                        aria-label={
                            publishReady
                                ? 'Stranica je spremna za objavu'
                                : 'Stranica nije spremna za objavu'
                        }
                        checked={publishReady}
                        className="pointer-events-none"
                        readOnly
                        tabIndex={-1}
                        variant="circle"
                    />
                    <span>
                        {checkedReadinessCount}/{publishReadinessTotal}
                    </span>
                </div>
            }
            contentClassName="px-4 pt-1"
        >
            <Stack spacing={3}>
                {publishReady && (
                    <Button
                        type="button"
                        variant="plain"
                        size="xs"
                        className="h-auto justify-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                        onClick={() =>
                            setPublishChecksExpanded((current) => !current)
                        }
                    >
                        {showPublishChecks
                            ? 'Sakrij provjere'
                            : 'Prikaži provjere'}
                    </Button>
                )}
                {showPublishChecks && (
                    <Stack spacing={2}>
                        {publishReadinessItems.map((item) => (
                            <Checkbox
                                key={item.id}
                                checked={item.checked}
                                label={item.label}
                                readOnly
                                variant="circle"
                            />
                        ))}
                    </Stack>
                )}
                {!isPublished && !isInReview ? (
                    <Button
                        type="submit"
                        name="publishState"
                        value="in-review"
                        variant="outlined"
                        fullWidth
                        disabled={!publishReady}
                        loading={pending}
                        startDecorator={<Megaphone className="size-4" />}
                    >
                        {reviewButtonLabel}
                    </Button>
                ) : null}
                {!isPublished ? (
                    <Button
                        type="submit"
                        name="publishState"
                        value="published"
                        variant="solid"
                        fullWidth
                        disabled={!publishReady}
                        loading={pending}
                        startDecorator={<Megaphone className="size-4" />}
                    >
                        {publishButtonLabel}
                    </Button>
                ) : null}
                {isPublished || isInReview ? (
                    <Button
                        type="submit"
                        name="publishState"
                        value="draft"
                        variant="outlined"
                        fullWidth
                        loading={pending}
                    >
                        Vrati u izradu
                    </Button>
                ) : null}
                {!isPublished && !publishReady ? (
                    <Typography level="body3" secondary>
                        Dovrši sve provjere prije označavanja za pregled ili
                        objave.
                    </Typography>
                ) : null}
            </Stack>
        </PanelSection>
    );

    const deletePanel =
        page && deleteAction ? (
            <PanelSection title="Brisanje" contentClassName="px-4 pt-1">
                <Stack spacing={3}>
                    <Typography level="body3" secondary>
                        {isPublished
                            ? 'Vrati stranicu u izradu prije brisanja.'
                            : 'Brisanjem se stranica uklanja iz aktivnog CMS popisa.'}
                    </Typography>
                    {deleteError ? (
                        <Typography level="body3" className="text-red-600">
                            {deleteError}
                        </Typography>
                    ) : null}
                    {canDeletePage ? (
                        <ModalConfirm
                            title="Potvrda brisanja CMS stranice"
                            header="Brisanje stranice"
                            confirmLabel="Obriši"
                            onConfirm={handleDeletePage}
                            trigger={
                                <Button
                                    type="button"
                                    variant="outlined"
                                    color="danger"
                                    fullWidth
                                    loading={isDeletePending}
                                    startDecorator={
                                        <Delete className="size-4" />
                                    }
                                >
                                    Obriši stranicu
                                </Button>
                            }
                        >
                            <Typography>
                                Jeste li sigurni da želite obrisati stranicu{' '}
                                <strong>{page.title}</strong>? Ova akcija se ne
                                može poništiti iz CMS sučelja.
                            </Typography>
                        </ModalConfirm>
                    ) : (
                        <Button
                            type="button"
                            variant="outlined"
                            color="danger"
                            fullWidth
                            disabled
                            startDecorator={<Delete className="size-4" />}
                        >
                            Obriši stranicu
                        </Button>
                    )}
                </Stack>
            </PanelSection>
        ) : null;

    const editorModeControls = (
        <ButtonGroup legend="Editor mode" size="sm">
            <Button
                type="button"
                variant={!rawMode ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={!rawMode}
                aria-label="Vizualni editor"
                title="Vizualni editor"
                onClick={() => {
                    if (!rawMode) {
                        return;
                    }

                    const parsed = parseSections(rawContent);
                    if (parsed.isStructured) {
                        setSections(editableSections(parsed.sections));
                        setPageRenderMode(parsed.renderMode);
                        setPageRenderMaxWidth(parsed.renderMaxWidth);
                    }
                    setRawMode(false);
                }}
            >
                <LayoutGrid className="size-4" />
            </Button>
            <Button
                type="button"
                variant={rawMode ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={rawMode}
                aria-label="JSON fallback"
                title="JSON fallback"
                onClick={() => {
                    if (rawMode) {
                        return;
                    }
                    setRawMode(true);
                    setRawError(null);
                    setRawContent(builderContent);
                }}
            >
                <Code className="size-4" />
            </Button>
        </ButtonGroup>
    );

    const previewViewportControls = (
        <ButtonGroup legend="Preview viewport" size="sm">
            <Button
                type="button"
                variant={previewViewport === 'auto' ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={previewViewport === 'auto'}
                aria-label="Auto preview"
                title="Auto preview"
                disabled={rawMode}
                onClick={() => setPreviewViewport('auto')}
            >
                <Auto className="size-4" />
            </Button>
            <Button
                type="button"
                variant={previewViewport === 'mobile' ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={previewViewport === 'mobile'}
                aria-label="Mobile preview"
                title="Mobile preview"
                disabled={rawMode}
                onClick={() => setPreviewViewport('mobile')}
            >
                <Mobile className="size-4" />
            </Button>
            <Button
                type="button"
                variant={previewViewport === 'tablet' ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={previewViewport === 'tablet'}
                aria-label="Tablet preview"
                title="Tablet preview"
                disabled={rawMode || !supportedPreviewViewports.tablet}
                onClick={() => setPreviewViewport('tablet')}
            >
                <Tablet className="size-4" />
            </Button>
            <Button
                type="button"
                variant={previewViewport === 'desktop' ? 'solid' : 'plain'}
                size="sm"
                className={buttonGroupItemClassName({ iconOnly: true })}
                aria-pressed={previewViewport === 'desktop'}
                aria-label="Desktop preview"
                title="Desktop preview"
                disabled={rawMode || !supportedPreviewViewports.desktop}
                onClick={() => setPreviewViewport('desktop')}
            >
                <Desktop className="size-4" />
            </Button>
        </ButtonGroup>
    );

    const headerActions = (
        <Row spacing={2} className="flex-wrap justify-end">
            {editorModeControls}
            {previewViewportControls}
            {page ? (
                <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-8 min-w-0 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        <ExternalLink className="size-4" />
                        Preview
                        <Down className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem
                            href={KnownPages.CmsPagePreview(page.id)}
                            rel="noreferrer"
                            target="_blank"
                            startDecorator={<ExternalLink className="size-4" />}
                        >
                            Admin preview
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            href={KnownPages.CmsPageWwwPreview(page.id)}
                            rel="noreferrer"
                            target="_blank"
                            startDecorator={<Globe className="size-4" />}
                        >
                            WWW preview
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null}
            {!autosaveAction && (
                <Button
                    variant="solid"
                    size="sm"
                    type="submit"
                    form={resolvedFormId}
                    loading={pending}
                    startDecorator={<Add className="size-4" />}
                >
                    Kreiraj
                </Button>
            )}
            {!rawMode && (
                <SidePanelToggleButton
                    label="sadržaj"
                    onOpenChange={(open) => setNavigatorCollapsed(!open)}
                    open={!navigatorCollapsed}
                    side="left"
                />
            )}
            <SidePanelToggleButton
                label="panele"
                onOpenChange={(open) => setRightPanelCollapsed(!open)}
                open={!rightPanelCollapsed}
                side="right"
            />
        </Row>
    );

    const navigatorPanel = (
        <Stack spacing={2}>
            <Typography level="body3" className="px-1" semiBold>
                Sadržaj
            </Typography>
            <Stack spacing={1}>
                {sections.length === 0 ? (
                    <Typography level="body3" secondary>
                        Nema sekcija.
                    </Typography>
                ) : (
                    sections.map((section, index) => (
                        <Button
                            key={`navigator-${section.id}`}
                            type="button"
                            variant={
                                selectedSectionId === section.id
                                    ? 'solid'
                                    : 'plain'
                            }
                            size="sm"
                            className="justify-start px-2"
                            onClick={() => selectSection(section.id)}
                        >
                            {index + 1}. {sectionLabel(section.data.component)}
                        </Button>
                    ))
                )}
            </Stack>
        </Stack>
    );

    const duplicateSection = (section: CmsPageEditableSection) => {
        setSections((current) => {
            const index = current.findIndex(
                (candidate) => candidate.id === section.id,
            );
            if (index < 0) {
                return current;
            }

            const sectionId = nextSectionId.current;
            nextSectionId.current += 1;
            const duplicate = copySection(
                section,
                `${newSectionIdPrefix}-${sectionId}`,
            );
            setSelectedSectionId(duplicate.id);
            return [
                ...current.slice(0, index + 1),
                duplicate,
                ...current.slice(index + 1),
            ];
        });
    };

    const removeSection = (sectionId: string) => {
        setSections((current) =>
            current.filter((section) => section.id !== sectionId),
        );
    };

    const handleSectionDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) {
            return;
        }

        setSections((current) => {
            const oldIndex = current.findIndex(
                (section) => section.id === active.id,
            );
            const newIndex = current.findIndex(
                (section) => section.id === over.id,
            );

            if (oldIndex < 0 || newIndex < 0) {
                return current;
            }

            return arrayMove(current, oldIndex, newIndex);
        });
        setInsertAtEnd(false);
        setSelectedSectionId(String(active.id));
    };

    const selectedSectionRenderSettings = selectedSection ? (
        <Stack spacing={3}>
            <Stack spacing={1}>
                <Typography level="body3" semiBold>
                    Prikaz sekcije
                </Typography>
                <Row spacing={2} className="flex-wrap">
                    <SectionRenderModeButtonGroup
                        value={sectionRenderMode(selectedSection)}
                        onChange={(value) => {
                            const nextData: CmsPageSectionData = {
                                ...selectedSection.data,
                            };
                            if (value === 'inherit') {
                                delete nextData.renderMode;
                            } else {
                                nextData.renderMode = value;
                            }

                            if (value === 'container') {
                                nextData.renderMaxWidth =
                                    selectedSection.data.renderMaxWidth ??
                                    pageRenderMaxWidth;
                            } else {
                                delete nextData.renderMaxWidth;
                            }

                            updateSectionData(
                                selectedSection.id,
                                nextData,
                                setSections,
                            );
                        }}
                    />
                    {sectionRenderMode(selectedSection) === 'container' && (
                        <RenderMaxWidthButtonGroup
                            legend="Maksimalna širina sekcije"
                            value={sectionRenderMaxWidth(selectedSection)}
                            onChange={(value) => {
                                updateSectionData(
                                    selectedSection.id,
                                    {
                                        ...selectedSection.data,
                                        renderMode: 'container',
                                        renderMaxWidth: value,
                                    },
                                    setSections,
                                );
                            }}
                        />
                    )}
                </Row>
                <Typography level="body3" secondary>
                    Auto nasljeđuje prikaz stranice.
                </Typography>
            </Stack>
        </Stack>
    ) : null;

    const selectedSectionActions = selectedSection ? (
        <Row spacing={0}>
            <Button
                type="button"
                variant="plain"
                size="sm"
                className="size-7 px-0"
                disabled={selectedSectionIndex === 0}
                aria-label="Pomakni sekciju gore"
                title="Pomakni sekciju gore"
                onClick={() =>
                    setSections((current) =>
                        moveSection(current, selectedSection.id, -1),
                    )
                }
            >
                <ArrowUp className="size-4" />
            </Button>
            <Button
                type="button"
                variant="plain"
                size="sm"
                className="size-7 px-0"
                disabled={selectedSectionIndex === sections.length - 1}
                aria-label="Pomakni sekciju dolje"
                title="Pomakni sekciju dolje"
                onClick={() =>
                    setSections((current) =>
                        moveSection(current, selectedSection.id, 1),
                    )
                }
            >
                <ArrowDown className="size-4" />
            </Button>
            <Button
                type="button"
                variant="plain"
                size="sm"
                className="size-7 px-0"
                aria-label="Dupliciraj sekciju"
                title="Dupliciraj sekciju"
                onClick={() => duplicateSection(selectedSection)}
            >
                <Duplicate className="size-4" />
            </Button>
            <Button
                type="button"
                variant="plain"
                color="danger"
                size="sm"
                className="size-7 px-0"
                aria-label="Ukloni sekciju"
                title="Ukloni sekciju"
                onClick={() => removeSection(selectedSection.id)}
            >
                <Delete className="size-4" />
            </Button>
        </Row>
    ) : undefined;
    const selectedSectionPanelFields =
        selectedSection?.data.component === 'MarkdownBlock'
            ? (selectedSectionComponent?.fields ?? []).filter(
                  (field) => !isMarkdownBlockField(field),
              )
            : (selectedSectionComponent?.fields ?? []);

    return (
        <>
            <DesktopNavCollapseOnMount />
            <AdminPageHeader
                breadcrumbs={breadcrumbs}
                actions={headerActions}
                heading={heading}
            />
            <form
                id={resolvedFormId}
                ref={formRef}
                action={formAction}
                onChange={() => setFormRevision((current) => current + 1)}
                onSubmit={(event) => {
                    if (!rawMode) {
                        return;
                    }

                    try {
                        setRawContent(formatJsonContent(rawContent));
                        setRawError(null);
                    } catch {
                        event.preventDefault();
                        setRawError(
                            'JSON nije valjan. Ispravi sadržaj prije spremanja.',
                        );
                    }
                }}
            >
                <Stack spacing={6}>
                    <Stack spacing={4}>
                        {preserveFallbackContent && (
                            <Card className="p-3 text-sm text-amber-700">
                                Postojeći sadržaj nije moguće prikazati u
                                vizualnom editoru bez gubitka podataka.
                            </Card>
                        )}

                        <input
                            name="content"
                            type="hidden"
                            value={serializedContent}
                            readOnly
                        />

                        {rawMode ? (
                            <SidePanelLayout
                                preserveClosedPanels
                                rightOpen={!rightPanelCollapsed}
                                rightPanel={
                                    <Stack spacing={3}>
                                        {pageDetailsPanel}
                                        {seoPanel}
                                        {publishReadinessPanel}
                                        {deletePanel}
                                    </Stack>
                                }
                            >
                                <Card className="p-4">
                                    <Stack spacing={4}>
                                        <label className="space-y-1">
                                            <span className="block text-sm font-medium">
                                                JSON sadržaj
                                            </span>
                                            <textarea
                                                value={rawContent}
                                                rows={18}
                                                className="block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-hidden transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                onBlur={() => {
                                                    try {
                                                        setRawContent(
                                                            formatJsonContent(
                                                                rawContent,
                                                            ),
                                                        );
                                                        setRawError(null);
                                                    } catch {
                                                        setRawError(
                                                            'JSON nije valjan. Ispravi sadržaj prije spremanja.',
                                                        );
                                                    }
                                                }}
                                                onChange={(event) => {
                                                    setRawContent(
                                                        event.target.value,
                                                    );
                                                    setRawError(null);
                                                }}
                                            />
                                            {rawError && (
                                                <Typography
                                                    level="body2"
                                                    className="text-red-600"
                                                >
                                                    {rawError}
                                                </Typography>
                                            )}
                                            {preserveFallbackContent && (
                                                <Button
                                                    type="button"
                                                    variant="plain"
                                                    onClick={() => {
                                                        setRawContent(
                                                            page?.content ?? '',
                                                        );
                                                        setRawError(null);
                                                    }}
                                                >
                                                    Vrati spremljeni sadržaj
                                                </Button>
                                            )}
                                        </label>
                                    </Stack>
                                </Card>
                            </SidePanelLayout>
                        ) : (
                            <SidePanelLayout
                                leftOpen={!navigatorCollapsed}
                                leftPanel={navigatorPanel}
                                preserveClosedPanels
                                rightOpen={!rightPanelCollapsed}
                                rightPanel={
                                    <Stack spacing={3}>
                                        {insertAtEnd &&
                                            !selectedSection &&
                                            sectionLibraryPanel}
                                        {pageDetailsPanel}
                                        {selectedSection && (
                                            <PanelSection
                                                title="Sekcija"
                                                action={selectedSectionActions}
                                                contentClassName="px-4 pt-1"
                                            >
                                                <Stack spacing={4}>
                                                    <Row
                                                        spacing={2}
                                                        className="items-start justify-between"
                                                    >
                                                        <Stack
                                                            spacing={0.5}
                                                            className="min-w-0"
                                                        >
                                                            <Typography
                                                                level="body2"
                                                                semiBold
                                                            >
                                                                {selectedSectionComponent?.label ??
                                                                    selectedSection
                                                                        .data
                                                                        .component}
                                                            </Typography>
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                {selectedSectionComponent?.description ??
                                                                    sectionSummary(
                                                                        selectedSection,
                                                                    )}
                                                            </Typography>
                                                        </Stack>
                                                        <IconButton
                                                            aria-label="Informacije o sekciji"
                                                            className="size-7 shrink-0 text-muted-foreground"
                                                            disabled={
                                                                !selectedSectionComponent
                                                            }
                                                            size="xs"
                                                            title="Informacije o sekciji"
                                                            type="button"
                                                            variant="plain"
                                                            onClick={() => {
                                                                if (
                                                                    !selectedSectionComponent
                                                                ) {
                                                                    return;
                                                                }

                                                                setSectionInfoItem(
                                                                    {
                                                                        id: selectedSectionComponent.component,
                                                                        label: selectedSectionComponent.label,
                                                                        description:
                                                                            selectedSectionComponent.description,
                                                                        category:
                                                                            selectedSectionComponent.category,
                                                                        component:
                                                                            selectedSectionComponent,
                                                                        section:
                                                                            componentPreviewSectionData(
                                                                                selectedSectionComponent,
                                                                                cmsPageSectionPresetDataByComponent,
                                                                            ),
                                                                    },
                                                                );
                                                            }}
                                                        >
                                                            <Info className="size-4" />
                                                        </IconButton>
                                                    </Row>
                                                    {
                                                        selectedSectionRenderSettings
                                                    }
                                                    <CmsPageSectionFields
                                                        section={
                                                            selectedSection
                                                        }
                                                        fields={
                                                            selectedSectionPanelFields
                                                        }
                                                        fieldErrors={
                                                            selectedSectionErrors
                                                        }
                                                        onChange={(
                                                            sectionId,
                                                            data,
                                                        ) =>
                                                            updateSectionData(
                                                                sectionId,
                                                                data,
                                                                setSections,
                                                            )
                                                        }
                                                    />
                                                </Stack>
                                            </PanelSection>
                                        )}

                                        {seoPanel}
                                        {publishReadinessPanel}
                                        {deletePanel}
                                    </Stack>
                                }
                            >
                                <div
                                    ref={previewViewportContainerRef}
                                    className="min-w-0"
                                >
                                    <Stack spacing={4} className="min-w-0">
                                        <div
                                            className={`mx-auto w-full ${previewViewportClassName}`}
                                        >
                                            {sections.length === 0 ? (
                                                <div className="min-h-96 rounded-lg border border-dashed bg-muted/20 p-8 text-center">
                                                    <Typography
                                                        level="body2"
                                                        secondary
                                                    >
                                                        Stranica još nema
                                                        sekcija.
                                                    </Typography>
                                                </div>
                                            ) : (
                                                <DndContext
                                                    id={`cms-page-sections-${page?.id ?? 'new'}`}
                                                    sensors={sensors}
                                                    collisionDetection={
                                                        closestCenter
                                                    }
                                                    onDragEnd={
                                                        handleSectionDragEnd
                                                    }
                                                >
                                                    <SortableContext
                                                        items={sections.map(
                                                            (section) =>
                                                                section.id,
                                                        )}
                                                        strategy={
                                                            verticalListSortingStrategy
                                                        }
                                                    >
                                                        <Stack spacing={4}>
                                                            {sections.map(
                                                                (section) => {
                                                                    const isSelectedMarkdownSection =
                                                                        section.id ===
                                                                            selectedSectionId &&
                                                                        section
                                                                            .data
                                                                            .component ===
                                                                            'MarkdownBlock';
                                                                    const sectionComponent =
                                                                        cmsPageSectionComponentsByName.get(
                                                                            section
                                                                                .data
                                                                                .component,
                                                                        );
                                                                    const markdownField =
                                                                        sectionComponent?.fields.find(
                                                                            isMarkdownBlockField,
                                                                        );
                                                                    const previewSectionRenderMode =
                                                                        sectionRenderMode(
                                                                            section,
                                                                        );
                                                                    const resolvedSectionRenderMode =
                                                                        previewSectionRenderMode ===
                                                                        'inherit'
                                                                            ? pageRenderMode
                                                                            : previewSectionRenderMode;
                                                                    const resolvedSectionRenderMaxWidth =
                                                                        previewSectionRenderMode ===
                                                                        'container'
                                                                            ? sectionRenderMaxWidth(
                                                                                  section,
                                                                              )
                                                                            : pageRenderMaxWidth;
                                                                    const constrainInlineMarkdownEditor =
                                                                        previewViewport !==
                                                                        'desktop';
                                                                    const inlineMarkdownEditor =
                                                                        isSelectedMarkdownSection &&
                                                                        markdownField ? (
                                                                            <CmsPageMarkdownEditor
                                                                                variant="inline"
                                                                                value={sectionValue(
                                                                                    section,
                                                                                    markdownField.key,
                                                                                )}
                                                                                placeholder={
                                                                                    markdownField.placeholder
                                                                                }
                                                                                error={sectionFieldErrors(
                                                                                    section,
                                                                                ).get(
                                                                                    markdownField.key,
                                                                                )}
                                                                                onChange={(
                                                                                    value,
                                                                                ) =>
                                                                                    updateSectionData(
                                                                                        section.id,
                                                                                        {
                                                                                            ...section.data,
                                                                                            [markdownField.key]:
                                                                                                value,
                                                                                        },
                                                                                        setSections,
                                                                                    )
                                                                                }
                                                                            />
                                                                        ) : null;
                                                                    const customRenderIndicator =
                                                                        sectionRenderCustomIndicator(
                                                                            section,
                                                                        );

                                                                    return (
                                                                        <CmsPageSortablePreviewSection
                                                                            key={
                                                                                section.id
                                                                            }
                                                                            id={
                                                                                section.id
                                                                            }
                                                                            selected={
                                                                                section.id ===
                                                                                selectedSectionId
                                                                            }
                                                                            badge={
                                                                                customRenderIndicator ? (
                                                                                    <span
                                                                                        className="inline-flex items-center gap-1"
                                                                                        title={
                                                                                            customRenderIndicator.label
                                                                                        }
                                                                                    >
                                                                                        <span className="sr-only">
                                                                                            {
                                                                                                customRenderIndicator.label
                                                                                            }
                                                                                        </span>
                                                                                        {
                                                                                            customRenderIndicator.icon
                                                                                        }
                                                                                        {customRenderIndicator.text ? (
                                                                                            <span>
                                                                                                {
                                                                                                    customRenderIndicator.text
                                                                                                }
                                                                                            </span>
                                                                                        ) : null}
                                                                                    </span>
                                                                                ) : undefined
                                                                            }
                                                                            onSelect={() =>
                                                                                selectSection(
                                                                                    section.id,
                                                                                )
                                                                            }
                                                                        >
                                                                            {inlineMarkdownEditor ? (
                                                                                <div
                                                                                    className="@container/cms w-full"
                                                                                    data-cms-preview-interactive="true"
                                                                                >
                                                                                    <section className="py-12">
                                                                                        {resolvedSectionRenderMode ===
                                                                                            'fullWidth' ||
                                                                                        !constrainInlineMarkdownEditor ? (
                                                                                            <div className="w-full">
                                                                                                {
                                                                                                    inlineMarkdownEditor
                                                                                                }
                                                                                            </div>
                                                                                        ) : (
                                                                                            <Container
                                                                                                maxWidth={
                                                                                                    resolvedSectionRenderMaxWidth
                                                                                                }
                                                                                            >
                                                                                                {
                                                                                                    inlineMarkdownEditor
                                                                                                }
                                                                                            </Container>
                                                                                        )}
                                                                                    </section>
                                                                                </div>
                                                                            ) : (
                                                                                <SectionsView
                                                                                    sectionsData={[
                                                                                        section.data,
                                                                                    ]}
                                                                                    componentsRegistry={
                                                                                        sectionsComponentRegistry
                                                                                    }
                                                                                    renderMode={
                                                                                        pageRenderMode
                                                                                    }
                                                                                    renderMaxWidth={
                                                                                        pageRenderMaxWidth
                                                                                    }
                                                                                    debug
                                                                                />
                                                                            )}
                                                                        </CmsPageSortablePreviewSection>
                                                                    );
                                                                },
                                                            )}
                                                        </Stack>
                                                    </SortableContext>
                                                </DndContext>
                                            )}
                                        </div>
                                        <div
                                            className={`mx-auto w-full ${previewViewportClassName}`}
                                        >
                                            <Button
                                                type="button"
                                                variant={
                                                    insertAtEnd
                                                        ? 'soft'
                                                        : 'plain'
                                                }
                                                className="h-9 border border-dashed border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/30 hover:text-foreground"
                                                fullWidth
                                                aria-pressed={insertAtEnd}
                                                startDecorator={
                                                    <Add className="size-4" />
                                                }
                                                onClick={selectAppendTarget}
                                            >
                                                Dodaj sekciju
                                            </Button>
                                        </div>
                                    </Stack>
                                </div>
                            </SidePanelLayout>
                        )}
                    </Stack>

                    {state?.message && (
                        <Typography level="body2" className="text-red-600">
                            {state.message}
                        </Typography>
                    )}
                </Stack>
            </form>
            <SectionInfoModal
                componentsRegistry={sectionsComponentRegistry}
                item={sectionInfoItem}
                onOpenChange={(open) => {
                    if (!open) {
                        setSectionInfoItem(null);
                    }
                }}
            />
        </>
    );
}
