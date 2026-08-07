import { directoriesClient } from '@gredice/client';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFilterInputNoSSR } from '../../components/shared/PageFilterInputNoSSR';
import { getPlantsData } from '../../lib/plants/getPlantsData';
import { BlockPlantGalleries } from './BlockPlantGalleries';

export const revalidate = 3600; // 1 hour
export const metadata: Metadata = {
    title: 'Blokovi',
    description: 'Pregledaj sve blokove koje možeš koristiti u svom vrtu.',
};

async function getBlocksData() {
    try {
        const { data, error } =
            await directoriesClient().GET('/entities/block');
        if (error) {
            console.error('Failed to fetch blocks data', error);
            return [];
        }

        return data ?? [];
    } catch (error) {
        console.error('Failed to fetch blocks data', error);
        return [];
    }
}

export default async function BlocksPage() {
    const [blocks, plants] = await Promise.all([
        getBlocksData(),
        getPlantsData(),
    ]);
    return (
        <Stack>
            <PageHeader
                padded
                header="Blokovi"
                subHeader="Pregledaj sve blokove koje možeš koristiti u svom vrtu."
            >
                <Suspense>
                    <PageFilterInputNoSSR
                        searchParamName="pretraga"
                        fieldName="block-search"
                        className="lg:flex items-start justify-end"
                    />
                </Suspense>
            </PageHeader>
            <Suspense>
                <BlockPlantGalleries blocks={blocks} plants={plants} />
            </Suspense>
        </Stack>
    );
}
