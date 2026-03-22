import type { Metadata } from 'next';
import { PlantEditorDynamic } from './PlantEditorDynamic';

export const metadata: Metadata = {
    title: 'Generator biljaka',
    description: 'Generirajte jedinstvene biljke s našim alatom.',
    keywords: [
        'biljke',
        'generator',
        '3D',
        'modeliranje',
        'lsystem',
        'proceduralno generiranje',
    ],
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
