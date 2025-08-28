'use client';

import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Input } from '@signalco/ui-primitives/Input';
import { Slider } from '@signalco/ui-primitives/Slider';
import type { PlantControlsProps } from '../@types/plant-generator';

export function FlowerTab({
    state,
    onStateChange,
    onDefinitionChange,
}: PlantControlsProps) {
    return (
        <div className="space-y-4">
            <Checkbox
                id="flower-enabled"
                label="Omogući cvijetove"
                checked={state.definition.flower.enabled}
                onCheckedChange={(checked: boolean) =>
                    onDefinitionChange('flower.enabled', checked)
                }
                className="h-4 w-4"
            />
            <Slider
                label="Početna generacija"
                value={[state.definition.flower.ageStart]}
                onValueChange={(v) =>
                    onDefinitionChange('flower.ageStart', v[0])
                }
                min={0}
                max={10}
                step={1}
                disabled={!state.definition.flower.enabled}
            />
            <Slider
                label={`Rast cvijetova: ${(state.flowerGrowth * 100).toFixed(0)}%`}
                min={0}
                max={1}
                step={0.01}
                value={[state.flowerGrowth]}
                onValueChange={(v) => onStateChange({ flowerGrowth: v[0] })}
                disabled={!state.definition.flower.enabled}
            />
            <Slider
                label={`Max veličina: ${state.definition.flower.size.toFixed(3)}`}
                value={[state.definition.flower.size]}
                onValueChange={(v) => onDefinitionChange('flower.size', v[0])}
                min={0.01}
                max={0.2}
                step={0.005}
                disabled={!state.definition.flower.enabled}
            />
            <Input
                type="color"
                label="Boja"
                value={state.definition.flower.color}
                onChange={(e) =>
                    onDefinitionChange('flower.color', e.target.value)
                }
                className="w-full h-10"
                disabled={!state.definition.flower.enabled}
            />
        </div>
    );
}
