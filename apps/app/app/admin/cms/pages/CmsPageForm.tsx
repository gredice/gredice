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
import type { SelectCmsPage } from '@gredice/storage';
import {
    type CmsPageSectionComponent,
    type CmsPageSectionPreset,
    cmsPageSectionComponents,
    cmsPageSectionPresets,
} from '@gredice/storage/cmsPageSections';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { SectionsView } from '@gredice/ui/cms';
import { Input } from '@gredice/ui/Input';
import {
    Add,
    ArrowDown,
    ArrowUp,
    Delete,
    Desktop,
    Duplicate,
    Mobile,
    Tablet,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    useActionState,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import { sectionsComponentRegistry } from '../../../../components/shared/sectionsComponentRegistry';
import type { CmsPageAutosaveState, CmsPageFormState } from './actions';
import type {
    CmsPageEditableSection,
    CmsPageSectionData,
} from './CmsPageFormTypes';
import { CmsPageSectionFields } from './CmsPageSectionFields';
import { CmsPageSectionLibrary } from './CmsPageSectionLibrary';
import { CmsPageSortablePreviewSection } from './CmsPageSortablePreviewSection';

type CmsPageFormProps = {
    page?: SelectCmsPage;
    action: (
        previousState: CmsPageFormState,
        formData: FormData,
    ) => Promise<CmsPageFormState>;
    submitLabel: string;
    autosaveAction?: (formData: FormData) => Promise<CmsPageAutosaveState>;
};

const cmsPageStateItems = [
    { value: 'draft', label: 'Draft' },
    {
        value: 'published',
        label: 'Objavljeno',
    },
];

const cmsPageSectionComponentsByName = new Map<string, CmsPageSectionComponent>(
    cmsPageSectionComponents.map((component) => [
        component.component,
        component,
    ]),
);

function parseSections(content?: string | null) {
    if (!content) {
        return { isStructured: true, sections: [] };
    }

    try {
        const parsed: unknown = JSON.parse(content);
        if (!Array.isArray(parsed)) {
            return { isStructured: false, sections: [] };
        }

        return {
            isStructured: true,
            sections: parsed.filter(
                (section): section is CmsPageSectionData =>
                    Boolean(section) &&
                    typeof section === 'object' &&
                    'component' in section &&
                    typeof section.component === 'string',
            ),
        };
    } catch {
        return { isStructured: false, sections: [] };
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

function stringifySections(sections: CmsPageEditableSection[]) {
    const data = sections.map((section) => section.data);
    return data.length > 0 ? JSON.stringify(data, null, 2) : '';
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

function formatLastSavedAt(value: number | null) {
    if (!value) return null;
    return new Intl.DateTimeFormat('hr-HR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(new Date(value));
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
    action,
    submitLabel,
    autosaveAction,
}: CmsPageFormProps) {
    const [state, formAction, pending] = useActionState(action, null);
    const reactId = useId();
    const newSectionIdPrefix = useMemo(
        () => `${reactId}-${page?.id ?? 'new'}`,
        [page?.id, reactId],
    );
    const parsedSections = useMemo(
        () => parseSections(page?.content),
        [page?.content],
    );
    const nextSectionId = useRef(parsedSections.sections.length);
    const [sections, setSections] = useState<CmsPageEditableSection[]>(() =>
        editableSections(parsedSections.sections),
    );
    const preserveFallbackContent =
        !parsedSections.isStructured && Boolean(page?.content);
    const [rawMode, setRawMode] = useState(preserveFallbackContent);
    const [rawContent, setRawContent] = useState(page?.content ?? '');
    const [rawError, setRawError] = useState<string | null>(null);
    const [metaTitle, setMetaTitle] = useState(page?.metaTitle ?? '');
    const [metaDescription, setMetaDescription] = useState(
        page?.metaDescription ?? '',
    );
    const builderContent = useMemo(
        () => stringifySections(sections),
        [sections],
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
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(Date.now());
    const [lastSavedSnapshot, setLastSavedSnapshot] =
        useState(autosaveSnapshot);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
        null,
    );
    const [insertAtEnd, setInsertAtEnd] = useState(false);
    const [sectionSearch, setSectionSearch] = useState('');
    const [previewViewport, setPreviewViewport] = useState<
        'mobile' | 'tablet' | 'desktop'
    >('desktop');
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
            formData.set('state', 'draft');
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
    const metadataIssues = [
        ...(metaTitle.trim().length === 0 ? ['Meta naslov'] : []),
        ...(metaDescription.trim().length === 0 ? ['Meta opis'] : []),
        ...(metaDescription.length > 160
            ? ['Meta opis je duži od 160 znakova']
            : []),
    ];
    const publishReady =
        missingSectionFields.length === 0 &&
        metadataIssues.length === 0 &&
        !contentReadinessWarning;
    const autosaveBadgeClassName =
        autosaveStatus === 'saved'
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : autosaveStatus === 'saving'
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              : autosaveStatus === 'failed'
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    const previewViewportClassName =
        previewViewport === 'mobile'
            ? 'max-w-sm'
            : previewViewport === 'tablet'
              ? 'max-w-2xl'
              : 'max-w-none';

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

    return (
        <Stack spacing={8}>
            <Card className="sticky top-4 z-10 border-border/70 bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Row
                    spacing={4}
                    className="flex-wrap items-center justify-between"
                >
                    <Stack spacing={2}>
                        <Typography level="h4" semiBold>
                            {page?.title?.trim() || 'Nova CMS stranica'}
                        </Typography>
                        <Typography level="body3" secondary>
                            /{page?.slug?.trim() || 'slug'} •{' '}
                            {page?.state ?? 'draft'}
                        </Typography>
                    </Stack>
                    <Row spacing={4} className="items-center">
                        {autosaveAction && (
                            <span
                                className={`rounded-full border px-2 py-1 text-xs font-medium ${autosaveBadgeClassName}`}
                            >
                                {autosaveStatus === 'failed'
                                    ? 'Greška autosavea'
                                    : autosaveStatus === 'saving'
                                      ? 'Spremanje...'
                                      : autosaveStatus === 'unsaved'
                                        ? 'Nespremljene promjene'
                                        : 'Spremljeno'}
                            </span>
                        )}
                        <Button
                            variant="solid"
                            type="submit"
                            form={reactId}
                            className="w-fit"
                            loading={pending}
                        >
                            {submitLabel}
                        </Button>
                    </Row>
                </Row>
            </Card>
            <form
                id={reactId}
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
                    {autosaveAction && (
                        <Card className="border-border/60 bg-muted/20 p-3">
                            <Stack spacing={2}>
                                <Typography level="body3" semiBold>
                                    Autosave status
                                </Typography>
                                <Typography level="body3" secondary>
                                    {autosaveMessage ??
                                        (autosaveStatus === 'failed'
                                            ? 'Spremanje nije uspjelo. Provjeri polja i pokušaj ponovno.'
                                            : autosaveStatus === 'unsaved'
                                              ? 'Imaš nespremljene promjene.'
                                              : autosaveStatus === 'saving'
                                                ? 'Promjene se spremaju...'
                                                : 'Sve promjene su spremljene.')}
                                </Typography>
                                <Typography level="body3" secondary>
                                    Zadnje spremanje:{' '}
                                    {formatLastSavedAt(lastSavedAt) ??
                                        'Nije dostupno'}
                                </Typography>
                            </Stack>
                        </Card>
                    )}

                    <Card className="p-4 md:p-6">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_14rem]">
                            <Input
                                name="title"
                                label="Naslov"
                                defaultValue={page?.title ?? ''}
                                required
                            />
                            <Input
                                name="slug"
                                label="Slug"
                                defaultValue={page?.slug ?? ''}
                                placeholder="npr. sezonski-vodic"
                                helperText="Slug se sprema normalizirano i ne smije zauzeti postojeću statičku rutu."
                                required
                            />
                            <SelectItems
                                name="state"
                                label="Status"
                                defaultValue={page?.state ?? 'draft'}
                                items={cmsPageStateItems}
                            />
                        </div>
                    </Card>

                    <Stack spacing={4}>
                        <Row
                            spacing={4}
                            className="flex-wrap items-center justify-between"
                        >
                            <Stack spacing={1}>
                                <Typography level="h3" semiBold>
                                    Sadržaj stranice
                                </Typography>
                                <Typography level="body3" secondary>
                                    Vizualni editor sprema isti SectionData JSON
                                    koji koristi javni www renderer.
                                </Typography>
                            </Stack>
                            <Row spacing={2} className="flex-wrap">
                                <Button
                                    type="button"
                                    variant={!rawMode ? 'solid' : 'outlined'}
                                    onClick={() => setRawMode(false)}
                                >
                                    Vizualni editor
                                </Button>
                                <Button
                                    type="button"
                                    variant={rawMode ? 'solid' : 'outlined'}
                                    onClick={() => {
                                        if (rawMode) {
                                            return;
                                        }
                                        setRawMode(true);
                                        setRawError(null);
                                        setRawContent(builderContent);
                                    }}
                                >
                                    JSON fallback
                                </Button>
                            </Row>
                        </Row>

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
                            <Card className="p-4">
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
                                            setRawContent(event.target.value);
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
                            </Card>
                        ) : (
                            <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
                                <Stack spacing={6} className="h-fit">
                                    <div className="rounded-lg border bg-background p-3">
                                        <CmsPageSectionLibrary
                                            query={sectionSearch}
                                            components={
                                                cmsPageSectionComponents
                                            }
                                            presets={cmsPageSectionPresets}
                                            onQueryChange={setSectionSearch}
                                            onInsertComponent={(component) =>
                                                insertSection(
                                                    component,
                                                    insertionIndex,
                                                )
                                            }
                                            onInsertPreset={(preset) =>
                                                insertPreset(
                                                    preset,
                                                    insertionIndex,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="rounded-lg border bg-background p-3">
                                        <Stack spacing={4}>
                                            <Typography level="h4" semiBold>
                                                Navigator
                                            </Typography>
                                            {sections.length === 0 ? (
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    Nema sekcija.
                                                </Typography>
                                            ) : (
                                                sections.map(
                                                    (section, index) => (
                                                        <Button
                                                            key={`navigator-${section.id}`}
                                                            type="button"
                                                            variant={
                                                                selectedSectionId ===
                                                                section.id
                                                                    ? 'solid'
                                                                    : 'plain'
                                                            }
                                                            className="justify-start"
                                                            onClick={() =>
                                                                selectSection(
                                                                    section.id,
                                                                )
                                                            }
                                                        >
                                                            {index + 1}.{' '}
                                                            {sectionLabel(
                                                                section.data
                                                                    .component,
                                                            )}
                                                        </Button>
                                                    ),
                                                )
                                            )}
                                            <Button
                                                type="button"
                                                variant={
                                                    insertAtEnd
                                                        ? 'solid'
                                                        : 'outlined'
                                                }
                                                startDecorator={
                                                    <Add className="size-4" />
                                                }
                                                onClick={selectAppendTarget}
                                            >
                                                Dodaj na kraj
                                            </Button>
                                        </Stack>
                                    </div>
                                </Stack>

                                <Stack spacing={4} className="min-w-0">
                                    <Row
                                        spacing={3}
                                        className="flex-wrap items-center justify-between"
                                    >
                                        <Typography level="h4" semiBold>
                                            Editor / preview
                                        </Typography>
                                        <Row spacing={2}>
                                            <Button
                                                type="button"
                                                variant={
                                                    previewViewport === 'mobile'
                                                        ? 'solid'
                                                        : 'outlined'
                                                }
                                                size="sm"
                                                startDecorator={
                                                    <Mobile className="size-4" />
                                                }
                                                onClick={() =>
                                                    setPreviewViewport('mobile')
                                                }
                                            >
                                                Mobile
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={
                                                    previewViewport === 'tablet'
                                                        ? 'solid'
                                                        : 'outlined'
                                                }
                                                size="sm"
                                                startDecorator={
                                                    <Tablet className="size-4" />
                                                }
                                                onClick={() =>
                                                    setPreviewViewport('tablet')
                                                }
                                            >
                                                Tablet
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={
                                                    previewViewport ===
                                                    'desktop'
                                                        ? 'solid'
                                                        : 'outlined'
                                                }
                                                size="sm"
                                                startDecorator={
                                                    <Desktop className="size-4" />
                                                }
                                                onClick={() =>
                                                    setPreviewViewport(
                                                        'desktop',
                                                    )
                                                }
                                            >
                                                Desktop
                                            </Button>
                                        </Row>
                                    </Row>
                                    <div
                                        className={`mx-auto w-full ${previewViewportClassName}`}
                                    >
                                        {sections.length === 0 ? (
                                            <div className="min-h-96 rounded-lg border border-dashed bg-muted/20 p-8 text-center">
                                                <Typography
                                                    level="body2"
                                                    secondary
                                                >
                                                    Stranica još nema sekcija.
                                                </Typography>
                                            </div>
                                        ) : (
                                            <DndContext
                                                id={`cms-page-sections-${page?.id ?? 'new'}`}
                                                sensors={sensors}
                                                collisionDetection={
                                                    closestCenter
                                                }
                                                onDragEnd={handleSectionDragEnd}
                                            >
                                                <SortableContext
                                                    items={sections.map(
                                                        (section) => section.id,
                                                    )}
                                                    strategy={
                                                        verticalListSortingStrategy
                                                    }
                                                >
                                                    <Stack spacing={4}>
                                                        {sections.map(
                                                            (section) => (
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
                                                                    onSelect={() =>
                                                                        selectSection(
                                                                            section.id,
                                                                        )
                                                                    }
                                                                >
                                                                    <SectionsView
                                                                        sectionsData={[
                                                                            section.data,
                                                                        ]}
                                                                        componentsRegistry={
                                                                            sectionsComponentRegistry
                                                                        }
                                                                        debug
                                                                    />
                                                                </CmsPageSortablePreviewSection>
                                                            ),
                                                        )}
                                                    </Stack>
                                                </SortableContext>
                                            </DndContext>
                                        )}
                                    </div>
                                </Stack>

                                <Stack
                                    spacing={4}
                                    className="h-fit xl:sticky xl:top-24"
                                >
                                    <Card className="p-4">
                                        <Stack spacing={4}>
                                            <Row
                                                spacing={2}
                                                className="items-start justify-between"
                                            >
                                                <Stack spacing={1}>
                                                    <Typography
                                                        level="h4"
                                                        semiBold
                                                    >
                                                        Detalji sekcije
                                                    </Typography>
                                                    {selectedSection && (
                                                        <Typography
                                                            level="body3"
                                                            secondary
                                                        >
                                                            {
                                                                selectedSection
                                                                    .data
                                                                    .component
                                                            }
                                                        </Typography>
                                                    )}
                                                </Stack>
                                                {selectedSection && (
                                                    <Row spacing={1}>
                                                        <Button
                                                            type="button"
                                                            variant="plain"
                                                            size="sm"
                                                            disabled={
                                                                selectedSectionIndex ===
                                                                0
                                                            }
                                                            aria-label="Pomakni sekciju gore"
                                                            title="Pomakni sekciju gore"
                                                            onClick={() =>
                                                                setSections(
                                                                    (current) =>
                                                                        moveSection(
                                                                            current,
                                                                            selectedSection.id,
                                                                            -1,
                                                                        ),
                                                                )
                                                            }
                                                        >
                                                            <ArrowUp className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="plain"
                                                            size="sm"
                                                            disabled={
                                                                selectedSectionIndex ===
                                                                sections.length -
                                                                    1
                                                            }
                                                            aria-label="Pomakni sekciju dolje"
                                                            title="Pomakni sekciju dolje"
                                                            onClick={() =>
                                                                setSections(
                                                                    (current) =>
                                                                        moveSection(
                                                                            current,
                                                                            selectedSection.id,
                                                                            1,
                                                                        ),
                                                                )
                                                            }
                                                        >
                                                            <ArrowDown className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="plain"
                                                            size="sm"
                                                            aria-label="Dupliciraj sekciju"
                                                            title="Dupliciraj sekciju"
                                                            onClick={() =>
                                                                duplicateSection(
                                                                    selectedSection,
                                                                )
                                                            }
                                                        >
                                                            <Duplicate className="size-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="plain"
                                                            color="danger"
                                                            size="sm"
                                                            aria-label="Ukloni sekciju"
                                                            title="Ukloni sekciju"
                                                            onClick={() =>
                                                                removeSection(
                                                                    selectedSection.id,
                                                                )
                                                            }
                                                        >
                                                            <Delete className="size-4" />
                                                        </Button>
                                                    </Row>
                                                )}
                                            </Row>
                                            {selectedSection && (
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    {selectedSectionComponent?.description ??
                                                        sectionSummary(
                                                            selectedSection,
                                                        )}
                                                </Typography>
                                            )}
                                            <CmsPageSectionFields
                                                section={selectedSection}
                                                fields={
                                                    selectedSectionComponent?.fields ??
                                                    []
                                                }
                                                fieldErrors={
                                                    selectedSectionErrors
                                                }
                                                onChange={(sectionId, data) =>
                                                    updateSectionData(
                                                        sectionId,
                                                        data,
                                                        setSections,
                                                    )
                                                }
                                            />
                                        </Stack>
                                    </Card>

                                    <Card className="p-4">
                                        <Stack spacing={4}>
                                            <Typography level="h4" semiBold>
                                                SEO
                                            </Typography>
                                            <Input
                                                name="metaTitle"
                                                label="Meta naslov"
                                                value={metaTitle}
                                                onChange={(event) =>
                                                    setMetaTitle(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <Input
                                                name="metaDescription"
                                                label="Meta opis"
                                                value={metaDescription}
                                                maxLength={160}
                                                helperText={`${metaDescription.length}/160 znakova`}
                                                onChange={(event) =>
                                                    setMetaDescription(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <Input
                                                name="metaImageUrl"
                                                label="Meta slika URL"
                                                type="url"
                                                defaultValue={
                                                    page?.metaImageUrl ?? ''
                                                }
                                            />
                                            <Input
                                                name="canonicalPath"
                                                label="Canonical putanja"
                                                defaultValue={
                                                    page?.canonicalPath ?? ''
                                                }
                                                placeholder="/primjer-stranice"
                                            />
                                            <label className="flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    name="noIndex"
                                                    defaultChecked={
                                                        page?.noIndex ?? false
                                                    }
                                                />
                                                Isključi iz indeksiranja
                                                (noindex)
                                            </label>
                                            <div className="rounded-md border bg-muted/20 p-3">
                                                <Typography
                                                    level="body3"
                                                    semiBold
                                                >
                                                    {metaTitle ||
                                                        page?.title ||
                                                        'Meta naslov'}
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
                                    </Card>

                                    <Card className="p-4">
                                        <Stack spacing={3}>
                                            <Typography level="h4" semiBold>
                                                Publish readiness
                                            </Typography>
                                            {publishReady ? (
                                                <Typography
                                                    level="body3"
                                                    className="text-emerald-500"
                                                >
                                                    Stranica je spremna za
                                                    objavu.
                                                </Typography>
                                            ) : (
                                                <Stack spacing={2}>
                                                    {contentReadinessWarning && (
                                                        <Typography
                                                            level="body3"
                                                            className="text-amber-500"
                                                        >
                                                            {
                                                                contentReadinessWarning
                                                            }
                                                        </Typography>
                                                    )}
                                                    {missingSectionFields.map(
                                                        (entry) => (
                                                            <Typography
                                                                key={
                                                                    entry
                                                                        .section
                                                                        .id
                                                                }
                                                                level="body3"
                                                                className="text-amber-500"
                                                            >
                                                                Sekcija{' '}
                                                                {entry.index +
                                                                    1}{' '}
                                                                (
                                                                {sectionLabel(
                                                                    entry
                                                                        .section
                                                                        .data
                                                                        .component,
                                                                )}
                                                                ) ima obavezna
                                                                prazna polja.
                                                            </Typography>
                                                        ),
                                                    )}
                                                    {metadataIssues.map(
                                                        (issue) => (
                                                            <Typography
                                                                key={issue}
                                                                level="body3"
                                                                className="text-amber-500"
                                                            >
                                                                {issue}
                                                            </Typography>
                                                        ),
                                                    )}
                                                </Stack>
                                            )}
                                        </Stack>
                                    </Card>
                                </Stack>
                            </div>
                        )}
                    </Stack>

                    {state?.message && (
                        <Typography level="body2" className="text-red-600">
                            {state.message}
                        </Typography>
                    )}
                </Stack>
            </form>
        </Stack>
    );
}
