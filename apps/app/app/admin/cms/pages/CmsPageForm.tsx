'use client';

import type { SelectCmsPage } from '@gredice/storage';
import {
    type CmsPageSectionComponent,
    cmsPageSectionComponents,
} from '@gredice/storage/cmsPageSections';
import { SectionsView } from '@signalco/cms-core/SectionsView';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
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

type CmsPageFormProps = {
    page?: SelectCmsPage;
    action: (
        previousState: CmsPageFormState,
        formData: FormData,
    ) => Promise<CmsPageFormState>;
    submitLabel: string;
    autosaveAction?: (formData: FormData) => Promise<CmsPageAutosaveState>;
};

type CmsPageSectionData = {
    component: string;
    [key: string]: unknown;
};

type CmsPageEditableSection = {
    id: string;
    data: CmsPageSectionData;
};

const cmsPageStateItems = [
    { value: 'draft', label: 'Draft' },
    {
        value: 'published',
        label: 'Objavljeno',
    },
];

const cmsPageSectionItems = cmsPageSectionComponents.map((component) => ({
    value: component.component,
    label: component.label,
    category: component.isCustom ? 'Prilagođene' : 'Osnovne',
}));

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

function sectionLabel(component: string) {
    return cmsPageSectionComponentsByName.get(component)?.label ?? component;
}

function sectionSummary(section: CmsPageEditableSection) {
    const fields =
        cmsPageSectionComponentsByName.get(section.data.component)?.fields ??
        [];
    for (const field of fields) {
        const value = sectionValue(section, field.key).trim();
        if (value.length > 0) {
            return value;
        }
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
        data: JSON.parse(JSON.stringify(section.data)) as CmsPageSectionData,
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
            .filter(
                (field) => sectionValue(section, field.key).trim().length === 0,
            )
            .map((field) => [field.key, `${field.label} je obavezno polje.`]),
    );
}

