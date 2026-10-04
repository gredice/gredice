'use client';

import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import type { PlantControlsProps } from '../@types/plant-generator';
import { PlantSlider } from './PlantSlider';

const leafTypeOptions = [
    { value: 'round', label: 'Okrugli' },
    { value: 'oval', label: 'Ovalni' },
    { value: 'heart', label: 'Srcoliki' },
    { value: 'serrated', label: 'Nazubljeni' },
    { value: 'compound', label: 'Složeni' },
    { value: 'ruffled', label: 'Naborani' },
    { value: 'lobed', label: 'Režnjasti' },
    { value: 'strap', label: 'Trakasti' },
    { value: 'tubular', label: 'Cjevasti' },
    { value: 'lanceolate', label: 'Lancetasti' },
    { value: 'trifoliate', label: 'Trolisni' },
    { value: 'pinnate', label: 'Perasti' },
    { value: 'feathery', label: 'Pahuljasti' },
    { value: 'palmate', label: 'Dlanasti' },
];

export function LeafTab({ state, onDefinitionChange }: PlantControlsProps) {
    const foliage = state.definition.development.foliage;
    const [minimumPitch, maximumPitch] = foliage.pitchRangeDegrees;
    const [minimumSize, maximumSize] = foliage.sizeRange;

    return (
        <div className="space-y-4">
            <PlantSlider
                label={`Osnovna veličina: ${state.definition.leaf.size.toFixed(2)}`}
                value={[state.definition.leaf.size]}
                onValueChange={(value) =>
                    onDefinitionChange('leaf.size', value[0])
                }
                min={0.02}
                max={1}
                step={0.01}
            />
            <PlantSlider
                label={`Broj listova: ${foliage.count}`}
                value={[foliage.count]}
                onValueChange={(value) =>
                    onDefinitionChange('development.foliage.count', value[0])
                }
                min={0}
                max={80}
                step={1}
            />
            <PlantSlider
                label={`Dužina peteljke: ${foliage.petioleLengthScale.toFixed(2)}`}
                value={[foliage.petioleLengthScale]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.foliage.petioleLengthScale',
                        value[0],
                    )
                }
                min={0}
                max={1.5}
                step={0.05}
            />
            <PlantSlider
                label={`Najmanji nagib: ${minimumPitch.toFixed(0)}°`}
                value={[minimumPitch]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.foliage.pitchRangeDegrees',
                        [Math.min(value[0], maximumPitch), maximumPitch],
                    )
                }
                min={0}
                max={90}
                step={1}
            />
            <PlantSlider
                label={`Najveći nagib: ${maximumPitch.toFixed(0)}°`}
                value={[maximumPitch]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.foliage.pitchRangeDegrees',
                        [minimumPitch, Math.max(value[0], minimumPitch)],
                    )
                }
                min={0}
                max={90}
                step={1}
            />
            <PlantSlider
                label={`Najmanja relativna veličina: ${minimumSize.toFixed(2)}`}
                value={[minimumSize]}
                onValueChange={(value) =>
                    onDefinitionChange('development.foliage.sizeRange', [
                        Math.min(value[0], maximumSize),
                        maximumSize,
                    ])
                }
                min={0.1}
                max={1.5}
                step={0.05}
            />
            <PlantSlider
                label={`Najveća relativna veličina: ${maximumSize.toFixed(2)}`}
                value={[maximumSize]}
                onValueChange={(value) =>
                    onDefinitionChange('development.foliage.sizeRange', [
                        minimumSize,
                        Math.max(value[0], minimumSize),
                    ])
                }
                min={0.1}
                max={1.5}
                step={0.05}
            />
            <SelectItems
                label="Vrsta"
                value={state.definition.leaf.type}
                items={leafTypeOptions}
                onValueChange={(value) =>
                    onDefinitionChange('leaf.type', value)
                }
            />
            <Input
                label="Boja"
                type="color"
                value={state.definition.leaf.color}
                onChange={(event) =>
                    onDefinitionChange('leaf.color', event.target.value)
                }
                className="h-10 w-full"
            />
        </div>
    );
}
