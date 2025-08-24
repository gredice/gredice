import { directoriesClient } from '@gredice/client';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Suspense } from 'react';
import { PageFilterInput } from '../../components/shared/PageFilterInput';
import { PageHeader } from '../../components/shared/PageHeader';
import { BlockGallery } from './BlockGallery';

export const revalidate = 3600; // 1 hour
export const metadata = {
    title: 'Blokovi',
    description: 'Pregledaj sve blokove koje možeš koristiti u svom vrtu.',
};

export default async function BlocksPage() {
    const blocks = (await directoriesClient().GET('/entities/block')).data;
    return (
        <Stack>
            <PageHeader
                padded
                header="Blokovi"
                subHeader="Pregledaj sve blokove koje možeš koristiti u svom vrtu."
            >
                <Suspense>
                    <PageFilterInput
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
