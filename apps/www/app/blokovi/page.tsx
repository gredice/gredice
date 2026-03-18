import { directoriesClient } from '@gredice/client';
import { Stack } from '@signalco/ui-primitives/Stack';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageFilterInputNoSSR } from '../../components/shared/PageFilterInputNoSSR';
import { PageHeader } from '../../components/shared/PageHeader';
import { BlockGallery } from './BlockGallery';

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
    const blocks = await getBlocksData();
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
                <BlockGallery blocks={blocks} />
            </Suspense>
        </Stack>
    );
}
