'use client';

import type { SelectCmsPage } from '@gredice/storage';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState, useId, useMemo, useRef, useState } from 'react';
import type { CmsPageFormState } from './actions';

type CmsPageFormProps = {
    page?: SelectCmsPage;
    action: (
        previousState: CmsPageFormState,
        formData: FormData,
    ) => Promise<CmsPageFormState>;
    submitLabel: string;
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

const cmsPageSectionItems = [
    { value: 'Heading1', label: 'Heading1' },
    { value: 'Feature1', label: 'Feature1' },
    { value: 'Faq1', label: 'Faq1' },
    { value: 'Footer1', label: 'Footer1' },
];

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

function editableSection(
    section: CmsPageSectionData,
    occurrence: number,
): CmsPageEditableSection {
    return {
        id: `${section.component}-${occurrence}`,
        data: section,
    };
}

function newSection(
    component: string,
    idPrefix: string,
    id: number,
): CmsPageEditableSection {
    return {
        id: `${idPrefix}-${id}`,
        data: { component },
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
    fallbackContent?: string | null,
    preserveFallback = false,
) {
    if (preserveFallback && sections.length === 0) {
        return fallbackContent ?? '';
    }

    const data = sections.map((section) => section.data);
    return data.length > 0 ? JSON.stringify(data) : '';
}

function sectionValue(section: CmsPageEditableSection, key: string) {
    const value = section.data[key];
    return typeof value === 'string' ? value : '';
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

export function CmsPageForm({ page, action, submitLabel }: CmsPageFormProps) {
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
    const serializedContent = useMemo(
        () =>
            stringifySections(sections, page?.content, preserveFallbackContent),
        [page?.content, preserveFallbackContent, sections],
    );

    return (
        <Card className="max-w-3xl">
            <Stack spacing={4} className="p-6">
                <form action={formAction}>
                    <Stack spacing={4}>
                        <Stack spacing={3}>
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
                                    Dodaj i uređuj sekcije bez ručnog uređivanja
                                    JSON-a.
                                </Typography>
                                <input
                                    name="content"
                                    type="hidden"
                                    value={serializedContent}
                                    readOnly
                                />
                                {sections.length === 0 ? (
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
                                                className="p-4"
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
                                                            {
                                                                section.data
                                                                    .component
                                                            }
                                                        </Typography>
                                                        <Row spacing={1}>
                                                            <Button
                                                                type="button"
                                                                variant="plain"
                                                                disabled={
                                                                    index === 0
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
                                                                Gore
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
                                                                Dolje
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
                                                    <Input
                                                        label="Naslov"
                                                        value={sectionValue(
                                                            section,
                                                            'header',
                                                        )}
                                                        onChange={(event) => {
                                                            const value =
                                                                event.target
                                                                    .value;
                                                            setSections(
                                                                (current) =>
                                                                    current.map(
                                                                        (
                                                                            currentSection,
                                                                        ) =>
                                                                            currentSection.id ===
                                                                            section.id
                                                                                ? {
                                                                                      ...currentSection,
                                                                                      data: {
                                                                                          ...currentSection.data,
                                                                                          header: value,
                                                                                      },
                                                                                  }
                                                                                : currentSection,
                                                                    ),
                                                            );
                                                        }}
                                                    />
                                                    <label className="space-y-1">
                                                        <span className="block text-sm font-medium">
                                                            Opis
                                                        </span>
                                                        <textarea
                                                            value={sectionValue(
                                                                section,
                                                                'description',
                                                            )}
                                                            rows={4}
                                                            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                const value =
                                                                    event.target
                                                                        .value;
                                                                setSections(
                                                                    (current) =>
                                                                        current.map(
                                                                            (
                                                                                currentSection,
                                                                            ) =>
                                                                                currentSection.id ===
                                                                                section.id
                                                                                    ? {
                                                                                          ...currentSection,
                                                                                          data: {
                                                                                              ...currentSection.data,
                                                                                              description:
                                                                                                  value,
                                                                                          },
                                                                                      }
                                                                                    : currentSection,
                                                                        ),
                                                                );
                                                            }}
                                                        />
                                                    </label>
                                                </Stack>
                                            </Card>
                                        ))}
                                    </Stack>
                                )}
                                <Row spacing={2}>
                                    {cmsPageSectionItems.map((item) => (
                                        <Button
                                            key={item.value}
                                            type="button"
                                            variant="outlined"
                                            onClick={() => {
                                                setSections((current) => {
                                                    const sectionId =
                                                        nextSectionId.current;
                                                    nextSectionId.current += 1;
                                                    return [
                                                        ...current,
                                                        newSection(
                                                            item.value,
                                                            newSectionIdPrefix,
                                                            sectionId,
                                                        ),
                                                    ];
                                                });
                                            }}
                                        >
                                            Dodaj {item.label}
                                        </Button>
                                    ))}
                                </Row>
                            </Stack>
                        </Stack>

                        <Stack spacing={3}>
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
                                defaultValue={page?.metaDescription ?? ''}
                            />
                            <Input
                                name="metaImageUrl"
                                label="Meta slika URL"
                                type="url"
                                defaultValue={page?.metaImageUrl ?? ''}
                            />
                            <Input
                                name="canonicalPath"
                                label="Canonical putanja"
                                defaultValue={page?.canonicalPath ?? ''}
                                placeholder="/primjer-stranice"
                            />
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    name="noIndex"
                                    defaultChecked={page?.noIndex ?? false}
                                />
                                Isključi iz indeksiranja (noindex)
                            </label>
                        </Stack>

                        {state?.message && (
                            <Typography level="body2" className="text-red-600">
                                {state.message}
                            </Typography>
                        )}

                        <Button
                            variant="solid"
                            type="submit"
                            className="w-fit"
                            loading={pending}
                        >
                            {submitLabel}
                        </Button>
                    </Stack>
                </form>
            </Stack>
        </Card>
    );
}
