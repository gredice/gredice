'use client';

import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Slider } from '@signalco/ui-primitives/Slider';
import type { PlantControlsProps } from '../@types/plant-generator';

export function LeafTab({ state, onDefinitionChange }: PlantControlsProps) {
    return (
        <div className="space-y-4">
            <Slider
                label={`Max veličina: ${state.definition.leaf.size.toFixed(2)}`}
                value={[state.definition.leaf.size]}
                onValueChange={(v) => onDefinitionChange('leaf.size', v[0])}
                min={0.05}
                max={1}
                step={0.01}
            />
            <Slider
                label={`Opadanje veličine: ${state.definition.leaf.sizeDecay.toFixed(2)}`}
                value={[state.definition.leaf.sizeDecay]}
                onValueChange={(v) =>
                    onDefinitionChange('leaf.sizeDecay', v[0])
                }
                min={0}
                max={2}
                step={0.05}
            />
            <Slider
                label={`Gustoća: ${state.definition.leaf.density}`}
                value={[state.definition.leaf.density]}
                onValueChange={(v) => onDefinitionChange('leaf.density', v[0])}
                min={1}
                max={5}
                step={1}
            />
            <Slider
                label={`Kut visenja: ${state.definition.leaf.hangAngle}°`}
                value={[state.definition.leaf.hangAngle]}
                onValueChange={(v) =>
                    onDefinitionChange('leaf.hangAngle', v[0])
                }
                min={0}
                max={90}
                step={1}
            />
            <Slider
                label={`Nasumičnost visenja: ${state.definition.leaf.hangAngleRandomness}°`}
                value={[state.definition.leaf.hangAngleRandomness]}
                onValueChange={(v) =>
                    onDefinitionChange('leaf.hangAngleRandomness', v[0])
                }
                min={0}
                max={45}
                step={1}
            />
            <SelectItems
                label="Vrsta"
                value={state.definition.leaf.type}
                items={[
                    { value: 'round', label: 'Round' },
                    { value: 'oval', label: 'Oval' },
                    { value: 'heart', label: 'Heart' },
                    { value: 'serrated', label: 'Serrated' },
                    { value: 'compound', label: 'Compound' },
                ]}
                onValueChange={(v) => onDefinitionChange('leaf.type', v)}
            />
            <Input
                label="Boja"
                type="color"
                value={state.definition.leaf.color}
                onChange={(e) =>
                    onDefinitionChange('leaf.color', e.target.value)
                }
                className="w-full h-10"
            />
        </div>
    );
}
