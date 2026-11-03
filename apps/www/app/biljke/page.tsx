import { orderBy } from '@gredice/js/arrays';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import { Tabs } from '@gredice/ui/Tabs';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFilterInputNoSSR } from '../../components/shared/PageFilterInputNoSSR';
import { StructuredDataScript } from '../../components/shared/seo/StructuredDataScript';
import { getPlantSortsData } from '../../lib/plants/getPlantSortsData';
import { getPlantsData } from '../../lib/plants/getPlantsData';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';
import { publicHtmlGrowthFixture } from '../../tests/publicHtmlGrowthFixture';
import { PlantsActiveFilters } from './PlantsActiveFilters';
import { PlantsArchiveLinks } from './PlantsArchiveLinks';
import { PlantsCatalogue } from './PlantsCatalogue';
import { PlantsMonthChart } from './PlantsMonthChart';
import { PlantsSeasonPanel } from './PlantsSeasonPanel';
import { PlantsViewTabs } from './PlantsViewTabs';
import { compareCataloguePlantNames, toPlantCatalogue } from './plantCatalogue';
import { parsePlantArchiveMonth, plantArchiveResultsId } from './plantSeason';

const pageCategory = 'Katalog biljaka';

export const metadata: Metadata = createPublicMetadata({
    title: 'Biljke',
    description:
        'Za tebe smo pripremili opširnu listu biljaka koje možeš pronaći u našem asortimanu.',
    path: KnownPages.Plants,
    category: pageCategory,
});

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function PlantsPage({
    searchParams,
}: PageProps<'/biljke'>) {
    const params = await searchParams;
    const viewParam = params.pregled;
    const view = Array.isArray(viewParam) ? viewParam[0] : viewParam;
    const search = firstParam(params.pretraga);
    const seedTimeFilterValue = firstParam(params.vrijemeZaSijanje);
    const monthValue = firstParam(params.mjesec);
    const filters = {
        currentMonth: new Date().getMonth() + 1,
        initialActivity: firstParam(params.aktivnost),
        initialMonth: monthValue,
        initialSearch: search,
        initialSeedTimeFilter: seedTimeFilterValue,
    };
    const [entities, sorts] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
    ]);
    const isCanonicalView =
        !search &&
        seedTimeFilterValue !== '1' &&
        parsePlantArchiveMonth(monthValue) === null;
    const catalogue = toPlantCatalogue(entities, sorts);
    const plants =
        process.env.GREDICE_PLAYWRIGHT_CATALOGUE_GROWTH_FIXTURE === 'true'
            ? publicHtmlGrowthFixture(catalogue)
            : catalogue;
    const sortedEntities = orderBy(plants, compareCataloguePlantNames);
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
                                '@type': 'Thing',
                                '@id': `https://www.gredice.com${KnownPages.Plant(plant.information.name)}`,
                                name: plant.information.name,
                                url: `https://www.gredice.com${KnownPages.Plant(plant.information.name)}`,
                                image: plant.image?.cover?.url,
                            },
                        })),
                    }}
                />
            )}
            <div className="pt-8 pb-6 md:pt-12">
                <PageHeader
                    tagline={pageCategory}
                    header="Biljke"
                    subHeader="Odaberi što želiš uzgajati u svojoj gredici. Za svaku biljku vidiš kada se sije, koliko rodi i koliko košta sijanje."
                />
            </div>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                <PlantsMonthChart
                    className="lg:flex-[2] lg:min-w-0"
                    filters={filters}
                    plants={plants}
                />
                <PlantsSeasonPanel
                    className="lg:flex-1 lg:min-w-80"
                    filters={filters}
                    plants={plants}
                />
            </div>
            <Tabs
                value={view}
                defaultValue="popis"
                className="mt-6 w-full scroll-mt-24"
                id={plantArchiveResultsId}
            >
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <Suspense>
                        <PageFilterInputNoSSR
                            searchParamName="pretraga"
                            fieldName="plant-search"
                            initialValue={search}
                            placeholder="Pretraži biljke ili sorte…"
                            className="w-full md:max-w-sm"
                        />
                    </Suspense>
                    <div className="md:ml-auto">
                        <PlantsViewTabs filters={filters} />
                    </div>
                </div>
                <div className="mt-2 empty:hidden">
                    <PlantsActiveFilters filters={filters} />
                </div>
                <PlantsCatalogue filters={filters} plants={plants} />
            </Tabs>
            <PlantsArchiveLinks />
        </Stack>
    );
}
