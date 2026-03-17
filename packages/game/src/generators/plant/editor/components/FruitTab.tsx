'use client';

import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import {
    MAX_PLANT_GENERATION,
    vegetableTypeOptions,
} from '../../lib/plant-definitions';
import type { PlantControlsProps } from '../@types/plant-generator';
import { PlantSlider } from './PlantSlider';

export function FruitTab({
    state,
    onStateChange,
    onDefinitionChange,
}: PlantControlsProps) {
    return (
        <div className="space-y-4">
            <Checkbox
                id="vegetable-enabled"
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
                items={vegetableTypeOptions}
                onValueChange={(v) => onDefinitionChange('vegetable.type', v)}
                disabled={!state.definition.vegetable.enabled}
            />
            <PlantSlider
                label={`Početna generacija: ${state.definition.vegetable.ageStart} (oko ${state.definition.vegetable.ageStart}. tjedan)`}
                value={[state.definition.vegetable.ageStart]}
                onValueChange={(v) =>
                    onDefinitionChange('vegetable.ageStart', v[0])
                }
                min={0}
                max={MAX_PLANT_GENERATION}
                step={1}
                disabled={!state.definition.vegetable.enabled}
            />
            <PlantSlider
                label={`Rast ploda: ${(state.fruitGrowth * 100).toFixed(0)}%`}
                min={0}
                max={1}
                step={0.01}
                value={[state.fruitGrowth]}
                onValueChange={(v) => onStateChange({ fruitGrowth: v[0] })}
                disabled={!state.definition.vegetable.enabled}
            />
            <PlantSlider
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
            <PlantSlider
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
