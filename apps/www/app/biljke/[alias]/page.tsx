import { decodeRouteParam } from '@gredice/js/uri';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { PublicBreadcrumbs } from '../../../components/shared/seo/PublicBreadcrumbs';
import { StructuredDataScript } from '../../../components/shared/seo/StructuredDataScript';
import { getOperationsData } from '../../../lib/plants/getOperationsData';
import { getPlantsData } from '../../../lib/plants/getPlantsData';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';
import { merchantReturnPolicy } from '../../../src/merchantReturnPolicy';
import { matchesPageAlias, toPageAlias } from '../../../src/pageAliases';
import { GrowthAttributeCards } from './GrowthAttributeCards';
import { getPlantInforationSections } from './getPlantInforationSections';
import { HarvestAttributeCards } from './HarvestAttributeCards';
import { InformationSection } from './InformationSection';
import { PlantHealthSection } from './PlantHealthSection';
import { PlantPageHeader } from './PlantPageHeader';
import { PlantRelationshipsSection } from './PlantRelationshipsSection';
import { PlantSortsList } from './PlantSortsList';
import { PlantTips } from './PlantTips';
import { SowingAttributeCards } from './SowingAttributeCards';
import { WateringAttributeCards } from './WateringAttributeCards';

export const revalidate = 43200; // 12 hours
export async function generateMetadata(
    props: PageProps<'/biljke/[alias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    const plant = (await getPlantsData())?.find((plant) =>
        matchesPageAlias(plant.information.name, alias),
    );
    if (!plant) {
        notFound();
    }
    return createPublicMetadata({
        title: plant.information.name,
        description: plant.information.description,
        path: KnownPages.Plant(plant.slug || plant.information.name),
        category: 'Biljka',
        imageUrl: plant.image?.cover?.url,
        imageAlt: `Fotografija biljke ${plant.information.name}`,
    });
}

export async function generateStaticParams() {
    const plants = await getPlantsData();
    return (
        plants?.map((entity) => ({
            alias: entity.slug || toPageAlias(String(entity.information.name)),
        })) ?? []
    );
}

export default async function PlantPage(props: PageProps<'/biljke/[alias]'>) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    if (!alias) {
        notFound();
    }

    const plant = (await getPlantsData())?.find((plant) =>
        matchesPageAlias(plant.information.name, alias),
    );
    if (!plant) {
        notFound();
    }

    const operations = await getOperationsData();
    const informationSections = getPlantInforationSections(
        plant,
        undefined,
        operations,
    );
    const plantPath = KnownPages.Plant(plant.slug || plant.information.name);
    const plantUrl = `https://www.gredice.com${plantPath}`;
    const plantPrice = plant.prices?.perPlant;

    // Map section IDs to their corresponding attribute cards
    const getAttributeCardsForSection = (sectionId: string) => {
        switch (sectionId) {
            case 'sowing':
                return (
                    <SowingAttributeCards
                        attributes={plant.attributes}
                        plantName={plant.information.name}
                    />
                );
            case 'growth':
                return <GrowthAttributeCards attributes={plant.attributes} />;
            case 'watering':
                return <WateringAttributeCards attributes={plant.attributes} />;
            case 'harvest':
                return (
                    <HarvestAttributeCards
                        attributes={plant.attributes}
                        plantName={plant.information.name}
                    />
                );
            default:
                return undefined;
        }
    };

    return (
        <div className="py-8">
            <StructuredDataScript
                data={
                    typeof plantPrice === 'number' && plantPrice > 0
                        ? {
                              '@context': 'https://schema.org',
                              '@type': 'Product',
                              name: plant.information.name,
                              description: plant.information.description,
                              category: 'Biljka',
                              image: plant.image?.cover?.url,
                              brand: {
                                  '@type': 'Brand',
                                  name: 'Gredice',
                              },
                              url: plantUrl,
                              offers: {
                                  '@type': 'Offer',
                                  price: plantPrice.toFixed(2),
                                  priceCurrency: 'EUR',
                                  availability:
                                      plant.store?.availableInStore === false
                                          ? 'https://schema.org/OutOfStock'
                                          : 'https://schema.org/InStock',
                                  url: plantUrl,
                                  hasMerchantReturnPolicy: merchantReturnPolicy,
                              },
                          }
                        : {
                              '@context': 'https://schema.org',
                              '@type': 'WebPage',
                              name: plant.information.name,
                              description: plant.information.description,
                              image: plant.image?.cover?.url,
                              url: plantUrl,
                              mainEntity: {
                                  '@type': 'Thing',
                                  '@id': `${plantUrl}#plant`,
                                  name: plant.information.name,
                                  description: plant.information.description,
                                  image: plant.image?.cover?.url,
                                  url: plantUrl,
                              },
                          }
                }
            />
            <Stack spacing={8}>
                <PublicBreadcrumbs
                    items={[
                        { label: 'Biljke', href: KnownPages.Plants },
                        { label: plant.information.name },
                    ]}
                />
                <PlantPageHeader
                    operations={operations}
                    plant={plant}
                    overviewEditTarget={{
                        entityTypeName: 'plant',
                        entityId: plant.id,
                        publicPath: plantPath,
                    }}
                />
                <PlantSortsList
                    basePlantName={plant.information.name}
                    basePlantId={plant.id}
                />
                {informationSections
                    .filter((section) => section.avaialble)
                    .map((section) => (
                        <InformationSection
                            key={section.id}
                            id={section.id}
                            plantId={plant.id}
                            header={section.header}
                            content={plant.information[section.id]}
                            operations={plant.information.operations}
                            attributeCards={getAttributeCardsForSection(
                                section.id,
                            )}
                            editEntityTypeName="plant"
                            editEntityId={plant.id}
                            editPublicPath={plantPath}
                            editSectionKey={section.id}
                        />
                    ))}
                {(plant.information.tip?.length ?? 0) > 0 && (
                    <PlantTips plant={plant} />
                )}
                <PlantHealthSection health={plant.health} />
                <PlantRelationshipsSection
                    editTarget={{
                        entityTypeName: 'plant',
                        entityId: plant.id,
                        publicPath: plantPath,
                    }}
                    relationships={plant.relationships}
                />
                <Typography level="body1" component="p">
                    Želiš saznati više o tome kako naručiti sjetvu? Posjeti našu
                    stranicu o{' '}
                    <Link className="underline" href={KnownPages.Sowing}>
                        sjetvi biljaka
                    </Link>{' '}
                    za detalje o sjetvi, rasporedu i pogodnostima.
                </Typography>
                <Row spacing={4}>
                    <Typography level="body1">
                        Jesu li ti informacije o ovoj biljci korisne?
                    </Typography>
                    <FeedbackModal
                        topic="www/plants/details"
                        data={{
                            plantId: plant.id,
                            plantAlias: alias,
                        }}
                    />
                </Row>
            </Stack>
        </div>
    );
}
