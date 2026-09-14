import { decodeRouteParam } from '@gredice/js/uri';
import { BarcodeValue } from '@gredice/ui/Barcode';
import { ImageGallery } from '@gredice/ui/ImageGallery';
import {
    Euro,
    Hash,
    MapPinHouse,
    Percent,
    Ruler,
    Sprout,
    Tally3,
} from '@gredice/ui/icons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AttributeCard } from '../../../components/attributes/DetailCard';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { PublicBreadcrumbs } from '../../../components/shared/seo/PublicBreadcrumbs';
import { StructuredDataScript } from '../../../components/shared/seo/StructuredDataScript';
import { formatPrice } from '../../../lib/formatPrice';
import { getSeedsData } from '../../../lib/seeds/getSeedsData';
import { KnownPages } from '../../../src/KnownPages';
import { matchesPageAlias, toPageAlias } from '../../../src/pageAliases';
import { BrandLogo } from '../BrandLogo';
import { getSeedImageViewTransitionName } from '../catalogueViewTransition';
import { SeedImage } from '../SeedImage';
import { SeedRelatedCard } from '../SeedRelatedCard';
import {
    formatSeedArea,
    formatSeedWeight,
    seedGtin13,
    seedPackageImages,
    seedPageDescription,
    seedPrimaryImageUrl,
} from '../seedPresentation';

export const revalidate = 3600;

async function getSeed(slug: string) {
    const seeds = await getSeedsData();
    return seeds.find(
        (seed) =>
            seed.slug === slug || matchesPageAlias(seed.information.name, slug),
    );
}

