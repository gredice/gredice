import { slugify } from '@gredice/js/slug';
import { createElement, type ExoticComponent, type ReactNode } from 'react';
import { Accordion } from '../Accordion';
import { Button } from '../Button';
import { Card } from '../Card';
import { Container, type ContainerProps } from '../Container';
import { Divider } from '../Divider';
import {
    Comment,
    CompanyFacebook,
    CompanyGitHub,
    CompanyReddit,
    CompanyX,
    Droplets,
    Globe,
    Leaf,
    Link,
    Mail,
    MapPin,
    Security,
    Sprout,
    Success,
    Warning,
} from '../icons';
import { Markdown } from '../Markdown';
import { Stack } from '../Stack';
import { StyledHtml } from '../StyledHtml';
import { Table } from '../Table';
import { Typography } from '../Typography';
import { cx } from '../utils';

const cmsSectionContainerClassName = '@container/cms w-full';

export type CmsPageRenderMode = 'container' | 'fullWidth';
export type CmsSectionRenderMode = 'inherit' | CmsPageRenderMode;
export type CmsPageRenderMaxWidth = Exclude<
    NonNullable<ContainerProps['maxWidth']>,
    false
>;

export type CmsPageRenderLayout = {
    renderMode?: CmsPageRenderMode;
    renderMaxWidth?: CmsPageRenderMaxWidth;
};

export type CmsPageContentDocument = CmsPageRenderLayout & {
    sectionsData: SectionData[];
};

const defaultCmsPageRenderMode: CmsPageRenderMode = 'container';
const defaultCmsPageRenderMaxWidth: CmsPageRenderMaxWidth = 'lg';
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

export type SectionData = {
    id?: string;
    component?: string;
    renderMode?: CmsSectionRenderMode;
    renderMaxWidth?: CmsPageRenderMaxWidth;
    __cmsResolvedRenderMode?: CmsPageRenderMode;
    __cmsResolvedRenderMaxWidth?: CmsPageRenderMaxWidth;
    tagline?: string;
    header?: string;
    description?: ReactNode;
    html?: string;
    markdown?: string;
    asset?: ReactNode;
    assetUrl?: string;
    assetDarkUrl?: string;
    assetAlt?: string;
    iconName?: string;
    features?: SectionData[];
    ctas?: {
        label: string;
        href: string;
        icon?: ReactNode;
        iconName?: string;
        secondary?: boolean;
    }[];
};

export type CmsComponentRegistry = {
    [key: string]:
        | ExoticComponent<SectionData>
        | ((props: SectionData) => ReactNode);
};

export type CmsSectionsViewProps = {
    sectionsData: SectionData[];
    componentsRegistry: CmsComponentRegistry;
    renderMode?: CmsPageRenderMode;
    renderMaxWidth?: CmsPageRenderMaxWidth;
    debug?: boolean;
};

function isSectionData(section: unknown): section is SectionData {
    return (
        section !== null &&
        typeof section === 'object' &&
        'component' in section &&
        typeof section.component === 'string'
    );
}

