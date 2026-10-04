'use client';

import type {
    CmsPageSectionComponent,
    CmsPageSectionPreset,
} from '@gredice/storage/cmsPageSections';
import { Button } from '@gredice/ui/Button';
import { ButtonGroup, buttonGroupItemClassName } from '@gredice/ui/ButtonGroup';
import {
    type CmsComponentRegistry,
    normalizeCmsPageRenderMaxWidth,
    normalizeCmsSectionRenderMode,
    type SectionData,
    SectionsView,
} from '@gredice/ui/cms';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import {
    Desktop,
    Info,
    Mobile,
    Moon,
    Search,
    Sun,
    Tablet,
} from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useTheme } from 'next-themes';
import { type CSSProperties, useEffect, useState } from 'react';
import {
    type CmsPreviewViewport,
    cmsSectionInfoPreviewViewportClassNames,
    useCmsPreviewViewportSupport,
} from './CmsPreviewViewport';

type CmsPageSectionLibraryProps = {
    query: string;
    components: CmsPageSectionComponent[];
    presets: CmsPageSectionPreset[];
    componentsRegistry: CmsComponentRegistry;
    searchLabel?: string;
    onQueryChange: (query: string) => void;
    onInsertComponent: (component: string) => void;
    onInsertPreset: (preset: CmsPageSectionPreset) => void;
};

type PreviewTheme = 'light' | 'dark';
type PreviewThemeStyle = CSSProperties & Record<`--${string}`, string>;

export type SectionInfoItem = {
    id: string;
    label: string;
    description: string;
    category: string;
    section: SectionData;
    component?: CmsPageSectionComponent;
};

function matchesQuery(
    query: string,
    item: Pick<CmsPageSectionPreset, 'label' | 'description' | 'category'>,
) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return true;
    }

    return [item.label, item.description, item.category].some((value) =>
        value.toLowerCase().includes(normalized),
    );
}

const cmsSectionPreviewAssetUrl = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#f5f5f5"/>
  <rect x="88" y="92" width="784" height="356" rx="32" fill="#ffffff" stroke="#d4d4d8" stroke-width="4"/>
  <rect x="144" y="148" width="420" height="28" rx="14" fill="#101828"/>
  <rect x="144" y="204" width="560" height="18" rx="9" fill="#737373"/>
  <rect x="144" y="244" width="488" height="18" rx="9" fill="#a3a3a3"/>
  <rect x="144" y="316" width="164" height="54" rx="12" fill="#101828"/>
  <circle cx="724" cy="222" r="70" fill="#d4d4d4"/>
  <circle cx="774" cy="316" r="96" fill="#737373"/>
</svg>
`)}`;

const cmsSectionPreviewDarkAssetUrl = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
  <rect width="960" height="540" fill="#0a0a0a"/>
  <rect x="88" y="92" width="784" height="356" rx="32" fill="#111111" stroke="#404040" stroke-width="4"/>
  <rect x="144" y="148" width="420" height="28" rx="14" fill="#f5f5f5"/>
  <rect x="144" y="204" width="560" height="18" rx="9" fill="#a3a3a3"/>
  <rect x="144" y="244" width="488" height="18" rx="9" fill="#737373"/>
  <rect x="144" y="316" width="164" height="54" rx="12" fill="#f5f5f5"/>
  <circle cx="724" cy="222" r="70" fill="#737373"/>
  <circle cx="774" cy="316" r="96" fill="#404040"/>
</svg>
`)}`;

const sectionComponentsWithAssetPreview = new Set([
    'Feature1',
    'Heading1',
    'MediaBlock',
    'PageHeader',
]);

