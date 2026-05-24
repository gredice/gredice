import { slugify } from '@gredice/js/slug';
import { createElement, type ExoticComponent, type ReactNode } from 'react';
import { Accordion } from '../Accordion';
import { Button } from '../Button';
import { Container } from '../Container';
import { Divider } from '../Divider';
import {
    Comment,
    CompanyFacebook,
    CompanyGitHub,
    CompanyReddit,
    CompanyX,
    Globe,
    Mail,
} from '../icons';
import { Stack } from '../Stack';
import { Typography } from '../Typography';
import { cx } from '../utils';

export type SectionData = {
    component?: string;
    tagline?: string;
    header?: string;
    description?: ReactNode;
    asset?: ReactNode;
    assetUrl?: string;
    assetAlt?: string;
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
    assetUrl,
}: Pick<SectionData, 'asset' | 'assetAlt' | 'assetUrl'>) {
    if (asset) {
        return <div>{asset}</div>;
    }

    if (!assetUrl) {
        return null;
    }

    return (
        <div className="overflow-hidden rounded-lg border bg-muted/20">
            {/** biome-ignore lint/performance/noImgElement: CMS image URLs are remote and not known at build time. */}
            <img
                alt={assetAlt ?? ''}
                className="h-auto w-full object-cover"
                src={assetUrl}
            />
        </div>
    );
}

function IconName({ name }: { name: string }) {
    const normalized = name.trim().toLowerCase();

    if (!normalized) {
        return null;
    }

    switch (normalized) {
        case 'facebook':
            return <CompanyFacebook className="size-4" />;
        case 'github':
            return <CompanyGitHub className="size-4" />;
        case 'instagram':
        case 'link':
            return <Globe className="size-4" />;
        case 'mail':
            return <Mail className="size-4" />;
        case 'reddit':
            return <CompanyReddit className="size-4" />;
        case 'whatsapp':
            return <Comment className="size-4" />;
        case 'x':
            return <CompanyX className="size-4" />;
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

function FeatureItem({ asset, description, header }: SectionData) {
    return (
        <Stack spacing={4}>
            {asset && <div>{asset}</div>}
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
}

export function SectionsView({
    componentsRegistry,
    debug,
    sectionsData,
}: CmsSectionsViewProps) {
    const sectionKeyCounts = new Map<string, number>();

    return (
        <div>
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
                    return createElement(Component, {
                        ...section,
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

export function Heading1({
    asset,
    assetAlt,
    assetUrl,
    ctas,
    description,
    header,
    tagline,
}: SectionData) {
    return (
        <section className="md:my-8 lg:my-12 xl:my-24">
            <Container>
                <Stack spacing={10}>
                    <Stack spacing={2}>
                        {tagline && (
                            <Typography tertiary semiBold>
                                {tagline}
                            </Typography>
                        )}
                        <Stack spacing={8}>
                            {header && (
                                <Typography level="h1" id={sectionId(header)}>
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
                    assetUrl={assetUrl}
                />
            </Container>
        </section>
    );
}

export function Feature1({
    asset,
    assetAlt,
    assetUrl,
    ctas,
    description,
    features,
    header,
    tagline,
}: SectionData) {
    return (
        <section className="py-12">
            <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
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
            </Container>
        </section>
    );
}

export function Faq1({
    ctas,
    description,
    features,
    header,
    tagline,
}: SectionData) {
    return (
        <section className="py-12">
            <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
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
                                    {typeof feature.description === 'string' ? (
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
            </Container>
        </section>
    );
}

function FooterSocialLinks({ ctas }: { ctas: SectionData['ctas'] }) {
    if (!ctas?.length) {
        return null;
    }

    return (
        <div className="flex flex-wrap justify-center gap-1 md:justify-start">
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

export function Footer1({ asset, ctas, features, tagline }: SectionData) {
    const linkGroups = features?.filter(
        (feature) => feature.ctas?.length && feature.tagline !== 'SystemStatus',
    );
    const systemStatus = features?.find(
        (feature) => feature.tagline === 'SystemStatus',
    );

    return (
        <footer className="self-stretch">
            <Container className="pb-8 pt-16" maxWidth="xl">
                <Stack spacing={8}>
                    {linkGroups?.length ? (
                        <div
                            className={cx(
                                'grid grid-cols-1 gap-8 md:grid-cols-2',
                                linkGroups.length === 3 && 'lg:grid-cols-3',
                                linkGroups.length >= 4 && 'lg:grid-cols-4',
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
                                            <a href={cta.href} key={cta.label}>
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
                    <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                        <Stack alignItems="center" className="md:items-start">
                            {asset}
                        </Stack>
                        <FooterSocialLinks ctas={ctas} />
                    </div>
                    <Divider />
                    <div className="flex flex-col items-center gap-8 text-center md:flex-row md:justify-between">
                        <div>{systemStatus?.asset}</div>
                        <Typography level="body3">
                            Copyright © {new Date().getFullYear()} {tagline}.
                            All rights reserved.
                        </Typography>
                    </div>
                </Stack>
            </Container>
        </footer>
    );
}