export function parseSectionData(value: unknown): SectionData[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter(isSectionData);
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

export function parseCmsPageContentDocument(
    value: unknown,
): CmsPageContentDocument {
    if (Array.isArray(value)) {
        return {
            renderMode: defaultCmsPageRenderMode,
            renderMaxWidth: defaultCmsPageRenderMaxWidth,
            sectionsData: parseSectionData(value),
        };
    }

    if (isRecord(value)) {
        return {
            renderMode: normalizeCmsPageRenderMode(value.renderMode),
            renderMaxWidth: normalizeCmsPageRenderMaxWidth(
                value.renderMaxWidth,
            ),
            sectionsData: parseSectionData(value.sections),
        };
    }

    return {
        renderMode: defaultCmsPageRenderMode,
        renderMaxWidth: defaultCmsPageRenderMaxWidth,
        sectionsData: [],
    };
}

export function parseCmsPageContentJson(value: string | null | undefined) {
    if (!value) {
        return parseCmsPageContentDocument([]);
    }

    try {
        return parseCmsPageContentDocument(JSON.parse(value));
    } catch {
        return parseCmsPageContentDocument([]);
    }
}

export function parseSectionDataJson(value: string | null | undefined) {
    if (!value) {
        return [];
    }

    try {
        return parseSectionData(JSON.parse(value));
    } catch {
        return [];
    }
}

function sectionId(value: string | undefined) {
    return value ? slugify(value) : undefined;
}

function sectionKey(section: SectionData) {
    const description =
        typeof section.description === 'string' ? section.description : '';
    return [
        section.id,
        section.component ?? 'section',
        section.header,
        section.tagline,
        description,
    ]
        .filter(Boolean)
        .map((part) => slugify(String(part)))
        .join('-');
}

function DescriptionBlock({
    className,
    description,
    header,
    tagline,
}: Pick<SectionData, 'description' | 'header' | 'tagline'> & {
    className?: string;
}) {
    return (
        <Stack spacing={4} className={className}>
            {tagline && (
                <Typography tertiary semiBold>
                    {tagline}
                </Typography>
            )}
            {header && (
                <Typography level="h2" id={sectionId(header)}>
                    {header}
                </Typography>
            )}
            {typeof description === 'string' ? (
                <Typography component="p" className="text-pretty">
                    {description}
                </Typography>
            ) : (
                description
            )}
        </Stack>
    );
}

function AssetBlock({
    asset,
    assetAlt,
    assetDarkUrl,
    assetUrl,
}: Pick<SectionData, 'asset' | 'assetAlt' | 'assetDarkUrl' | 'assetUrl'>) {
    if (asset) {
        return <div>{asset}</div>;
    }

    if (!assetUrl) {
        return null;
    }

    return (
        <div className="flex max-w-full justify-center overflow-hidden rounded-lg border bg-muted/20">
            <CmsMediaImage
                alt={assetAlt ?? ''}
                className="h-auto w-full object-contain"
                darkSrc={assetDarkUrl}
                src={assetUrl}
            />
        </div>
    );
}

export function CmsMediaImage({
    alt,
    className,
    darkSrc,
    src,
}: {
    alt?: string;
    className?: string;
    darkSrc?: string;
    src: string;
}) {
    if (!darkSrc) {
        return (
            // biome-ignore lint/performance/noImgElement: CMS image URLs are remote and not known at build time.
            <img alt={alt ?? ''} className={cx('block', className)} src={src} />
        );
    }

    return (
        <>
            {/** biome-ignore lint/performance/noImgElement: CMS image URLs are remote and not known at build time. */}
            <img
                alt={alt ?? ''}
                className={cx('image--light block', className)}
                src={src}
            />
            {/** biome-ignore lint/performance/noImgElement: CMS image URLs are remote and not known at build time. */}
            <img
                alt={alt ?? ''}
                className={cx('image--dark block', className)}
                src={darkSrc}
            />
        </>
    );
}

function IconName({
    className = 'size-4',
    name,
}: {
    className?: string;
    name: string;
}) {
    const normalized = name.trim().toLowerCase();

    if (!normalized) {
        return null;
    }

    switch (normalized) {
        case 'deviation':
        case 'warning':
            return <Warning className={className} />;
        case 'harvest':
        case 'sort':
            return <Success className={className} />;
        case 'hygiene':
        case 'security':
            return <Security className={className} />;
        case 'inputs':
        case 'sprout':
            return <Sprout className={className} />;
        case 'leaf':
            return <Leaf className={className} />;
        case 'location':
        case 'map-pin':
            return <MapPin className={className} />;
        case 'trace':
        case 'traceability':
            return <Link className={className} />;
        case 'water':
            return <Droplets className={className} />;
        case 'facebook':
            return <CompanyFacebook className={className} />;
        case 'github':
            return <CompanyGitHub className={className} />;
        case 'instagram':
        case 'link':
            return <Globe className={className} />;
        case 'mail':
            return <Mail className={className} />;
        case 'reddit':
            return <CompanyReddit className={className} />;
        case 'whatsapp':
            return <Comment className={className} />;
        case 'x':
            return <CompanyX className={className} />;
        default:
            break;
    }

    return (
        <span className="text-xs font-semibold uppercase tracking-normal">
            {normalized.slice(0, 2)}
        </span>
    );
}

function ctaIcon(cta: NonNullable<SectionData['ctas']>[number]) {
    if (cta.icon) {
        return cta.icon;
    }

    if (!cta.iconName) {
        return null;
    }

    return <IconName name={cta.iconName} />;
}

function Ctas({ ctas }: { ctas: SectionData['ctas'] }) {
    if (!ctas?.length) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-3">
            {ctas.map((cta) => (
                <Button
                    color={cta.secondary ? 'secondary' : 'primary'}
                    href={cta.href}
                    key={cta.label}
                    startDecorator={ctaIcon(cta)}
                    variant={cta.secondary ? 'outlined' : 'solid'}
                >
                    {cta.label}
                </Button>
            ))}
        </div>
    );
}