const previewThemeStyles = {
    light: {
        colorScheme: 'light',
        '--background': '0 0% 100%',
        '--foreground': '222.2 47.4% 11.2%',
        '--muted': '210 40% 96.1%',
        '--muted-foreground': '215.4 16.3% 46.9%',
        '--card': '0 0% 100%',
        '--card-foreground': '222.2 47.4% 11.2%',
        '--border': '214.3 31.8% 91.4%',
        '--input': '214.3 31.8% 91.4%',
        '--primary': '222.2 47.4% 11.2%',
        '--primary-foreground': '210 40% 98%',
        '--secondary': '210 40% 96.1%',
        '--secondary-foreground': '222.2 35.4% 35%',
        '--tertiary': '210 40% 80.1%',
        '--tertiary-foreground': '222.2 20% 60%',
        '--accent': '210 40% 96.1%',
        '--accent-foreground': '222.2 47.4% 11.2%',
        '--ring': '215 20.2% 65.1%',
        '--light-display': 'block',
        '--dark-display': 'none',
    },
    dark: {
        colorScheme: 'dark',
        '--background': '0 0% 0%',
        '--foreground': '0 0% 91%',
        '--muted': '0 0% 11%',
        '--muted-foreground': '0 0% 56.9%',
        '--card': '0 0% 10%',
        '--card-foreground': '0 0% 91%',
        '--border': '0 0% 17%',
        '--input': '0 0% 17%',
        '--primary': '0 0% 98%',
        '--primary-foreground': '0 0% 1.2%',
        '--secondary': '0 0% 11.2%',
        '--secondary-foreground': '0 0% 80%',
        '--tertiary': '0 0% 20%',
        '--tertiary-foreground': '0 0% 70%',
        '--accent': '0 0% 17%',
        '--accent-foreground': '0 0% 80%',
        '--ring': '0 0% 17%',
        '--light-display': 'none',
        '--dark-display': 'block',
    },
} satisfies Record<PreviewTheme, PreviewThemeStyle>;

function textValue(value: unknown) {
    return typeof value === 'string' ? value : undefined;
}

function ctaListValue(value: unknown): NonNullable<SectionData['ctas']> {
    if (!Array.isArray(value)) {
        return [];
    }

    const ctas: NonNullable<SectionData['ctas']> = [];

    for (const item of value) {
        if (!item || typeof item !== 'object') {
            continue;
        }

        const label = 'label' in item ? textValue(item.label) : undefined;
        if (!label) {
            continue;
        }

        ctas.push({
            label,
            href: 'href' in item ? (textValue(item.href) ?? '#') : '#',
            iconName: 'iconName' in item ? textValue(item.iconName) : undefined,
            secondary:
                'secondary' in item && typeof item.secondary === 'boolean'
                    ? item.secondary
                    : undefined,
        });
    }

    return ctas;
}

function featureListValue(
    value: unknown,
): NonNullable<SectionData['features']> {
    if (!Array.isArray(value)) {
        return [];
    }

    const features: NonNullable<SectionData['features']> = [];

    for (const item of value) {
        if (!item || typeof item !== 'object') {
            continue;
        }

        features.push({
            component:
                'component' in item ? textValue(item.component) : undefined,
            tagline: 'tagline' in item ? textValue(item.tagline) : undefined,
            header: 'header' in item ? textValue(item.header) : undefined,
            description:
                'description' in item ? textValue(item.description) : undefined,
            assetUrl: 'assetUrl' in item ? textValue(item.assetUrl) : undefined,
            assetDarkUrl:
                'assetDarkUrl' in item
                    ? textValue(item.assetDarkUrl)
                    : undefined,
            assetAlt: 'assetAlt' in item ? textValue(item.assetAlt) : undefined,
            ctas: 'ctas' in item ? ctaListValue(item.ctas) : undefined,
        });
    }

    return features;
}

function previewSectionData(data: CmsPageSectionPreset['data']): SectionData {
    const section: SectionData = {
        component: data.component,
        renderMode: normalizeCmsSectionRenderMode(data.renderMode),
        renderMaxWidth: normalizeCmsPageRenderMaxWidth(data.renderMaxWidth),
        tagline: textValue(data.tagline),
        header: textValue(data.header),
        description: textValue(data.description),
        html: textValue(data.html),
        markdown: textValue(data.markdown),
        assetUrl: textValue(data.assetUrl),
        assetDarkUrl: textValue(data.assetDarkUrl),
        assetAlt: textValue(data.assetAlt),
    };

    const features = featureListValue(data.features);
    if (features.length > 0) {
        section.features = features;
    }

    const ctas = ctaListValue(data.ctas);
    if (ctas.length > 0) {
        section.ctas = ctas;
    }

    if (
        section.component &&
        sectionComponentsWithAssetPreview.has(section.component) &&
        !section.assetUrl
    ) {
        section.assetUrl = cmsSectionPreviewAssetUrl;
        section.assetDarkUrl = cmsSectionPreviewDarkAssetUrl;
        section.assetAlt = 'Section preview';
    }

    return section;
}

