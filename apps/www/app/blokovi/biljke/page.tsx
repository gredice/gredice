import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFilterInputNoSSR } from '../../../components/shared/PageFilterInputNoSSR';
import { getPlantsData } from '../../../lib/plants/getPlantsData';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../src/KnownPages';
import { PlantBlockGallery } from '../PlantBlockGallery';

export const revalidate = 43200; // 12 hours

export const metadata: Metadata = createPublicMetadata({
    title: 'Biljke - 3D prikaz',
    description: 'Pregledaj kako biljke rastu u 3D prikazu.',
    path: KnownPages.BlockPlants,
    category: '3D prikaz biljaka',
});

export default async function BlockPlantsPage() {
    const plants = await getPlantsData();
    return (
        <Stack>
            <PageHeader
                padded
                header="Biljke"
                subHeader="Pregledaj kako biljke rastu u 3D prikazu."
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
                <PlantBlockGallery plants={plants} />
            </Suspense>
        </Stack>
    );
}