function FeatureItem({
    asset,
    assetAlt,
    assetDarkUrl,
    assetUrl,
    description,
    header,
    iconName,
}: SectionData) {
    const content = (
        <Stack spacing={4}>
            <AssetBlock
                asset={asset}
                assetAlt={assetAlt}
                assetDarkUrl={assetDarkUrl}
                assetUrl={assetUrl}
            />
            {header && (
                <Typography level="h3" id={sectionId(header)} semiBold>
                    {header}
                </Typography>
            )}
            {typeof description === 'string' ? (
                <Typography className="text-pretty">{description}</Typography>
            ) : (
                description
            )}
        </Stack>
    );

    if (!iconName) {
        return content;
    }

    return (
        <div className="flex gap-4">
            <span className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-md border bg-card text-primary">
                <IconName className="size-5" name={iconName} />
            </span>
            <div className="min-w-0">{content}</div>
        </div>
    );
}

export function SectionsView({
    componentsRegistry,
    debug,
    renderMaxWidth,
    renderMode,
    sectionsData,
}: CmsSectionsViewProps) {
    const sectionKeyCounts = new Map<string, number>();
    const pageRenderMode = normalizeCmsPageRenderMode(renderMode);
    const pageRenderMaxWidth = normalizeCmsPageRenderMaxWidth(renderMaxWidth);

    return (
        <div className={cmsSectionContainerClassName}>
            {sectionsData.map((section) => {
                const baseSectionKey = sectionKey(section) || 'section';
                const occurrence = sectionKeyCounts.get(baseSectionKey) ?? 0;
                sectionKeyCounts.set(baseSectionKey, occurrence + 1);
                const key =
                    occurrence === 0
                        ? baseSectionKey
                        : `${baseSectionKey}-${occurrence}`;
                const Component = section.component
                    ? componentsRegistry[section.component]
                    : null;

                if (Component) {
                    const sectionRenderMode = normalizeCmsSectionRenderMode(
                        section.renderMode,
                    );
                    const resolvedRenderMode =
                        sectionRenderMode === 'inherit'
                            ? pageRenderMode
                            : sectionRenderMode;
                    const resolvedRenderMaxWidth =
                        sectionRenderMode === 'container'
                            ? normalizeCmsPageRenderMaxWidth(
                                  section.renderMaxWidth,
                              )
                            : pageRenderMaxWidth;

                    return createElement(Component, {
                        ...section,
                        __cmsResolvedRenderMode: resolvedRenderMode,
                        __cmsResolvedRenderMaxWidth: resolvedRenderMaxWidth,
                        key,
                    });
                }

                if (!debug) {
                    return null;
                }

                return (
                    <div
                        className="rounded-lg border border-red-400 bg-red-100 p-4 text-red-700"
                        key={key}
                        role="alert"
                    >
                        <Typography className="text-base font-semibold">
                            Component <code>{section.component}</code> not found
                        </Typography>
                        <pre>{JSON.stringify(section, null, 2)}</pre>
                    </div>
                );
            })}
        </div>
    );
}

function CmsSectionContainer({ children }: { children: ReactNode }) {
    return <div className={cmsSectionContainerClassName}>{children}</div>;
}

function CmsSectionContent({
    children,
    className,
    section,
}: {
    children: ReactNode;
    className?: string;
    section: SectionData;
}) {
    const renderMode =
        section.__cmsResolvedRenderMode ?? defaultCmsPageRenderMode;
    const renderMaxWidth =
        section.__cmsResolvedRenderMaxWidth ?? defaultCmsPageRenderMaxWidth;

    if (renderMode === 'fullWidth') {
        return <div className={cx('w-full', className)}>{children}</div>;
    }

    return (
        <Container className={className} maxWidth={renderMaxWidth}>
            {children}
        </Container>
    );
}