function fallbackPreviewSectionData(
    component: CmsPageSectionComponent,
): SectionData {
    const section: SectionData = {
        component: component.component,
        tagline: component.category,
        header: component.label,
        description: component.description,
    };

    if (component.component === 'MarkdownBlock') {
        section.markdown =
            '## Markdown sadržaj\n\nDodaj sadržaj s **formatiranjem**, listama i poveznicama.';
    }

    if (component.component === 'HtmlBlock') {
        section.html =
            '<h2>HTML sadržaj</h2><p>Dodaj provjereni HTML sadržaj koji treba renderirati direktno na stranici.</p>';
    }

    if (
        component.fields.some((field) => field.type === 'feature-list') ||
        component.component === 'Footer1'
    ) {
        section.features = [
            {
                header: 'Prva stavka',
                description: 'Kratki opis stavke.',
            },
            {
                header: 'Druga stavka',
                description: 'Kratki opis stavke.',
            },
            {
                header: 'Treca stavka',
                description: 'Kratki opis stavke.',
            },
        ];
    }

    if (
        component.fields.some((field) => field.type === 'cta-list') ||
        component.component === 'CtaBand'
    ) {
        section.ctas = [
            { label: 'Primarno', href: '#' },
            { label: 'Sekundarno', href: '#', secondary: true },
        ];
    }

    if (sectionComponentsWithAssetPreview.has(component.component)) {
        section.assetUrl = cmsSectionPreviewAssetUrl;
        section.assetDarkUrl = cmsSectionPreviewDarkAssetUrl;
        section.assetAlt = 'Section preview';
    }

    return section;
}

function CmsPageSectionPreviewImage({
    edgeToEdge = false,
    componentsRegistry,
    section,
}: {
    edgeToEdge?: boolean;
    componentsRegistry: CmsComponentRegistry;
    section: SectionData;
}) {
    return (
        <div
            aria-hidden="true"
            className={
                edgeToEdge
                    ? 'pointer-events-none relative h-24 overflow-hidden border-b bg-background'
                    : 'pointer-events-none relative h-24 overflow-hidden rounded-md border bg-background'
            }
            inert
        >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-[1180px] shrink-0 scale-[0.22] text-foreground">
                    <SectionsView
                        componentsRegistry={componentsRegistry}
                        sectionsData={[section]}
                    />
                </div>
            </div>
        </div>
    );
}

export function componentPreviewSectionData(
    component: CmsPageSectionComponent,
    presetPreviewDataByComponent: Map<string, CmsPageSectionPreset['data']>,
) {
    const presetData = presetPreviewDataByComponent.get(component.component);
    return presetData
        ? previewSectionData(presetData)
        : fallbackPreviewSectionData(component);
}

function SectionLibraryItem({
    componentsRegistry,
    description,
    label,
    onInfo,
    onInsert,
    section,
}: {
    componentsRegistry: CmsComponentRegistry;
    description: string;
    label: string;
    onInfo: () => void;
    onInsert: () => void;
    section: SectionData;
}) {
    return (
        <div className="group relative overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
            <button
                type="button"
                className="absolute inset-0 z-10 cursor-pointer rounded-lg outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`Dodaj sekciju: ${label}. ${description}`}
                onClick={onInsert}
            />
            <div className="pointer-events-none">
                <CmsPageSectionPreviewImage
                    componentsRegistry={componentsRegistry}
                    edgeToEdge
                    section={section}
                />
                <span className="block space-y-0.5 p-2 pr-10">
                    <Typography
                        component="span"
                        level="body2"
                        className="block"
                        semiBold
                    >
                        {label}
                    </Typography>
                    <Typography
                        component="span"
                        level="body3"
                        className="line-clamp-2"
                        secondary
                    >
                        {description}
                    </Typography>
                </span>
            </div>
            <IconButton
                aria-label={`Informacije o sekciji: ${label}`}
                className="absolute bottom-2 right-2 z-20 size-7 cursor-pointer rounded-full text-muted-foreground hover:text-foreground"
                size="xs"
                title={`Informacije o sekciji: ${label}`}
                type="button"
                variant="plain"
                onClick={onInfo}
            >
                <Info className="size-4" />
            </IconButton>
        </div>
    );
}

