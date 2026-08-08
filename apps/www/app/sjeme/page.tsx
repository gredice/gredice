import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFilterInput } from '../../components/shared/PageFilterInput';
import { StructuredDataScript } from '../../components/shared/seo/StructuredDataScript';
import { getSeedsData } from '../../lib/seeds/getSeedsData';
import { KnownPages } from '../../src/KnownPages';
import { SeedsGallery } from './SeedsGallery';
import { seedPrimaryImageUrl } from './seedPresentation';

const pageTitle = 'Sjeme';
const pageDescription =
    'Pregledaj sva evidentirana pakiranja sjemena i pretraži ih prema nazivu, biljci, sorti, brendu, podrijetlu ili barkodu.';

export const revalidate = 3600;

export const metadata: Metadata = {
    title: pageTitle,
    description: pageDescription,
    alternates: {
        canonical: KnownPages.Seeds,
    },
    openGraph: {
        type: 'website',
        locale: 'hr_HR',
        title: pageTitle,
        description: pageDescription,
        url: KnownPages.Seeds,
    },
    twitter: {
        card: 'summary',
        title: pageTitle,
        description: pageDescription,
    },
    robots: {
        index: true,
        follow: true,
    },
};

function stringParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function SeedsPage({ searchParams }: PageProps<'/sjeme'>) {
    const params = await searchParams;
    const search = stringParam(params.pretraga);
    const seeds = await getSeedsData();
    const orderedSeeds = seeds.toSorted((left, right) =>
        left.information.name.localeCompare(right.information.name, 'hr-HR'),
    );
    const canonicalUrl = `https://www.gredice.com${KnownPages.Seeds}`;

    return (
        <Stack spacing={8} className="py-4">
            <StructuredDataScript
                data={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'CollectionPage',
                            '@id': `${canonicalUrl}#webpage`,
                            url: canonicalUrl,
                            name: pageTitle,
                            description: pageDescription,
                            inLanguage: 'hr-HR',
                            mainEntity: { '@id': `${canonicalUrl}#catalogue` },
                        },
                        {
                            '@type': 'ItemList',
                            '@id': `${canonicalUrl}#catalogue`,
                            name: 'Katalog sjemena',
                            numberOfItems: orderedSeeds.length,
                            itemListElement: orderedSeeds.map(
                                (seed, index) => ({
                                    '@type': 'ListItem',
                                    position: index + 1,
                                    item: {
                                        '@type': 'Product',
                                        name: seed.information.name,
                                        category: 'Sjeme',
                                        url: `https://www.gredice.com${KnownPages.Seed(seed.slug || seed.information.name)}`,
                                        image: seedPrimaryImageUrl(seed),
                                        brand: {
                                            '@type': 'Brand',
                                            name: seed.information.brand
                                                .information.name,
                                        },
                                    },
                                }),
                            ),
                        },
                    ],
                }}
            />
            <PageHeader header={pageTitle} subHeader={pageDescription} padded>
                <div className="flex w-full flex-col items-start gap-3 md:items-end">
                    <NavigatingButton
                        href={KnownPages.SeedBrands}
                        variant="outlined"
                    >
                        Brendovi sjemena
                    </NavigatingButton>
                    <Suspense>
                        <PageFilterInput
                            searchParamName="pretraga"
                            fieldName="seed-search"
                            initialValue={search}
                            placeholder="Pretraži sjeme..."
                            className="w-full lg:flex lg:justify-end"
                        />
                    </Suspense>
                </div>
            </PageHeader>
            <Suspense>
                <SeedsGallery seeds={seeds} initialSearch={search} />
            </Suspense>
        </Stack>
    );
}