export function Heading1(props: SectionData) {
    const {
        asset,
        assetAlt,
        assetDarkUrl,
        assetUrl,
        ctas,
        description,
        header,
        tagline,
    } = props;

    return (
        <CmsSectionContainer>
            <section className="@[64rem]/cms:my-12 @[48rem]/cms:my-8 @[80rem]/cms:my-24">
                <CmsSectionContent section={props}>
                    <Stack spacing={10}>
                        <Stack spacing={2}>
                            {tagline && (
                                <Typography tertiary semiBold>
                                    {tagline}
                                </Typography>
                            )}
                            <Stack spacing={8}>
                                {header && (
                                    <Typography
                                        level="h1"
                                        id={sectionId(header)}
                                    >
                                        {header}
                                    </Typography>
                                )}
                                {typeof description === 'string' ? (
                                    <Typography
                                        component="p"
                                        className="text-pretty"
                                    >
                                        {description}
                                    </Typography>
                                ) : (
                                    description
                                )}
                            </Stack>
                        </Stack>
                        <Ctas ctas={ctas} />
                    </Stack>
                    <AssetBlock
                        asset={asset}
                        assetAlt={assetAlt}
                        assetDarkUrl={assetDarkUrl}
                        assetUrl={assetUrl}
                    />
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function Feature1(props: SectionData) {
    const {
        asset,
        assetAlt,
        assetDarkUrl,
        assetUrl,
        ctas,
        description,
        features,
        header,
        tagline,
    } = props;

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent
                    className="grid gap-10 @[64rem]/cms:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @[64rem]/cms:items-start"
                    section={props}
                >
                    <Stack spacing={16}>
                        <DescriptionBlock
                            description={description}
                            header={header}
                            tagline={tagline}
                        />
                        <Ctas ctas={ctas} />
                        <AssetBlock
                            asset={asset}
                            assetAlt={assetAlt}
                            assetDarkUrl={assetDarkUrl}
                            assetUrl={assetUrl}
                        />
                    </Stack>
                    {features?.length ? (
                        <div className="flex flex-col gap-8">
                            {features.map((feature) => (
                                <FeatureItem
                                    {...feature}
                                    key={sectionKey(feature)}
                                />
                            ))}
                        </div>
                    ) : null}
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function TextBlock(props: SectionData) {
    const { ctas, description, header, tagline } = props;

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <Stack spacing={8}>
                        <DescriptionBlock
                            description={description}
                            header={header}
                            tagline={tagline}
                        />
                        <Ctas ctas={ctas} />
                    </Stack>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function MarkdownBlock(props: SectionData) {
    const { markdown } = props;
    const content = markdown?.trim();

    if (!content) {
        return null;
    }

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <Markdown>{content}</Markdown>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function HtmlBlock(props: SectionData) {
    const { html } = props;
    const content = html?.trim();

    if (!content) {
        return null;
    }

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <StyledHtml html={content} />
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function MediaBlock(props: SectionData) {
    const {
        asset,
        assetAlt,
        assetDarkUrl,
        assetUrl,
        ctas,
        description,
        header,
        tagline,
    } = props;

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent
                    className="grid gap-10 @[64rem]/cms:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] @[64rem]/cms:items-center"
                    section={props}
                >
                    <Stack spacing={8}>
                        <DescriptionBlock
                            description={description}
                            header={header}
                            tagline={tagline}
                        />
                        <Ctas ctas={ctas} />
                    </Stack>
                    <AssetBlock
                        asset={asset}
                        assetAlt={assetAlt}
                        assetDarkUrl={assetDarkUrl}
                        assetUrl={assetUrl}
                    />
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function CardGrid(props: SectionData) {
    const { ctas, description, features, header, tagline } = props;

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <Stack spacing={8}>
                        <div className="flex flex-col gap-6 @[48rem]/cms:flex-row @[48rem]/cms:items-end @[48rem]/cms:justify-between">
                            <DescriptionBlock
                                className="max-w-3xl"
                                description={description}
                                header={header}
                                tagline={tagline}
                            />
                            <Ctas ctas={ctas} />
                        </div>
                        {features?.length ? (
                            <div
                                className={cx(
                                    'grid gap-4 @[48rem]/cms:grid-cols-2',
                                    features.length >= 3 &&
                                        '@[64rem]/cms:grid-cols-3',
                                )}
                            >
                                {features.map((feature) => (
                                    <Stack
                                        className="rounded-lg border bg-card p-5"
                                        key={sectionKey(feature) || 'card'}
                                        spacing={3}
                                    >
                                        {feature.header && (
                                            <Typography
                                                level="h5"
                                                id={sectionId(feature.header)}
                                                semiBold
                                            >
                                                {feature.header}
                                            </Typography>
                                        )}
                                        {typeof feature.description ===
                                        'string' ? (
                                            <Typography
                                                className="text-pretty"
                                                level="body2"
                                            >
                                                {feature.description}
                                            </Typography>
                                        ) : (
                                            feature.description
                                        )}
                                    </Stack>
                                ))}
                            </div>
                        ) : null}
                    </Stack>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function MetricGrid(props: SectionData) {
    const { ctas, description, features, header, tagline } = props;

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <Stack spacing={8}>
                        <div className="flex flex-col gap-6 @[48rem]/cms:flex-row @[48rem]/cms:items-end @[48rem]/cms:justify-between">
                            <DescriptionBlock
                                className="max-w-3xl"
                                description={description}
                                header={header}
                                tagline={tagline}
                            />
                            <Ctas ctas={ctas} />
                        </div>
                        {features?.length ? (
                            <div
                                className={cx(
                                    'grid gap-4 @[48rem]/cms:grid-cols-2',
                                    features.length >= 3 &&
                                        '@[64rem]/cms:grid-cols-3',
                                )}
                            >
                                {features.map((feature) => (
                                    <Stack
                                        className="rounded-lg border bg-card p-5"
                                        key={sectionKey(feature) || 'metric'}
                                        spacing={3}
                                    >
                                        {feature.tagline && (
                                            <Typography tertiary semiBold>
                                                {feature.tagline}
                                            </Typography>
                                        )}
                                        {feature.header && (
                                            <Typography
                                                level="h3"
                                                component="p"
                                                className="text-pretty"
                                            >
                                                {feature.header}
                                            </Typography>
                                        )}
                                        {typeof feature.description ===
                                        'string' ? (
                                            <Typography
                                                className="text-pretty"
                                                level="body2"
                                                secondary
                                            >
                                                {feature.description}
                                            </Typography>
                                        ) : (
                                            feature.description
                                        )}
                                    </Stack>
                                ))}
                            </div>
                        ) : null}
                    </Stack>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function StepList(props: SectionData) {
    const { ctas, description, features, header, tagline } = props;

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <Stack spacing={8}>
                        <div className="flex flex-col gap-6 @[48rem]/cms:flex-row @[48rem]/cms:items-end @[48rem]/cms:justify-between">
                            <DescriptionBlock
                                className="max-w-3xl"
                                description={description}
                                header={header}
                                tagline={tagline}
                            />
                            <Ctas ctas={ctas} />
                        </div>
                        {features?.length ? (
                            <div className="grid gap-4 @[64rem]/cms:grid-cols-3">
                                {features.map((feature, index) => (
                                    <div
                                        className="rounded-lg border bg-card p-5"
                                        key={
                                            sectionKey(feature) ||
                                            `step-${index}`
                                        }
                                    >
                                        <Stack spacing={4}>
                                            <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                                                {index + 1}
                                            </span>
                                            {feature.header && (
                                                <Typography
                                                    level="h5"
                                                    id={sectionId(
                                                        feature.header,
                                                    )}
                                                    semiBold
                                                >
                                                    {feature.header}
                                                </Typography>
                                            )}
                                            {typeof feature.description ===
                                            'string' ? (
                                                <Typography
                                                    className="text-pretty"
                                                    level="body2"
                                                    secondary
                                                >
                                                    {feature.description}
                                                </Typography>
                                            ) : (
                                                feature.description
                                            )}
                                        </Stack>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </Stack>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function DataTable(props: SectionData) {
    const { description, features, header, tagline } = props;
    const hasCategoryColumn = features?.some((feature) => feature.tagline);

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <Stack spacing={8}>
                        <DescriptionBlock
                            className="max-w-3xl"
                            description={description}
                            header={header}
                            tagline={tagline}
                        />
                        {features?.length ? (
                            <div className="overflow-hidden rounded-lg border bg-card">
                                <Table>
                                    <Table.Header>
                                        <Table.Row className="hover:bg-transparent">
                                            <Table.Head>Naziv</Table.Head>
                                            {hasCategoryColumn && (
                                                <Table.Head>Oznaka</Table.Head>
                                            )}
                                            <Table.Head>Opis</Table.Head>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {features.map((feature) => (
                                            <Table.Row
                                                key={
                                                    sectionKey(feature) ||
                                                    'data-row'
                                                }
                                            >
                                                <Table.Cell className="font-medium">
                                                    {feature.header}
                                                </Table.Cell>
                                                {hasCategoryColumn && (
                                                    <Table.Cell className="text-muted-foreground">
                                                        {feature.tagline}
                                                    </Table.Cell>
                                                )}
                                                <Table.Cell>
                                                    {typeof feature.description ===
                                                    'string' ? (
                                                        <span>
                                                            {
                                                                feature.description
                                                            }
                                                        </span>
                                                    ) : (
                                                        feature.description
                                                    )}
                                                </Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table>
                            </div>
                        ) : null}
                    </Stack>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function GalleryGrid(props: SectionData) {
    const { description, features, header, tagline } = props;
    const mediaItems = features?.filter(
        (feature) => feature.asset || feature.assetUrl,
    );

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <Stack spacing={8}>
                        {(header || description || tagline) && (
                            <DescriptionBlock
                                className="max-w-3xl"
                                description={description}
                                header={header}
                                tagline={tagline}
                            />
                        )}
                        {mediaItems?.length ? (
                            <div
                                className={cx(
                                    'grid gap-4 @[48rem]/cms:grid-cols-2',
                                    mediaItems.length >= 3 &&
                                        '@[64rem]/cms:grid-cols-3',
                                )}
                            >
                                {mediaItems.map((feature) => (
                                    <figure
                                        className="overflow-hidden rounded-lg border bg-card"
                                        key={sectionKey(feature) || 'image'}
                                    >
                                        {feature.asset ? (
                                            <div>{feature.asset}</div>
                                        ) : feature.assetUrl ? (
                                            <CmsMediaImage
                                                alt={feature.assetAlt ?? ''}
                                                className="aspect-[4/3] h-full w-full object-cover"
                                                darkSrc={feature.assetDarkUrl}
                                                src={feature.assetUrl}
                                            />
                                        ) : null}
                                        {(feature.header ||
                                            feature.description) && (
                                            <figcaption className="space-y-1 p-4">
                                                {feature.header && (
                                                    <Typography
                                                        level="body2"
                                                        semiBold
                                                    >
                                                        {feature.header}
                                                    </Typography>
                                                )}
                                                {typeof feature.description ===
                                                'string' ? (
                                                    <Typography
                                                        level="body3"
                                                        secondary
                                                    >
                                                        {feature.description}
                                                    </Typography>
                                                ) : (
                                                    feature.description
                                                )}
                                            </figcaption>
                                        )}
                                    </figure>
                                ))}
                            </div>
                        ) : null}
                    </Stack>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function CalloutBlock(props: SectionData) {
    const { ctas, description, header, tagline } = props;

    return (
        <CmsSectionContainer>
            <section className="py-8">
                <CmsSectionContent section={props}>
                    <Card className="border-primary/20 bg-card p-5 shadow-sm @[48rem]/cms:p-6">
                        <Stack spacing={5}>
                            <DescriptionBlock
                                description={description}
                                header={header}
                                tagline={tagline}
                            />
                            <Ctas ctas={ctas} />
                        </Stack>
                    </Card>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function EmbedBlock(props: SectionData) {
    const { assetAlt, assetUrl, description, header, tagline } = props;
    const src = assetUrl?.trim();

    if (!src) {
        return null;
    }

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <Stack spacing={8}>
                        {(header || description || tagline) && (
                            <DescriptionBlock
                                className="max-w-3xl"
                                description={description}
                                header={header}
                                tagline={tagline}
                            />
                        )}
                        <div className="overflow-hidden rounded-lg border bg-card">
                            <div className="aspect-video w-full">
                                <iframe
                                    title={
                                        assetAlt ??
                                        (typeof header === 'string'
                                            ? header
                                            : 'Ugrađeni prikaz')
                                    }
                                    src={src}
                                    className="h-full w-full border-0"
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
                                />
                            </div>
                        </div>
                    </Stack>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function CtaBand(props: SectionData) {
    const { ctas, description, header, tagline } = props;

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent section={props}>
                    <Card className="bg-card p-6 shadow-sm @[48rem]/cms:p-10">
                        <div className="grid gap-6 @[64rem]/cms:grid-cols-[minmax(0,1fr)_auto] @[64rem]/cms:items-end">
                            <DescriptionBlock
                                className="max-w-3xl"
                                description={description}
                                header={header}
                                tagline={tagline}
                            />
                            <Ctas ctas={ctas} />
                        </div>
                    </Card>
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

export function Faq1(props: SectionData) {
    const { ctas, description, features, header, tagline } = props;

    return (
        <CmsSectionContainer>
            <section className="py-12">
                <CmsSectionContent
                    className="grid gap-8 @[64rem]/cms:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
                    section={props}
                >
                    <Stack spacing={12}>
                        <DescriptionBlock
                            description={description}
                            header={header}
                            tagline={tagline}
                        />
                        <Ctas ctas={ctas} />
                    </Stack>
                    {features?.length ? (
                        <div className="flex flex-col gap-2">
                            {features.map((feature, index) => (
                                <div key={sectionKey(feature)}>
                                    {index > 0 && <Divider />}
                                    <Accordion defaultOpen variant="plain">
                                        <Typography semiBold>
                                            {feature.header}
                                        </Typography>
                                        {typeof feature.description ===
                                        'string' ? (
                                            <Typography component="p">
                                                {feature.description}
                                            </Typography>
                                        ) : (
                                            feature.description
                                        )}
                                    </Accordion>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </CmsSectionContent>
            </section>
        </CmsSectionContainer>
    );
}

function FooterSocialLinks({ ctas }: { ctas: SectionData['ctas'] }) {
    if (!ctas?.length) {
        return null;
    }

    return (
        <div className="flex flex-wrap justify-center gap-1 @[48rem]/cms:justify-start">
            {ctas.map((cta) => (
                <a
                    aria-label={cta.label}
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&>svg]:size-5 [&>svg]:shrink-0"
                    href={cta.href}
                    key={cta.label}
                >
                    {ctaIcon(cta) ?? (
                        <span className="text-xs font-medium">{cta.label}</span>
                    )}
                </a>
            ))}
        </div>
    );
}

export function Footer1(props: SectionData) {
    const { asset, ctas, features, tagline } = props;
    const linkGroups = features?.filter(
        (feature) => feature.ctas?.length && feature.tagline !== 'SystemStatus',
    );
    const systemStatus = features?.find(
        (feature) => feature.tagline === 'SystemStatus',
    );

    return (
        <CmsSectionContainer>
            <footer className="self-stretch">
                <CmsSectionContent className="pb-8 pt-16" section={props}>
                    <Stack spacing={8}>
                        {linkGroups?.length ? (
                            <div
                                className={cx(
                                    'grid grid-cols-1 gap-8 @[48rem]/cms:grid-cols-2',
                                    linkGroups.length === 3 &&
                                        '@[64rem]/cms:grid-cols-3',
                                    linkGroups.length >= 4 &&
                                        '@[64rem]/cms:grid-cols-4',
                                )}
                            >
                                {linkGroups.map((feature) => (
                                    <Stack
                                        className="min-w-[220px]"
                                        key={feature.header}
                                        spacing={8}
                                    >
                                        <Typography component="h2" level="h6">
                                            {feature.header}
                                        </Typography>
                                        <Stack spacing={3}>
                                            {feature.ctas?.map((cta) => (
                                                <a
                                                    href={cta.href}
                                                    key={cta.label}
                                                >
                                                    <Typography
                                                        className="text-muted-foreground hover:text-foreground/80"
                                                        level="body2"
                                                    >
                                                        {cta.label}
                                                    </Typography>
                                                </a>
                                            ))}
                                        </Stack>
                                    </Stack>
                                ))}
                            </div>
                        ) : null}
                        <div className="flex flex-col items-center gap-4 @[48rem]/cms:flex-row @[48rem]/cms:justify-between">
                            <Stack
                                alignItems="center"
                                className="@[48rem]/cms:items-start"
                            >
                                {asset}
                            </Stack>
                            <FooterSocialLinks ctas={ctas} />
                        </div>
                        <Divider />
                        <div className="flex flex-col items-center gap-8 text-center @[48rem]/cms:flex-row @[48rem]/cms:justify-between">
                            <div>{systemStatus?.asset}</div>
                            <Typography level="body3">
                                {`© ${new Date().getFullYear()} ${tagline}. Sva prava pridržana.`}
                            </Typography>
                        </div>
                    </Stack>
                </CmsSectionContent>
            </footer>
        </CmsSectionContainer>
    );
}
