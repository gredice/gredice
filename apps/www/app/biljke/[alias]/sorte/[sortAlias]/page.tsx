import { decodeRouteParam } from '@gredice/js/uri';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeedbackModal } from '../../../../../components/shared/feedback/FeedbackModal';
import { PublicBreadcrumbs } from '../../../../../components/shared/seo/PublicBreadcrumbs';
import { StructuredDataScript } from '../../../../../components/shared/seo/StructuredDataScript';
import { getOperationsData } from '../../../../../lib/plants/getOperationsData';
import { getPlantSortsData } from '../../../../../lib/plants/getPlantSortsData';
import { getPlantsData } from '../../../../../lib/plants/getPlantsData';
import { resolvePlantSowingPrice } from '../../../../../lib/plants/resolvePlantSowingPrice';
import { createPublicMetadata } from '../../../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../../../src/KnownPages';
import { merchantReturnPolicy } from '../../../../../src/merchantReturnPolicy';
import { matchesPageAlias, toPageAlias } from '../../../../../src/pageAliases';
import { GrowthAttributeCards } from '../../GrowthAttributeCards';
import { getPlantInforationSections } from '../../getPlantInforationSections';
import { HarvestAttributeCards } from '../../HarvestAttributeCards';
import { InformationSection } from '../../InformationSection';
import { PlantHealthSection } from '../../PlantHealthSection';
import { PlantPageHeader } from '../../PlantPageHeader';
import {
    hasPlantRelationships,
    PlantRelationshipsSection,
} from '../../PlantRelationshipsSection';
import { PlantSortSeedsList } from '../../PlantSortSeedsList';
import { PlantTips } from '../../PlantTips';
import { SowingAttributeCards } from '../../SowingAttributeCards';
import { WateringAttributeCards } from '../../WateringAttributeCards';

export const revalidate = 43200; // 12 hours

export async function generateMetadata(
    props: PageProps<'/biljke/[alias]/sorte/[sortAlias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped, sortAlias: sortAliasUnescaped } =
        await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    const sortAlias = sortAliasUnescaped
        ? decodeRouteParam(sortAliasUnescaped)
        : null;
    const [plants, sorts] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
    ]);
    const plant = plants?.find((plant) =>
        matchesPageAlias(plant.information.name, alias, plant.slug),
    );
    const sort = sorts?.find(
        (sort) =>
            sort.information.plant?.id === plant?.id &&
            matchesPageAlias(sort.information.name, sortAlias, sort.slug),
    );
    if (!plant || !sort) {
        notFound();
    }
    return createPublicMetadata({
        title: sort.information.name,
        description:
            sort.information.shortDescription ??
            sort.information.description ??
            plant.information.description,
        path: KnownPages.PlantSort(
            plant.slug || plant.information.name,
            sort.slug || sort.information.name,
        ),
        category: `Sorta biljke ${plant.information.name}`,
        imageUrl: sort.image?.cover?.url,
        imageAlt: `Fotografija sorte ${sort.information.name}`,
    });
}

export async function generateStaticParams() {
    const [plants, sorts] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
    ]);
    const plantsById = new Map(plants?.map((plant) => [plant.id, plant]));
    return (
        sorts?.flatMap((entity, index) => {
            const sortName = entity?.information?.name;
            const plantId = entity?.information?.plant?.id;
            const plant = plantId ? plantsById.get(plantId) : null;
            const plantName = plant?.information.name;

            if (!sortName || !plantId || !plantName) {
                console.error(
                    'Invalid plant sort while generating static params for plant sort page',
                    {
                        index,
                        sortId: entity?.id ?? null,
                        sortName: sortName ?? null,
                        plantId: entity?.information?.plant?.id ?? null,
                        plantName: plantName ?? null,
                    },
                );

                return [];
            }

            return [
                {
                    alias: plant.slug || toPageAlias(String(plantName)),
                    sortAlias: entity.slug || toPageAlias(String(sortName)),
                },
            ];
        }) ?? []
    );
}