export function SectionInfoModal({
    componentsRegistry,
    item,
    onOpenChange,
}: {
    componentsRegistry: CmsComponentRegistry;
    item: SectionInfoItem | null;
    onOpenChange: (open: boolean) => void;
}) {
    const { resolvedTheme } = useTheme();
    const currentTheme: PreviewTheme =
        resolvedTheme === 'dark' ? 'dark' : 'light';
    const [theme, setTheme] = useState<PreviewTheme>(currentTheme);
    const [viewport, setViewport] = useState<CmsPreviewViewport>('desktop');
    const { containerRef, supportedViewports } = useCmsPreviewViewportSupport(
        viewport,
        setViewport,
        { disabled: !item },
    );

    useEffect(() => {
        if (item) {
            setTheme(currentTheme);
            setViewport('desktop');
        }
    }, [currentTheme, item]);

    return (
        <Modal
            className="max-w-[calc(100vw-2rem)]"
            open={Boolean(item)}
            onOpenChange={onOpenChange}
            title={item ? `Informacije o sekciji: ${item.label}` : 'Sekcija'}
        >
            {item ? (
                <Stack spacing={5}>
                    <Stack spacing={2}>
                        <Typography level="h5">{item.label}</Typography>
                        <Typography level="body2" secondary>
                            {item.description}
                        </Typography>
                        <Typography level="body3" secondary>
                            {item.category}
                            {item.component
                                ? ` · ${item.component.component}`
                                : ''}
                        </Typography>
                    </Stack>

                    <Row spacing={2} className="flex-wrap justify-between">
                        <ButtonGroup legend="Tema previewa" size="sm">
                            <Button
                                type="button"
                                variant={theme === 'light' ? 'solid' : 'plain'}
                                size="sm"
                                className={buttonGroupItemClassName({
                                    iconOnly: true,
                                })}
                                aria-pressed={theme === 'light'}
                                aria-label="Light preview"
                                title="Light preview"
                                onClick={() => setTheme('light')}
                            >
                                <Sun className="size-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={theme === 'dark' ? 'solid' : 'plain'}
                                size="sm"
                                className={buttonGroupItemClassName({
                                    iconOnly: true,
                                })}
                                aria-pressed={theme === 'dark'}
                                aria-label="Dark preview"
                                title="Dark preview"
                                onClick={() => setTheme('dark')}
                            >
                                <Moon className="size-4" />
                            </Button>
                        </ButtonGroup>

                        <ButtonGroup legend="Veličina previewa" size="sm">
                            <Button
                                type="button"
                                variant={
                                    viewport === 'mobile' ? 'solid' : 'plain'
                                }
                                size="sm"
                                className={buttonGroupItemClassName({
                                    iconOnly: true,
                                })}
                                aria-pressed={viewport === 'mobile'}
                                aria-label="Mobile preview"
                                title="Mobile preview"
                                onClick={() => setViewport('mobile')}
                            >
                                <Mobile className="size-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={
                                    viewport === 'tablet' ? 'solid' : 'plain'
                                }
                                size="sm"
                                className={buttonGroupItemClassName({
                                    iconOnly: true,
                                })}
                                aria-pressed={viewport === 'tablet'}
                                aria-label="Tablet preview"
                                title="Tablet preview"
                                disabled={!supportedViewports.tablet}
                                onClick={() => setViewport('tablet')}
                            >
                                <Tablet className="size-4" />
                            </Button>
                            <Button
                                type="button"
                                variant={
                                    viewport === 'desktop' ? 'solid' : 'plain'
                                }
                                size="sm"
                                className={buttonGroupItemClassName({
                                    iconOnly: true,
                                })}
                                aria-pressed={viewport === 'desktop'}
                                aria-label="Desktop preview"
                                title="Desktop preview"
                                disabled={!supportedViewports.desktop}
                                onClick={() => setViewport('desktop')}
                            >
                                <Desktop className="size-4" />
                            </Button>
                        </ButtonGroup>
                    </Row>

                    <div
                        className={`max-h-[60vh] overflow-auto rounded-lg border bg-muted/20 p-4 ${
                            theme === 'dark' ? 'dark' : ''
                        }`}
                        style={previewThemeStyles[theme]}
                    >
                        <div ref={containerRef} className="min-w-0">
                            <div
                                className={`mx-auto w-full ${cmsSectionInfoPreviewViewportClassNames[viewport]} bg-background text-foreground`}
                            >
                                <SectionsView
                                    componentsRegistry={componentsRegistry}
                                    sectionsData={[item.section]}
                                />
                            </div>
                        </div>
                    </div>

                    {item.component?.fields.length ? (
                        <Stack spacing={2}>
                            <Typography level="body2" semiBold>
                                Polja
                            </Typography>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {item.component.fields.map((field) => (
                                    <div
                                        className="rounded-md border bg-muted/20 p-2"
                                        key={field.key}
                                    >
                                        <Typography level="body3" semiBold>
                                            {field.label}
                                        </Typography>
                                        <Typography level="body3" secondary>
                                            {field.type}
                                            {field.required
                                                ? ' · obavezno'
                                                : ''}
                                        </Typography>
                                    </div>
                                ))}
                            </div>
                        </Stack>
                    ) : null}
                </Stack>
            ) : null}
        </Modal>
    );
}

