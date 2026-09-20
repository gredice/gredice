import type { Metadata } from 'next';
import { KnownPages } from '../../../../src/KnownPages';
import { PlantEditorDynamic } from './PlantEditorDynamic';

export const metadata: Metadata = {
    title: 'Generator biljaka',
    description: 'Generirajte jedinstvene biljke s našim alatom.',
    keywords: [
        'biljke',
        'generator',
        '3D',
        'modeliranje',
        'razvojni model biljke',
        'proceduralno generiranje',
    ],
    alternates: {
        canonical: KnownPages.BlockPlantGenerator,
    },
    // The generator renders one model per query permutation, so it stays
    // crawlable (robots must be able to read this directive) but out of the
    // index and out of the sitemap.
    robots: {
        index: false,
        follow: true,
    },
};

export default async function BlockPlantGeneratorPage(props: {
    searchParams: Promise<{ plant?: string }>;
}) {
    const { plant } = await props.searchParams;
    return (
        <div>
            <PlantEditorDynamic initialPlantType={plant} />
        </div>
    );
}
