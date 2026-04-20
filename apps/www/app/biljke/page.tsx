import { orderBy } from '@signalco/js';
import { Calendar, LayoutGrid } from '@signalco/ui-icons';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageFilterInputNoSSR } from '../../components/shared/PageFilterInputNoSSR';
import { PageHeader } from '../../components/shared/PageHeader';
import { StructuredDataScript } from '../../components/shared/seo/StructuredDataScript';
import { getPlantsData } from '../../lib/plants/getPlantsData';
import { KnownPages } from '../../src/KnownPages';
import { PlantsCalendar } from './PlantsCalendar';
import { PlantsGallery } from './PlantsGallery';
import { PlantsSeedTimeFilterToggle } from './PlantsSeedTimeFilterToggle';

export const metadata: Metadata = {
    title: 'Biljke',
    description:
        'Za tebe smo pripremili opširnu listu biljaka koje možeš pronaći u našem asortimanu.',
};

export default async function PlantsPage({
    searchParams,
}: PageProps<'/biljke'>) {
    const params = await searchParams;
    const viewParam = params.pregled;
    const view = Array.isArray(viewParam) ? viewParam[0] : viewParam;
    const search = params.pretraga;
    const seedTimeFilter = params.vrijemeZaSijanje;
    const isSeedTimeFilterEnabled =
        (Array.isArray(seedTimeFilter) ? seedTimeFilter[0] : seedTimeFilter) ===
        '1';
    const entities = await getPlantsData();
    const isCanonicalView = !search && !isSeedTimeFilterEnabled;
    const sortedEntities = orderBy(entities ?? [], (a, b) =>
        a.information.name.localeCompare(b.information.name),
    );
    return (
        <Stack>
            {isCanonicalView && (
                <StructuredDataScript
                    data={{
                        '@context': 'https://schema.org',
                        '@type': 'ItemList',
                        name: 'Biljke',
                        itemListElement: sortedEntities.map((plant, index) => ({
                            '@type': 'ListItem',
                            position: index + 1,
                            item: {
                                '@type': 'Product',
                                name: plant.information.name,
                                url: `https://www.gredice.com${KnownPages.Plant(plant.information.name)}`,
                                image: plant.image?.cover?.url,
                                offers:
                                    typeof plant.prices?.perPlant === 'number'
                                        ? {
                                              '@type': 'Offer',
                                              price: plant.prices.perPlant.toFixed(
                                                  2,
                                              ),
                                              priceCurrency: 'EUR',
                                          }
                                        : undefined,
                            },
                        })),
                    }}
                />
            )}
            <PageHeader
                padded
                header="Biljke"
                subHeader="Za tebe smo pripremili opširnu listu biljaka koje možeš pronaći u našem asortimanu."
            >
                <Suspense>
                    <PageFilterInputNoSSR
                        searchParamName="pretraga"
                        fieldName="plant-search"
                        className="lg:flex items-start justify-end"
                    />
                </Suspense>
            </PageHeader>
            <Suspense>
                <Tabs value={view} defaultValue="popis" className="w-full">
                    <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <TabsList className="grid grid-cols-2 w-fit border">
                            <Link
                                href={`?pregled=popis${search ? `&pretraga=${search}` : ''}${isSeedTimeFilterEnabled ? '&vrijemeZaSijanje=1' : ''}`}
                                prefetch
                            >
                                <TabsTrigger value="popis" className="w-full">
                                    <Row spacing={1} className="cursor-default">
                                        <LayoutGrid className="size-5" />
                                        <span>Popis</span>
                                    </Row>
                                </TabsTrigger>
                            </Link>
                            <Link
                                href={`?pregled=kalendar${search ? `&pretraga=${search}` : ''}${isSeedTimeFilterEnabled ? '&vrijemeZaSijanje=1' : ''}`}
                                prefetch
                            >
                                <TabsTrigger
                                    value="kalendar"
                                    className="w-full"
                                >
                                    <Row spacing={1} className="cursor-default">
                                        <Calendar className="size-5" />
                                        <span>Kalendar</span>
                                    </Row>
                                </TabsTrigger>
                            </Link>
                        </TabsList>
                        <Suspense>
                            <PlantsSeedTimeFilterToggle />
                        </Suspense>
                    </div>
                    <TabsContent value="popis" className="mt-2">
                        <PlantsGallery plants={entities} />
                    </TabsContent>
                    <TabsContent value="kalendar" className="mt-2">
                        <Card>
                            <CardOverflow>
                                <PlantsCalendar plants={entities} />
                            </CardOverflow>
                        </Card>
                    </TabsContent>
                </Tabs>
            </Suspense>
            <Row spacing={2} className="mt-12">
                <Typography level="body1">
                    Sviđa ti se odabir ili nema biljke koja te zanima?
                </Typography>
                <FeedbackModal topic="www/plants" />
            </Row>
        </Stack>
    );
}
