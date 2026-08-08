import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import type { Metadata } from 'next';
import { StructuredDataScript } from '../../../components/shared/seo/StructuredDataScript';
import { getSeedBrandsData } from '../../../lib/seeds/getSeedBrandsData';
import { getSeedsData } from '../../../lib/seeds/getSeedsData';
import { KnownPages } from '../../../src/KnownPages';
import { SeedBrandsGallery } from './SeedBrandsGallery';

const pageTitle = 'Brendovi sjemena';
const pageDescription =
    'Pregledaj brendove sjemena u Gredice katalogu i otvori njihove osnovne podatke te popis evidentiranih pakiranja sjemena.';

export const revalidate = 3600;

export const metadata: Metadata = {
    title: pageTitle,
    description: pageDescription,
    alternates: {
        canonical: KnownPages.SeedBrands,
    },
    openGraph: {
        type: 'website',
        locale: 'hr_HR',
        title: pageTitle,
        description: pageDescription,
        url: KnownPages.SeedBrands,
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

export default async function SeedBrandsPage() {
    const [brands, seeds] = await Promise.all([
        getSeedBrandsData(),
        getSeedsData(),
    ]);
    const orderedBrands = brands.toSorted((left, right) =>
        left.information.name.localeCompare(right.information.name, 'hr-HR'),
    );
    const canonicalUrl = `https://www.gredice.com${KnownPages.SeedBrands}`;

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
                            mainEntity: { '@id': `${canonicalUrl}#brands` },
                        },
                        {
                            '@type': 'ItemList',
                            '@id': `${canonicalUrl}#brands`,
                            name: pageTitle,
                            numberOfItems: orderedBrands.length,
                            itemListElement: orderedBrands.map(
                                (brand, index) => ({
                                    '@type': 'ListItem',
                                    position: index + 1,
                                    item: {
                                        '@type': 'Brand',
                                        name: brand.information.name,
                                        url: `https://www.gredice.com${KnownPages.SeedBrand(brand.slug || brand.information.name)}`,
                                        logo: brand.information.logo?.url,
                                    },
                                }),
                            ),
                        },
                        {
                            '@type': 'BreadcrumbList',
                            itemListElement: [
                                {
                                    '@type': 'ListItem',
                                    position: 1,
                                    name: 'Sjeme',
                                    item: `https://www.gredice.com${KnownPages.Seeds}`,
                                },
                                {
                                    '@type': 'ListItem',
                                    position: 2,
                                    name: pageTitle,
                                    item: canonicalUrl,
                                },
                            ],
                        },
                    ],
                }}
            />
            <Breadcrumbs
                items={[
                    { label: 'Sjeme', href: KnownPages.Seeds },
                    { label: pageTitle },
                ]}
            />
            <PageHeader header={pageTitle} subHeader={pageDescription} padded>
                <div className="flex items-start md:justify-end">
                    <NavigatingButton
                        href={KnownPages.Seeds}
                        variant="outlined"
                    >
                        Sva sjemena
                    </NavigatingButton>
                </div>
            </PageHeader>
            <SeedBrandsGallery brands={brands} seeds={seeds} />
        </Stack>
    );
}
