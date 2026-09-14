import { decodeRouteParam } from '@gredice/js/uri';
import { ExternalLink, Globe, MapPinHouse } from '@gredice/ui/icons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { AttributeCard } from '../../../../components/attributes/DetailCard';
import { PageFilterInput } from '../../../../components/shared/PageFilterInput';
import { PublicBreadcrumbs } from '../../../../components/shared/seo/PublicBreadcrumbs';
import { StructuredDataScript } from '../../../../components/shared/seo/StructuredDataScript';
import { getSeedBrandsData } from '../../../../lib/seeds/getSeedBrandsData';
import { getSeedsData } from '../../../../lib/seeds/getSeedsData';
import { KnownPages } from '../../../../src/KnownPages';
import { matchesPageAlias, toPageAlias } from '../../../../src/pageAliases';
import { BrandLogo } from '../../BrandLogo';
import { getSeedBrandLogoViewTransitionName } from '../../catalogueViewTransition';
import { SeedsGallery } from '../../SeedsGallery';
import {
    brandPageDescription,
    safeWebsiteUrl,
    seedPrimaryImageUrl,
} from '../../seedPresentation';

export const revalidate = 3600;

function stringParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

async function getBrand(slug: string) {
    const brands = await getSeedBrandsData();
    return brands.find(
        (brand) =>
            brand.slug === slug ||
            matchesPageAlias(brand.information.name, slug),
    );
}

async function getBrandPageData(slug: string) {
    const [brand, seeds] = await Promise.all([getBrand(slug), getSeedsData()]);
    if (!brand) {
        return null;
    }
    return {
        brand,
        seeds: seeds.filter((seed) => seed.information.brand.id === brand.id),
    };
}

export async function generateMetadata(
    props: PageProps<'/sjeme/brend/[slug]'>,
): Promise<Metadata> {
    const { slug: encodedSlug } = await props.params;
    const slug = decodeRouteParam(encodedSlug);
    const data = await getBrandPageData(slug);
    if (!data) {
        notFound();
    }

    const { brand, seeds } = data;
    const title = brand.information.name;
    const description = brandPageDescription(brand, seeds.length);
    const path = KnownPages.SeedBrand(brand.slug || brand.information.name);
    const image =
        brand.information.logo?.url ??
        (seeds[0] ? seedPrimaryImageUrl(seeds[0]) : undefined);

    return {
        title: `${title} sjeme`,
        description,
        alternates: {
            canonical: path,
        },
        openGraph: {
            type: 'website',
            locale: 'hr_HR',
            title: `${title} sjeme`,
            description,
            url: path,
            ...(image
                ? { images: [{ url: image, alt: `Brend ${title}` }] }
                : {}),
        },
        twitter: {
            card: image ? 'summary_large_image' : 'summary',
            title: `${title} sjeme`,
            description,
            ...(image ? { images: [image] } : {}),
        },
        robots: {
            index: true,
            follow: true,
        },
    };
}

export async function generateStaticParams() {
    const brands = await getSeedBrandsData();
    return brands.map((brand) => ({
        slug: brand.slug || toPageAlias(brand.information.name),
    }));
}

export default async function SeedBrandPage(
    props: PageProps<'/sjeme/brend/[slug]'>,
) {
    const [{ slug: encodedSlug }, searchParams] = await Promise.all([
        props.params,
        props.searchParams,
    ]);
    const slug = decodeRouteParam(encodedSlug);
    const search = stringParam(searchParams.pretraga);
    const data = await getBrandPageData(slug);
    if (!data) {
        notFound();
    }

    const { brand, seeds } = data;
    const website = safeWebsiteUrl(brand.information.website);
    const path = KnownPages.SeedBrand(brand.slug || brand.information.name);
    const canonicalUrl = `https://www.gredice.com${path}`;
    const description = brandPageDescription(brand, seeds.length);

    return (
        <div className="py-8">
            <StructuredDataScript
                data={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'WebPage',
                            '@id': `${canonicalUrl}#webpage`,
                            url: canonicalUrl,
                            name: `${brand.information.name} sjeme`,
                            description,
                            inLanguage: 'hr-HR',
                            mainEntity: { '@id': `${canonicalUrl}#brand` },
                        },
                        {
                            '@type': 'Brand',
                            '@id': `${canonicalUrl}#brand`,
                            name: brand.information.name,
                            url: canonicalUrl,
                            logo: brand.information.logo?.url,
                            ...(website ? { sameAs: [website] } : {}),
                        },
                        {
                            '@type': 'ItemList',
                            name: `Sjeme brenda ${brand.information.name}`,
                            numberOfItems: seeds.length,
                            itemListElement: seeds.map((seed, index) => ({
                                '@type': 'ListItem',
                                position: index + 1,
                                item: {
                                    '@type': 'Thing',
                                    '@id': `https://www.gredice.com${KnownPages.Seed(seed.slug || seed.information.name)}`,
                                    name: seed.information.name,
                                    url: `https://www.gredice.com${KnownPages.Seed(seed.slug || seed.information.name)}`,
                                    image: seedPrimaryImageUrl(seed),
                                },
                            })),
                        },
                    ],
                }}
            />
            <Stack spacing={8}>
                <PublicBreadcrumbs
                    items={[
                        { label: 'Sjeme', href: KnownPages.Seeds },
                        {
                            label: 'Brendovi sjemena',
                            href: KnownPages.SeedBrands,
                        },
                        { label: brand.information.name },
                    ]}
                />
                <PageHeader
                    visual={
                        <span
                            className="public-content-card-view-transition inline-flex size-48 items-center justify-center overflow-hidden"
                            style={{
                                viewTransitionName:
                                    getSeedBrandLogoViewTransitionName(
                                        brand.id,
                                    ),
                            }}
                        >
                            <BrandLogo
                                brand={brand}
                                width={192}
                                height={192}
                                preload
                            />
                        </span>
                    }
                    header={brand.information.name}
                    alternativeName={brand.information.country}
                    subHeader={description}
                />

                {brand.information.country || website ? (
                    <Stack spacing={4}>
                        <Typography level="h2" className="text-2xl">
                            Osnovne informacije
                        </Typography>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {brand.information.country ? (
                                <AttributeCard
                                    icon={<MapPinHouse />}
                                    header="Zemlja"
                                    value={brand.information.country}
                                />
                            ) : null}
                            {website ? (
                                <AttributeCard
                                    icon={<Globe />}
                                    header="Web stranica"
                                    value={
                                        <a
                                            href={website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 break-all underline"
                                        >
                                            {new URL(website).hostname}
                                            <ExternalLink
                                                aria-hidden
                                                className="size-4 shrink-0"
                                            />
                                        </a>
                                    }
                                />
                            ) : null}
                        </div>
                    </Stack>
                ) : null}

                <Stack spacing={4}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Typography level="h2" className="text-2xl">
                            Sjeme brenda {brand.information.name}
                        </Typography>
                        <Suspense>
                            <PageFilterInput
                                searchParamName="pretraga"
                                fieldName="brand-seed-search"
                                initialValue={search}
                                placeholder="Pretraži sjeme brenda..."
                            />
                        </Suspense>
                    </div>
                    <Suspense>
                        <SeedsGallery seeds={seeds} initialSearch={search} />
                    </Suspense>
                </Stack>
            </Stack>
        </div>
    );
}
