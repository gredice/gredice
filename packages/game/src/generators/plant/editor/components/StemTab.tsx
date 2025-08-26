'use client';

import { Input } from '@signalco/ui-primitives/Input';
import { Slider } from '@signalco/ui-primitives/Slider';
import type { PlantControlsProps } from '../@types/plant-generator';

export function StemTab({ state, onDefinitionChange }: PlantControlsProps) {
    return (
        <div className="space-y-4">
            <Slider
                label={`Max radijus: ${state.definition.stem.radius.toFixed(3)}`}
                value={[state.definition.stem.radius]}
                onValueChange={(v) => onDefinitionChange('stem.radius', v[0])}
                min={0.01}
                max={0.2}
                step={0.001}
            />
            <Slider
                label={`Dužina segmenta: ${state.definition.stem.length.toFixed(2)}`}
                value={[state.definition.stem.length]}
                onValueChange={(v) => onDefinitionChange('stem.length', v[0])}
                min={0.01}
                max={0.5}
                step={0.01}
            />
            <Slider
                label={`Opadanje radijusa: ${state.definition.stem.radiusDecay.toFixed(2)}`}
                value={[state.definition.stem.radiusDecay]}
                onValueChange={(v) =>
                    onDefinitionChange('stem.radiusDecay', v[0])
                }
                min={0}
                max={2}
                step={0.05}
            />
            <Slider
                label={`Min radijus: ${state.definition.stem.minRadius.toFixed(3)}`}
                value={[state.definition.stem.minRadius]}
                onValueChange={(v) =>
                    onDefinitionChange('stem.minRadius', v[0])
                }
                min={0.001}
                max={0.02}
                step={0.001}
            />
            <Input
                label="Boja"
                type="color"
                value={state.definition.stem.color}
                onChange={(e) =>
                    onDefinitionChange('stem.color', e.target.value)
                }
                className="w-full h-10"
            />
        </div>
    );
}
