import { decodeRouteParam } from '@gredice/js/uri';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeedbackModal } from '../../../../../components/shared/feedback/FeedbackModal';
import { StructuredDataScript } from '../../../../../components/shared/seo/StructuredDataScript';
import { getPlantSortsData } from '../../../../../lib/plants/getPlantSortsData';
import { getPlantsData } from '../../../../../lib/plants/getPlantsData';
import { KnownPages } from '../../../../../src/KnownPages';
import { merchantReturnPolicy } from '../../../../../src/merchantReturnPolicy';
import { matchesPageAlias, toPageAlias } from '../../../../../src/pageAliases';
import { GrowthAttributeCards } from '../../GrowthAttributeCards';
import { getPlantInforationSections } from '../../getPlantInforationSections';
import { HarvestAttributeCards } from '../../HarvestAttributeCards';
import { InformationSection } from '../../InformationSection';
import { PlantPageHeader } from '../../PlantPageHeader';
import { PlantTips } from '../../PlantTips';
import { SowingAttributeCards } from '../../SowingAttributeCards';
import { WateringAttributeCards } from '../../WateringAttributeCards';

export const revalidate = 3600; // 1 hour

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
        matchesPageAlias(plant.information.name, alias),
    );
    const sort = sorts?.find(
        (sort) =>
            sort.information.plant?.id === plant?.id &&
            matchesPageAlias(sort.information.name, sortAlias),
    );
    if (!plant || !sort) {
        return {
            title: 'Sorta nije pronađena',
            description: 'Sorta nije pronađena',
        };
    }
    return {
        title: sort.information.name,
        description:
            sort.information.shortDescription ??
            sort.information.description ??
            plant.information.description,
    };
}

export async function generateStaticParams() {
    const [plants, sorts] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
    ]);
    const plantsById = new Map(plants?.map((plant) => [plant.id, plant]));
    return (
        sorts?.map((entity, index) => {
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

                throw new Error(
                    'Invalid plant sort data while generating static params for /biljke/[alias]/sorte/[sortAlias]',
                );
            }

            return {
                alias: toPageAlias(String(plantName)),
                sortAlias: toPageAlias(String(sortName)),
            };
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
        console.warn(
            'Invalid parameters for plant sort page:',
            await props.params,
        );
        notFound();
    }

    const [plants, sorts] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
    ]);
    const basePlantData = plants?.find((p) =>
        matchesPageAlias(p.information.name, alias),
    );
    const sortData = sorts?.find(
        (s) =>
            s.information.plant?.id === basePlantData?.id &&
            matchesPageAlias(s.information.name, sort),
    );
    if (!basePlantData || !sortData) {
        console.error('Base plant or sort not found:', {
            basePlantData,
            sortData,
        });
        notFound();
    }

    const informationSections = getPlantInforationSections(basePlantData);

    // Map section IDs to their corresponding attribute cards
    const getAttributeCardsForSection = (sectionId: string) => {
        switch (sectionId) {
            case 'sowing':
                return (
                    <SowingAttributeCards
                        attributes={basePlantData.attributes}
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
                    />
                );
            default:
                return undefined;
        }
    };

    return (
        <div className="py-8">
            <StructuredDataScript
                data={{
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
                    isVariantOf: {
                        '@type': 'Product',
                        name: basePlantData.information.name,
                        url: `https://www.gredice.com${KnownPages.Plant(alias)}`,
                    },
                    url: `https://www.gredice.com${KnownPages.PlantSort(alias, sortData.information.name)}`,
                    offers:
                        typeof basePlantData.prices?.perPlant === 'number'
                            ? {
                                '@type': 'Offer',
                                price: basePlantData.prices.perPlant.toFixed(
                                    2,
                                ),
                                priceCurrency: 'EUR',
                                availability:
                                    sortData.store?.availableInStore === false
                                        ? 'https://schema.org/OutOfStock'
                                        : 'https://schema.org/InStock',
                                url: `https://www.gredice.com${KnownPages.PlantSort(alias, sortData.information.name)}`,
                                hasMerchantReturnPolicy: merchantReturnPolicy,
                            }
                            : undefined,
                }}
            />
            <Stack spacing={4}>
                <Breadcrumbs
                    items={[
                        { label: 'Biljke', href: KnownPages.Plants },
                        {
                            label: basePlantData.information.name,
                            href: KnownPages.Plant(alias),
                        },
                        {
                            label: 'Sorte',
                            href: `${KnownPages.Plant(alias)}#sorte`,
                        },
                        { label: sortData.information.name },
                    ]}
                />
                <PlantPageHeader plant={basePlantData} sort={sortData} />
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
                        />
                    ))}
                {(basePlantData.information.tip?.length ?? 0) > 0 && (
                    <PlantTips plant={basePlantData} />
                )}
                <Row spacing={2}>
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
