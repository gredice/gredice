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
