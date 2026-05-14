import { Stack } from '@signalco/ui-primitives/Stack';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFilterInputNoSSR } from '../../../components/shared/PageFilterInputNoSSR';
import { PageHeader } from '../../../components/shared/PageHeader';
import { getPlantsData } from '../../../lib/plants/getPlantsData';
import { PlantBlockGallery } from '../PlantBlockGallery';

export const revalidate = 3600;

export const metadata: Metadata = {
    title: 'Biljke - 3D prikaz',
    description: 'Pregledaj kako biljke rastu u 3D prikazu.',
};

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
