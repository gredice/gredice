'use client';

import type { SelectCmsPage } from '@gredice/storage';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState, useMemo, useState } from 'react';
import type { CmsPageFormState } from './actions';

type CmsPageFormProps = {
    page?: SelectCmsPage;
    action: (
        previousState: CmsPageFormState,
        formData: FormData,
    ) => Promise<CmsPageFormState>;
    submitLabel: string;
};

type CmsPageSectionComponent = 'Heading1' | 'Faq1' | 'Feature1' | 'Footer1';

type CmsPageSectionData = {
    component: CmsPageSectionComponent;
    [key: string]: unknown;
};

const cmsPageStateItems = [
    { value: 'draft', label: 'Draft' },
    {
        value: 'published',
        label: 'Objavljeno',
    },
];

const cmsPageSectionItems: { value: CmsPageSectionComponent; label: string }[] = [
    { value: 'Heading1', label: 'Heading1' },
    { value: 'Feature1', label: 'Feature1' },
    { value: 'Faq1', label: 'Faq1' },
    { value: 'Footer1', label: 'Footer1' },
];

function parseSections(content?: string | null): CmsPageSectionData[] {
    if (!content) {
        return [];
    }

    try {
        const parsed: unknown = JSON.parse(content);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter(
            (section): section is CmsPageSectionData =>
                Boolean(section) &&
                typeof section === 'object' &&
                'component' in section &&
                typeof section.component === 'string',
        );
    } catch {
        return [];
    }
}

function stringifySections(sections: CmsPageSectionData[]) {
    return sections.length > 0 ? JSON.stringify(sections) : '';
}

function sectionValue(section: CmsPageSectionData, key: string) {
    const value = section[key];
    return typeof value === 'string' ? value : '';
}

export function CmsPageForm({ page, action, submitLabel }: CmsPageFormProps) {
    const [state, formAction, pending] = useActionState(action, null);
    const [sections, setSections] = useState<CmsPageSectionData[]>(() =>
        parseSections(page?.content),
    );
    const serializedContent = useMemo(() => stringifySections(sections), [sections]);

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
                                    Dodaj i uređuj sekcije bez ručnog uređivanja JSON-a.
                                </Typography>
                                <input
                                    name="content"
                                    type="hidden"
                                    value={serializedContent}
                                    readOnly
                                />
                                {sections.length === 0 ? (
                                    <Card className="p-4 text-sm text-muted-foreground">
                                        Stranica još nema sekcija.
                                    </Card>
                                ) : (
                                    <Stack spacing={2}>
                                        {sections.map((section, index) => (
                                            <Card key={`${section.component}-${index}`} className="p-4">
                                                <Stack spacing={2}>
                                                    <Row spacing={2} className="items-center justify-between">
                                                        <Typography level="body1" semiBold>
                                                            {index + 1}. {section.component}
                                                        </Typography>
                                                        <Row spacing={1}>
                                                            <Button type="button" variant="plain" disabled={index === 0} onClick={() => setSections((current) => {
                                                                if (index === 0) return current;
                                                                const next = [...current];
                                                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                                                return next;
                                                            })}>Gore</Button>
                                                            <Button type="button" variant="plain" disabled={index === sections.length - 1} onClick={() => setSections((current) => {
                                                                if (index >= current.length - 1) return current;
                                                                const next = [...current];
                                                                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                                                                return next;
                                                            })}>Dolje</Button>
                                                            <Button type="button" variant="plain" color="danger" onClick={() => setSections((current) => current.filter((_, currentIndex) => currentIndex !== index))}>Ukloni</Button>
                                                        </Row>
                                                    </Row>
                                                    <Input
                                                        label="Naslov"
                                                        value={sectionValue(section, 'header')}
                                                        onChange={(event) => {
                                                            const value = event.target.value;
                                                            setSections((current) => current.map((currentSection, currentIndex) => currentIndex === index ? { ...currentSection, header: value } : currentSection));
                                                        }}
                                                    />
                                                    <label className="space-y-1">
                                                        <span className="block text-sm font-medium">
                                                            Opis
                                                        </span>
                                                        <textarea
                                                            value={sectionValue(section, 'description')}
                                                            rows={4}
                                                            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                            onChange={(event) => {
                                                                const value = event.target.value;
                                                                setSections((current) => current.map((currentSection, currentIndex) => currentIndex === index ? { ...currentSection, description: value } : currentSection));
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
                                                setSections((current) => [
                                                    ...current,
                                                    { component: item.value },
                                                ]);
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
