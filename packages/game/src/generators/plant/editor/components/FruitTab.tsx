'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { SelectItems } from '@gredice/ui/SelectItems';
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
    const reproduction = state.definition.development.reproduction;
    const isEnabled = state.definition.vegetable.enabled;
    const hasAerialFruit = reproduction.fruitStart !== undefined;

    return (
        <div className="space-y-4">
            <Checkbox
                id="vegetable-enabled"
                label="Omogući plod ili spremišni organ"
                checked={isEnabled}
                onCheckedChange={(checked: boolean) =>
                    onDefinitionChange('vegetable.enabled', checked)
                }
                className="h-4 w-4"
            />
            <SelectItems
                label="Vrsta ploda"
                value={state.definition.vegetable.type}
                items={vegetableTypeOptions}
                onValueChange={(value) =>
                    onDefinitionChange('vegetable.type', value)
                }
                disabled={!isEnabled}
            />
            <Checkbox
                id="aerial-fruit-enabled"
                label="Razvijaj nadzemne plodove"
                checked={hasAerialFruit}
                onCheckedChange={(checked: boolean) =>
                    onDefinitionChange(
                        'development.reproduction.fruitStart',
                        checked
                            ? Math.min(
                                  MAX_PLANT_GENERATION,
                                  reproduction.flowerStart + 2,
                              )
                            : undefined,
                    )
                }
                className="h-4 w-4"
                disabled={!isEnabled}
            />
            {reproduction.fruitStart !== undefined ? (
                <PlantSlider
                    label={`Početak razvoja ploda: ${reproduction.fruitStart.toFixed(1)}`}
                    value={[reproduction.fruitStart]}
                    onValueChange={(value) =>
                        onDefinitionChange(
                            'development.reproduction.fruitStart',
                            value[0],
                        )
                    }
                    min={0}
                    max={MAX_PLANT_GENERATION}
                    step={0.1}
                    disabled={!isEnabled}
                />
            ) : null}
            <PlantSlider
                label={`Broj plodova: ${reproduction.produceCount}`}
                value={[reproduction.produceCount]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.reproduction.produceCount',
                        value[0],
                    )
                }
                min={0}
                max={30}
                step={1}
                disabled={!isEnabled || !hasAerialFruit}
            />
            <PlantSlider
                label={`Prikaz rasta ploda: ${(state.fruitGrowth * 100).toFixed(0)}%`}
                min={0}
                max={1}
                step={0.01}
                value={[state.fruitGrowth]}
                onValueChange={(value) =>
                    onStateChange({ fruitGrowth: value[0] })
                }
                disabled={!isEnabled}
            />
            <PlantSlider
                label={`Završna veličina: ${state.definition.vegetable.baseSize.toFixed(2)}`}
                value={[state.definition.vegetable.baseSize]}
                onValueChange={(value) =>
                    onDefinitionChange('vegetable.baseSize', value[0])
                }
                min={0.02}
                max={0.8}
                step={0.01}
                disabled={!isEnabled}
            />
        </div>
    );
}