export function CmsPageSectionLibrary({
    query,
    components,
    presets,
    componentsRegistry,
    searchLabel = 'Biblioteka',
    onQueryChange,
    onInsertComponent,
    onInsertPreset,
}: CmsPageSectionLibraryProps) {
    const [infoItem, setInfoItem] = useState<SectionInfoItem | null>(null);
    const visiblePresets = presets.filter((preset) =>
        matchesQuery(query, preset),
    );
    const visibleComponents = components.filter((component) =>
        matchesQuery(query, component),
    );
    const groupedPresets = visiblePresets.reduce<
        Record<string, CmsPageSectionPreset[]>
    >((groups, preset) => {
        if (!groups[preset.category]) {
            groups[preset.category] = [];
        }
        groups[preset.category].push(preset);
        return groups;
    }, {});
    const presetPreviewDataByComponent = new Map(
        presets.map((preset) => [preset.data.component, preset.data]),
    );
    const componentsByName = new Map(
        components.map((component) => [component.component, component]),
    );

    return (
        <Stack spacing={4}>
            <Input
                fullWidth
                label={searchLabel}
                placeholder="Pretraži sekcije"
                startDecorator={<Search className="ml-3 size-4 shrink-0" />}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
            />
            <Stack spacing={3}>
                {Object.entries(groupedPresets).map(([category, items]) => (
                    <Stack spacing={2} key={category}>
                        <Typography level="body3" secondary>
                            {category}
                        </Typography>
                        {items.map((preset) => {
                            const section = previewSectionData(preset.data);
                            const component = componentsByName.get(
                                preset.data.component,
                            );
                            return (
                                <SectionLibraryItem
                                    componentsRegistry={componentsRegistry}
                                    description={preset.description}
                                    key={preset.id}
                                    label={preset.label}
                                    onInfo={() =>
                                        setInfoItem({
                                            id: preset.id,
                                            label: preset.label,
                                            description: preset.description,
                                            category: preset.category,
                                            section,
                                            component,
                                        })
                                    }
                                    onInsert={() => onInsertPreset(preset)}
                                    section={section}
                                />
                            );
                        })}
                    </Stack>
                ))}
            </Stack>
            <Stack spacing={2}>
                <Typography level="body3" secondary>
                    Prazne komponente
                </Typography>
                {visibleComponents.map((component) => {
                    const section = componentPreviewSectionData(
                        component,
                        presetPreviewDataByComponent,
                    );
                    return (
                        <SectionLibraryItem
                            componentsRegistry={componentsRegistry}
                            description={component.description}
                            key={component.component}
                            label={component.label}
                            onInfo={() =>
                                setInfoItem({
                                    id: component.component,
                                    label: component.label,
                                    description: component.description,
                                    category: component.category,
                                    section,
                                    component,
                                })
                            }
                            onInsert={() =>
                                onInsertComponent(component.component)
                            }
                            section={section}
                        />
                    );
                })}
            </Stack>
            <SectionInfoModal
                componentsRegistry={componentsRegistry}
                item={infoItem}
                onOpenChange={(open) => {
                    if (!open) {
                        setInfoItem(null);
                    }
                }}
            />
        </Stack>
    );
}