export async function generateMetadata(
    props: PageProps<'/sjeme/[slug]'>,
): Promise<Metadata> {
    const { slug: encodedSlug } = await props.params;
    const slug = decodeRouteParam(encodedSlug);
    const seed = await getSeed(slug);
    if (!seed) {
        notFound();
    }

    const title = seed.information.name;
    const description = seedPageDescription(seed);
    const path = KnownPages.Seed(seed.slug || seed.information.name);
    const image = seedPrimaryImageUrl(seed);

    return {
        title,
        description,
        alternates: {
            canonical: path,
        },
        openGraph: {
            type: 'website',
            locale: 'hr_HR',
            title,
            description,
            url: path,
            ...(image
                ? {
                      images: [{ url: image, alt: seed.information.name }],
                  }
                : {}),
        },
        twitter: {
            card: image ? 'summary_large_image' : 'summary',
            title,
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
    const seeds = await getSeedsData();
    return seeds.map((seed) => ({
        slug: seed.slug || toPageAlias(seed.information.name),
    }));
}

export default async function SeedPage(props: PageProps<'/sjeme/[slug]'>) {
    const { slug: encodedSlug } = await props.params;
    const slug = decodeRouteParam(encodedSlug);
    const seed = await getSeed(slug);
    if (!seed) {
        notFound();
    }

    const path = KnownPages.Seed(seed.slug || seed.information.name);
    const canonicalUrl = `https://www.gredice.com${path}`;
    const description = seedPageDescription(seed);
    const packageImages = seedPackageImages(seed);
    const image = seedPrimaryImageUrl(seed);
    const seedImages =
        packageImages.length > 0
            ? packageImages.map((packageImage) => packageImage.src)
            : image
              ? [image]
              : undefined;
    const gtin13 = seedGtin13(seed);
    const identifiers = [
        {
            '@type': 'PropertyValue',
            propertyID: 'Gredice seed ID',
            value: `seed-${seed.id}`,
        },
        gtin13
            ? {
                  '@type': 'PropertyValue',
                  propertyID: 'GTIN-13',
                  value: gtin13,
              }
            : null,
    ].filter((identifier) => identifier !== null);

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
                            name: seed.information.name,
                            description,
                            inLanguage: 'hr-HR',
                            mainEntity: { '@id': `${canonicalUrl}#seed` },
                        },
                        {
                            '@type': 'Thing',
                            '@id': `${canonicalUrl}#seed`,
                            name: seed.information.name,
                            description,
                            url: canonicalUrl,
                            image: seedImages,
                            identifier: identifiers,
                            subjectOf: {
                                '@id': `${canonicalUrl}#webpage`,
                            },
                        },
                    ],
                }}
            />
            <Stack spacing={8}>
                <PublicBreadcrumbs
                    items={[
                        { label: 'Sjeme', href: KnownPages.Seeds },
                        { label: seed.information.name },
                    ]}
                />
                <PageHeader
                    visual={
                        <span
                            className="public-content-card-view-transition inline-flex size-48 items-center justify-center overflow-hidden"
                            style={{
                                viewTransitionName:
                                    getSeedImageViewTransitionName(seed.id),
                            }}
                        >
                            <SeedImage
                                seed={seed}
                                width={192}
                                height={192}
                                preload
                            />
                        </span>
                    }
                    header={seed.information.name}
                    alternativeName={
                        seed.information.plantSort.information.name
                    }
                />

                <Stack spacing={4}>
                    <Typography level="h2" className="text-2xl">
                        Informacije o pakiranju
                    </Typography>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {typeof seed.attributes.price === 'number' ? (
                            <AttributeCard
                                icon={<Euro />}
                                header="Cijena"
                                value={formatPrice(seed.attributes.price)}
                            />
                        ) : null}
                        <AttributeCard
                            icon={<Ruler />}
                            header="Težina"
                            value={
                                typeof seed.attributes.weight === 'number'
                                    ? formatSeedWeight(seed.attributes.weight)
                                    : undefined
                            }
                        />
                        {seed.attributes.germinationPercentage != null ? (
                            <AttributeCard
                                icon={<Percent />}
                                header="Klijavost"
                                value={`${seed.attributes.germinationPercentage}%`}
                            />
                        ) : null}
                        {seed.application?.applicationArea != null ? (
                            <AttributeCard
                                icon={<Tally3 />}
                                header="Površina primjene"
                                value={formatSeedArea(
                                    seed.application.applicationArea,
                                )}
                            />
                        ) : null}
                        {seed.application?.applicationPlants != null ? (
                            <AttributeCard
                                icon={<Sprout />}
                                header="Broj biljaka"
                                value={seed.application.applicationPlants}
                            />
                        ) : null}
                        {seed.information.barcode ? (
                            <AttributeCard
                                icon={<Hash />}
                                header="Barkod"
                                value={
                                    <BarcodeValue
                                        value={seed.information.barcode}
                                    />
                                }
                            />
                        ) : null}
                        {seed.information.countryOfOrigin ? (
                            <AttributeCard
                                icon={<MapPinHouse />}
                                header="Zemlja podrijetla"
                                value={seed.information.countryOfOrigin}
                            />
                        ) : null}
                    </div>
                </Stack>

                <Stack spacing={4}>
                    <Typography level="h2" className="text-2xl">
                        Povezano
                    </Typography>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <SeedRelatedCard
                            header="Brend"
                            name={seed.information.brand.information.name}
                            linkLabel="Otvori brend"
                            href={KnownPages.SeedBrand(
                                seed.information.brand.information.name,
                            )}
                            visual={
                                <BrandLogo
                                    brand={seed.information.brand}
                                    width={80}
                                    height={80}
                                />
                            }
                        />
                        <SeedRelatedCard
                            header="Biljka"
                            name={seed.information.plant.information.name}
                            linkLabel="Otvori biljku"
                            href={KnownPages.Plant(
                                seed.information.plant.information.name,
                            )}
                            visual={
                                <PlantOrSortImage
                                    plant={seed.information.plant}
                                    width={80}
                                    height={80}
                                    className="size-full object-contain p-2"
                                />
                            }
                        />
                        <SeedRelatedCard
                            header="Sorta"
                            name={seed.information.plantSort.information.name}
                            linkLabel="Otvori sortu"
                            href={KnownPages.PlantSort(
                                seed.information.plant.information.name,
                                seed.information.plantSort.information.name,
                            )}
                            visual={
                                <PlantOrSortImage
                                    plantSort={seed.information.plantSort}
                                    width={80}
                                    height={80}
                                    className="size-full object-contain p-2"
                                />
                            }
                        />
                    </div>
                </Stack>

                {packageImages.length > 0 ? (
                    <Stack spacing={4}>
                        <Typography level="h2" className="text-2xl">
                            Slike pakiranja
                        </Typography>
                        <ImageGallery
                            images={packageImages}
                            previewVariant="grid"
                            previewWidth={640}
                            previewHeight={480}
                        />
                    </Stack>
                ) : null}

                <Row spacing={4}>
                    <Typography level="body1">
                        Jesu li ti informacije o ovom sjemenu korisne?
                    </Typography>
                    <FeedbackModal
                        topic="www/seeds/details"
                        data={{ seedId: seed.id, seedSlug: seed.slug, image }}
                    />
                </Row>
            </Stack>
        </div>
    );
}
