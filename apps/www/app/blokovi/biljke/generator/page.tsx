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

export default function BlockPlantGeneratorPage() {
    return (
        <div>
            <PlantEditorDynamic />
        </div>
    );
}