function updateSectionField(
    sectionId: string,
    key: string,
    value: string,
    setSections: React.Dispatch<React.SetStateAction<CmsPageEditableSection[]>>,
) {
    setSections((current) =>
        current.map((currentSection) =>
            currentSection.id === sectionId
                ? {
                      ...currentSection,
                      data: {
                          ...currentSection.data,
                          [key]: value,
                      },
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
    const [lastSavedSnapshot, setLastSavedSnapshot] =
        useState(autosaveSnapshot);
    const [previewSections, setPreviewSections] = useState<
        CmsPageSectionData[]
    >([]);
    const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
        null,
    );
    const [insertAtEnd, setInsertAtEnd] = useState(false);
    const [sectionSearch, setSectionSearch] = useState('');

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
        }, 600);

        return () => clearTimeout(timer);
    }, [
        autosaveAction,
        autosaveSnapshot,
        serializedContent,
        lastSavedSnapshot,
    ]);

    useEffect(() => {
        setPreviewSections(parseSections(serializedContent).sections);
    }, [serializedContent]);

    useEffect(() => {
        if (sections.length === 0) {
            setSelectedSectionId(null);
            return;
        }

        // Preserve explicit append mode instead of auto-selecting the first section.
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
    const filteredSectionItems = useMemo(() => {
        const query = sectionSearch.trim().toLowerCase();
        if (!query) {
            return cmsPageSectionItems;
        }

        return cmsPageSectionItems.filter(
            (item) =>
                item.label.toLowerCase().includes(query) ||
                item.value.toLowerCase().includes(query),
        );
    }, [sectionSearch]);
    const groupedSectionItems = useMemo(() => {
        const grouped: Record<string, typeof cmsPageSectionItems> = {};
        for (const item of filteredSectionItems) {
            if (!grouped[item.category]) {
                grouped[item.category] = [];
            }
            grouped[item.category].push(item);
        }
        return grouped;
    }, [filteredSectionItems]);

    const insertSection = (component: string, index?: number) => {
        const sectionId = nextSectionId.current;
        nextSectionId.current += 1;
        const id = `${newSectionIdPrefix}-${sectionId}`;
        setSections((current) => {
            const entry = { id, data: { component } };
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

    return (
        <Stack spacing={4}>
            <Card className="sticky top-4 z-10 border-border/70 bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                <Row
                    spacing={2}
                    className="flex-wrap items-center justify-between"
                >
                    <Stack spacing={1}>
                        <Typography level="h4" semiBold>
                            {page?.title?.trim() || 'Nova CMS stranica'}
                        </Typography>
                        <Typography level="body3" secondary>
                            /{page?.slug?.trim() || 'slug'} •{' '}
                            {page?.state ?? 'draft'}
                            {autosaveAction
                                ? ` • Autosave: ${autosaveStatus}${autosaveMessage ? ` • ${autosaveMessage}` : ''}`
                                : ''}
                        </Typography>
                    </Stack>
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
            </Card>
            <Card className="w-full">
                <Stack spacing={4} className="p-4 md:p-6">
                    <form
                        id={reactId}
                        ref={formRef}
                        action={formAction}
                        onChange={() =>
                            setFormRevision((current) => current + 1)
                        }
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
                        <Stack spacing={4}>
                            <Stack spacing={3}>
                                {autosaveAction && (
                                    <Typography level="body3" secondary>
                                        Autosave: {autosaveStatus}
                                        {autosaveMessage
                                            ? ` • ${autosaveMessage}`
                                            : ''}
                                    </Typography>
                                )}
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
                                <Stack spacing={2}>
                                    <Typography level="h3" semiBold>
                                        Sadržaj stranice
                                    </Typography>
                                    <Typography level="body3" secondary>
                                        Vizualni editor je zadani način rada, a
                                        JSON editor je dostupan kao fallback.
                                    </Typography>
                                    <Row spacing={2}>
                                        <Button
                                            type="button"
                                            variant={
                                                !rawMode ? 'solid' : 'outlined'
                                            }
                                            onClick={() => setRawMode(false)}
                                        >
                                            Vizualni editor
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={
                                                rawMode ? 'solid' : 'outlined'
                                            }
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
                                    {preserveFallbackContent && (
                                        <Card className="p-3 text-sm text-amber-700">
                                            Postojeći sadržaj nije moguće
                                            prikazati u vizualnom editoru bez
                                            gubitka podataka.
                                        </Card>
                                    )}
                                    <input
                                        name="content"
                                        type="hidden"
                                        value={serializedContent}
                                        readOnly
                                    />
                                    {rawMode ? (
                                        <label className="space-y-1">
                                            <span className="block text-sm font-medium">
                                                JSON sadržaj
                                            </span>
                                            <textarea
                                                value={rawContent}
                                                rows={16}
                                                className="block w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                                    ) : sections.length === 0 ? (
                                        <Card className="p-4 text-sm text-muted-foreground">
                                            {preserveFallbackContent
                                                ? 'Postojeći sadržaj nije JSON niz sekcija i bit će sačuvan dok ne dodaš novu sekciju. Dodavanje nove sekcije zamijenit će ga novom strukturom sekcija.'
                                                : 'Stranica još nema sekcija.'}
                                        </Card>
                                    ) : (
                                        <Stack spacing={2}>
                                            {sections.map((section, index) => (
                                                <Card
                                                    key={section.id}
                                                    className={`p-4 cursor-pointer ${selectedSectionId === section.id ? 'border-primary' : ''}`}
                                                    onClick={() =>
                                                        selectSection(
                                                            section.id,
                                                        )
                                                    }
                                                >
                                                    <Stack spacing={2}>
                                                        <Row
                                                            spacing={2}
                                                            className="items-center justify-between"
                                                        >
                                                            <Typography
                                                                level="body1"
                                                                semiBold
                                                            >
                                                                {index + 1}.{' '}
                                                                {sectionLabel(
                                                                    section.data
                                                                        .component,
                                                                )}
                                                            </Typography>
                                                            <Row spacing={1}>
                                                                <Button
                                                                    type="button"
                                                                    variant="plain"
                                                                    disabled={
                                                                        index ===
                                                                        0
                                                                    }
                                                                    onClick={() =>
                                                                        setSections(
                                                                            (
                                                                                current,
                                                                            ) =>
                                                                                moveSection(
                                                                                    current,
                                                                                    section.id,
                                                                                    -1,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    ↑ Gore
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="plain"
                                                                    disabled={
                                                                        index ===
                                                                        sections.length -
                                                                            1
                                                                    }
                                                                    onClick={() =>
                                                                        setSections(
                                                                            (
                                                                                current,
                                                                            ) =>
                                                                                moveSection(
                                                                                    current,
                                                                                    section.id,
                                                                                    1,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    ↓ Dolje
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="plain"
                                                                    onClick={() => {
                                                                        setSections(
                                                                            (
                                                                                current,
                                                                            ) => {
                                                                                const idx =
                                                                                    current.findIndex(
                                                                                        (
                                                                                            candidate,
                                                                                        ) =>
                                                                                            candidate.id ===
                                                                                            section.id,
                                                                                    );
                                                                                if (
                                                                                    idx <
                                                                                    0
                                                                                ) {
                                                                                    return current;
                                                                                }
                                                                                const sectionId =
                                                                                    nextSectionId.current;
                                                                                nextSectionId.current += 1;
                                                                                const duplicate =
                                                                                    copySection(
                                                                                        section,
                                                                                        `${newSectionIdPrefix}-${sectionId}`,
                                                                                    );
                                                                                return [
                                                                                    ...current.slice(
                                                                                        0,
                                                                                        idx +
                                                                                            1,
                                                                                    ),
                                                                                    duplicate,
                                                                                    ...current.slice(
                                                                                        idx +
                                                                                            1,
                                                                                    ),
                                                                                ];
                                                                            },
                                                                        );
                                                                    }}
                                                                >
                                                                    Dupliciraj
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="plain"
                                                                    color="danger"
                                                                    onClick={() =>
                                                                        setSections(
                                                                            (
                                                                                current,
                                                                            ) =>
                                                                                current.filter(
                                                                                    (
                                                                                        currentSection,
                                                                                    ) =>
                                                                                        currentSection.id !==
                                                                                        section.id,
                                                                                ),
                                                                        )
                                                                    }
                                                                >
                                                                    Ukloni
                                                                </Button>
                                                            </Row>
                                                        </Row>
                                                        {validateSection(
                                                            section,
                                                        ).map((error) => (
                                                            <Typography
                                                                key={error}
                                                                level="body3"
                                                                className="text-red-600"
                                                            >
                                                                {error}
                                                            </Typography>
                                                        ))}
                                                        {!sectionSummary(
                                                            section,
                                                        ) && (
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                Prazna sekcija —
                                                                sadržaj dodaj
                                                                kroz postavke
                                                                polja.
                                                            </Typography>
                                                        )}
                                                    </Stack>
                                                </Card>
                                            ))}
                                        </Stack>
                                    )}
                                    {!rawMode && (
                                        <Card className="p-3">
                                            <Stack spacing={2}>
                                                <Typography
                                                    level="body2"
                                                    semiBold
                                                >
                                                    Komponente
                                                </Typography>
                                                <Input
                                                    label="Pretraži komponente"
                                                    value={sectionSearch}
                                                    onChange={(event) =>
                                                        setSectionSearch(
                                                            event.target.value,
                                                        )
                                                    }
                                                    placeholder="npr. Heading ili Feature"
                                                />
                                                <Row
                                                    spacing={1}
                                                    className="flex-wrap"
                                                >
                                                    {Object.entries(
                                                        groupedSectionItems,
                                                    ).map(([group, items]) => (
                                                        <Stack
                                                            key={group}
                                                            spacing={1}
                                                            className="min-w-56"
                                                        >
                                                            <Typography
                                                                level="body3"
                                                                secondary
                                                            >
                                                                {group}
                                                            </Typography>
                                                            {items.map(
                                                                (item) => (
                                                                    <Button
                                                                        key={
                                                                            item.value
                                                                        }
                                                                        type="button"
                                                                        variant="outlined"
                                                                        onClick={() =>
                                                                            insertSection(
                                                                                item.value,
                                                                                insertionIndex,
                                                                            )
                                                                        }
                                                                    >
                                                                        Dodaj{' '}
                                                                        {
                                                                            item.label
                                                                        }
                                                                    </Button>
                                                                ),
                                                            )}
                                                        </Stack>
                                                    ))}
                                                </Row>
                                            </Stack>
                                        </Card>
                                    )}
                                </Stack>
                            </Stack>

                            <Stack spacing={2}>
                                <Typography level="h3" semiBold>
                                    Live preview
                                </Typography>
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                                    <Card className="p-4">
                                        <Stack spacing={2}>
                                            {sections.map((section) => (
                                                <Stack
                                                    key={section.id}
                                                    spacing={2}
                                                >
                                                    <Card
                                                        className={`p-3 cursor-pointer ${section.id === selectedSectionId ? 'border-primary' : ''}`}
                                                        onClick={() =>
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
                                                        />
                                                    </Card>
                                                </Stack>
                                            ))}
                                            {previewSections.length === 0 && (
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                >
                                                    Nema sekcija za prikaz.
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Card>
                                    <Stack
                                        spacing={3}
                                        className="h-fit lg:sticky lg:top-24"
                                    >
                                        <Card className="p-4">
                                            <Stack spacing={2}>
                                                <Typography level="h4" semiBold>
                                                    Navigator sekcija
                                                </Typography>
                                                {sections.length === 0 ? (
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        Dodaj prvu sekciju iz
                                                        palete komponenti.
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
                                                <Row spacing={2}>
                                                    <Button
                                                        type="button"
                                                        variant={
                                                            insertAtEnd
                                                                ? 'solid'
                                                                : 'outlined'
                                                        }
                                                        onClick={
                                                            selectAppendTarget
                                                        }
                                                    >
                                                        Dodaj na kraj
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outlined"
                                                        onClick={() =>
                                                            insertSection(
                                                                cmsPageSectionItems[0]
                                                                    ?.value ??
                                                                    'Heading1',
                                                                insertionIndex,
                                                            )
                                                        }
                                                    >
                                                        Brzo dodaj sekciju
                                                    </Button>
                                                </Row>
                                            </Stack>
                                        </Card>
                                        <Card className="p-4">
                                            <Stack spacing={2}>
                                                <Typography level="h4" semiBold>
                                                    Postavke sekcije
                                                </Typography>
                                                {!selectedSection ? (
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        Klikni sekciju u preview
                                                        prikazu za uređivanje
                                                        atributa.
                                                    </Typography>
                                                ) : (
                                                    <>
                                                        <Typography
                                                            level="body2"
                                                            semiBold
                                                        >
                                                            {
                                                                selectedSection
                                                                    .data
                                                                    .component
                                                            }
                                                        </Typography>
                                                        {(
                                                            cmsPageSectionComponentsByName.get(
                                                                selectedSection
                                                                    .data
                                                                    .component,
                                                            )?.fields ?? []
                                                        ).map((field) =>
                                                            field.type ===
                                                            'textarea' ? (
                                                                <label
                                                                    key={
                                                                        field.key
                                                                    }
                                                                    className="space-y-1"
                                                                >
                                                                    <span className="block text-sm font-medium">
                                                                        {
                                                                            field.label
                                                                        }
                                                                        {field.required && (
                                                                            <span className="text-red-600">
                                                                                {' '}
                                                                                *
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <textarea
                                                                        value={sectionValue(
                                                                            selectedSection,
                                                                            field.key,
                                                                        )}
                                                                        rows={
                                                                            field.rows ??
                                                                            4
                                                                        }
                                                                        className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            updateSectionField(
                                                                                selectedSection.id,
                                                                                field.key,
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                                setSections,
                                                                            )
                                                                        }
                                                                    />
                                                                    {selectedSectionErrors.has(
                                                                        field.key,
                                                                    ) && (
                                                                        <Typography
                                                                            level="body3"
                                                                            className="text-red-600"
                                                                        >
                                                                            {selectedSectionErrors.get(
                                                                                field.key,
                                                                            )}
                                                                        </Typography>
                                                                    )}
                                                                </label>
                                                            ) : (
                                                                <Stack
                                                                    key={
                                                                        field.key
                                                                    }
                                                                    spacing={1}
                                                                >
                                                                    <Input
                                                                        label={`${field.label}${field.required ? ' *' : ''}`}
                                                                        value={sectionValue(
                                                                            selectedSection,
                                                                            field.key,
                                                                        )}
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            updateSectionField(
                                                                                selectedSection.id,
                                                                                field.key,
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                                setSections,
                                                                            )
                                                                        }
                                                                    />
                                                                    {selectedSectionErrors.has(
                                                                        field.key,
                                                                    ) && (
                                                                        <Typography
                                                                            level="body3"
                                                                            className="text-red-600"
                                                                        >
                                                                            {selectedSectionErrors.get(
                                                                                field.key,
                                                                            )}
                                                                        </Typography>
                                                                    )}
                                                                </Stack>
                                                            ),
                                                        )}
                                                        {selectedSectionErrors.size >
                                                            0 && (
                                                            <Typography
                                                                level="body3"
                                                                className="text-red-600"
                                                            >
                                                                Sekcija ima
                                                                nepopunjena
                                                                obavezna polja.
                                                            </Typography>
                                                        )}
                                                    </>
                                                )}
                                            </Stack>
                                        </Card>
                                    </Stack>
                                </div>
                            </Stack>

                            <Stack spacing={3}>
                                <Card className="p-4">
                                    <Stack spacing={2}>
                                        <Typography level="h3" semiBold>
                                            Metadata
                                        </Typography>
                                        <Input
                                            name="metaTitle"
                                            label="Meta naslov"
                                            defaultValue={page?.metaTitle ?? ''}
                                        />
                                        <Input
                                            name="metaDescription"
                                            label="Meta opis"
                                            defaultValue={
                                                page?.metaDescription ?? ''
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
                                            Isključi iz indeksiranja (noindex)
                                        </label>
                                    </Stack>
                                </Card>
                            </Stack>

                            {state?.message && (
                                <Typography
                                    level="body2"
                                    className="text-red-600"
                                >
                                    {state.message}
                                </Typography>
                            )}
                        </Stack>
                    </form>
                </Stack>
            </Card>
        </Stack>
    );
}