export default async function PlantSortPage(
    props: PageProps<'/biljke/[alias]/sorte/[sortAlias]'>,
) {
    const { alias: aliasUnescaped, sortAlias: sortAliasUnescaped } =
        await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    const sort = sortAliasUnescaped
        ? decodeRouteParam(sortAliasUnescaped)
        : null;
    if (!alias || !sort) {
        notFound();
    }

    const [plants, sorts, operations] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
        getOperationsData(),
    ]);
    const basePlantData = plants?.find((p) =>
        matchesPageAlias(p.information.name, alias, p.slug),
    );
    const sortData = sorts?.find(
        (s) =>
            s.information.plant?.id === basePlantData?.id &&
            matchesPageAlias(s.information.name, sort, s.slug),
    );
    if (!basePlantData || !sortData) {
        notFound();
    }

    const informationSections = getPlantInforationSections(
        basePlantData,
        sortData,
        operations,
    );

    // Map section IDs to their corresponding attribute cards
    const getAttributeCardsForSection = (sectionId: string) => {
        switch (sectionId) {
            case 'sowing':
                return (
                    <SowingAttributeCards
                        attributes={basePlantData.attributes}
                        plantName={sortData.information.name}
                    />
                );
            case 'growth':
                return (
                    <GrowthAttributeCards
                        attributes={basePlantData.attributes}
                    />
                );
            case 'watering':
                return (
                    <WateringAttributeCards
                        attributes={basePlantData.attributes}
                    />
                );
            case 'harvest':
                return (
                    <HarvestAttributeCards
                        attributes={basePlantData.attributes}
                        plantName={sortData.information.name}
                    />
                );
            default:
                return undefined;
        }
    };

    const basePlantPath = KnownPages.Plant(
        basePlantData.slug || basePlantData.information.name,
    );
    const sortPath = KnownPages.PlantSort(
        basePlantData.slug || basePlantData.information.name,
        sortData.slug || sortData.information.name,
    );
    const sortUrl = `https://www.gredice.com${sortPath}`;
    const sowingPrice = resolvePlantSowingPrice(basePlantData, sortData);
    const pricedSowingOffer =
        sowingPrice !== null && sowingPrice.currentPrice > 0
            ? sowingPrice
            : null;
    const relationships = hasPlantRelationships(sortData.relationships)
        ? sortData.relationships
        : basePlantData.relationships;
    const health = basePlantData.health;

    return (
        <div className="py-8">
            <StructuredDataScript
                data={
                    pricedSowingOffer
                        ? {
                              '@context': 'https://schema.org',
                              '@type': 'Product',
                              name: sortData.information.name,
                              description:
                                  sortData.information.shortDescription ??
                                  sortData.information.description ??
                                  basePlantData.information.description,
                              category: 'Sorta biljke',
                              image:
                                  sortData.image?.cover?.url ??
                                  basePlantData.image?.cover?.url,
                              brand: {
                                  '@type': 'Brand',
                                  name: 'Gredice',
                              },
                              url: sortUrl,
                              offers: {
                                  '@type': 'Offer',
                                  price: pricedSowingOffer.currentPrice.toFixed(
                                      2,
                                  ),
                                  priceCurrency: 'EUR',
                                  availability:
                                      sortData.store?.availableInStore === false
                                          ? 'https://schema.org/OutOfStock'
                                          : 'https://schema.org/InStock',
                                  url: sortUrl,
                                  hasMerchantReturnPolicy: merchantReturnPolicy,
                              },
                          }
                        : {
                              '@context': 'https://schema.org',
                              '@type': 'WebPage',
                              name: sortData.information.name,
                              description:
                                  sortData.information.shortDescription ??
                                  sortData.information.description ??
                                  basePlantData.information.description,
                              image:
                                  sortData.image?.cover?.url ??
                                  basePlantData.image?.cover?.url,
                              url: sortUrl,
                              about: {
                                  '@type': 'Thing',
                                  name: basePlantData.information.name,
                              },
                          }
                }
            />
            <Stack spacing={8}>
                <PublicBreadcrumbs
                    items={[
                        { label: 'Biljke', href: KnownPages.Plants },
                        {
                            label: basePlantData.information.name,
                            href: basePlantPath,
                        },
                        {
                            label: 'Sorte',
                            href: `${basePlantPath}#sorte`,
                        },
                        { label: sortData.information.name },
                    ]}
                />
                <PlantPageHeader
                    operations={operations}
                    plant={basePlantData}
                    sort={sortData}
                    overviewEditTarget={{
                        entityTypeName: 'plantSort',
                        entityId: sortData.id,
                        publicPath: sortPath,
                    }}
                />
                {informationSections
                    .filter((section) => section.avaialble)
                    .map((section) => (
                        <InformationSection
                            key={section.id}
                            id={section.id}
                            plantId={basePlantData.id}
                            header={section.header}
                            content={basePlantData.information[section.id]}
                            sortContent={sortData.information[section.id]}
                            operations={basePlantData.information.operations}
                            attributeCards={getAttributeCardsForSection(
                                section.id,
                            )}
                            editEntityTypeName="plantSort"
                            editEntityId={sortData.id}
                            editPublicPath={sortPath}
                            editSectionKey={section.id}
                        />
                    ))}
                {(basePlantData.information.tip?.length ?? 0) > 0 && (
                    <PlantTips plant={basePlantData} />
                )}
                <PlantHealthSection health={health} />
                <PlantRelationshipsSection
                    editTarget={{
                        entityTypeName: 'plantSort',
                        entityId: sortData.id,
                        publicPath: sortPath,
                    }}
                    relationships={relationships}
                />
                <PlantSortSeedsList plantSortId={sortData.id} />
                <Row spacing={4}>
                    <Typography level="body1">
                        Jesu li ti informacije o ovoj biljci korisne?
                    </Typography>
                    <FeedbackModal
                        topic="www/plants/sorts/details"
                        data={{
                            plantId: basePlantData.id,
                            plantAlias: alias,
                            sortId: sortData.id,
                            sortAlias: sort,
                        }}
                    />
                </Row>
            </Stack>
        </div>
    );
}
