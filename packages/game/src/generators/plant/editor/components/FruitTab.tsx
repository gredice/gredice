'use client';

import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Slider } from '@signalco/ui-primitives/Slider';
import type { VegetableType } from '../../lib/plant-definitions';
import type { PlantControlsProps } from '../@types/plant-generator';

export function FruitTab({
    state,
    onStateChange,
    onDefinitionChange,
}: PlantControlsProps) {
    const vegetableTypes: { value: VegetableType; label: string }[] = [
        { value: 'tomato', label: 'Tomato' },
        { value: 'cucumber', label: 'Cucumber' },
        { value: 'bellpepper', label: 'Bell Pepper' },
        { value: 'carrot', label: 'Carrot' },
        { value: 'onion', label: 'Onion' },
    ];

    return (
        <div className="space-y-4">
            <Checkbox
                id="vegetable-enabled§"
                label="Omogući plodove"
                checked={state.definition.vegetable.enabled}
                onCheckedChange={(checked: boolean) =>
                    onDefinitionChange('vegetable.enabled', checked)
                }
                className="h-4 w-4"
            />
            <SelectItems
                label="Vrsta ploda"
                value={state.definition.vegetable.type}
                items={vegetableTypes}
                onValueChange={(v) => onDefinitionChange('vegetable.type', v)}
                disabled={!state.definition.vegetable.enabled}
            />
            <Slider
                label={`Početna generacija: ${state.definition.vegetable.ageStart}`}
                value={[state.definition.vegetable.ageStart]}
                onValueChange={(v) =>
                    onDefinitionChange('vegetable.ageStart', v[0])
                }
                min={0}
                max={10}
                step={1}
                disabled={!state.definition.vegetable.enabled}
            />
            <Slider
                label={`Rast ploda: ${(state.fruitGrowth * 100).toFixed(0)}%`}
                min={0}
                max={1}
                step={0.01}
                value={[state.fruitGrowth]}
                onValueChange={(v) => onStateChange({ fruitGrowth: v[0] })}
                disabled={!state.definition.vegetable.enabled}
            />
            <Slider
                label={`Prinos: ${state.definition.vegetable.yield.toFixed(2)}`}
                value={[state.definition.vegetable.yield]}
                onValueChange={(v) =>
                    onDefinitionChange('vegetable.yield', v[0])
                }
                min={0}
                max={1}
                step={0.05}
                disabled={!state.definition.vegetable.enabled}
            />
            <Slider
                label={`Završna veličina: ${state.definition.vegetable.baseSize.toFixed(2)}`}
                value={[state.definition.vegetable.baseSize]}
                onValueChange={(v) =>
                    onDefinitionChange('vegetable.baseSize', v[0])
                }
                min={0.05}
                max={0.5}
                step={0.01}
                disabled={!state.definition.vegetable.enabled}
            />
        </div>
    );
}
