'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { MAX_PLANT_GENERATION } from '../../lib/plant-definitions';
import type { PlantControlsProps } from '../@types/plant-generator';
import { PlantSlider } from './PlantSlider';

const flowerFormOptions = [
    { value: 'cluster', label: 'Skupina' },
    { value: 'pea', label: 'Leptirasti' },
    { value: 'pom-pom', label: 'Kuglasti' },
    { value: 'spike', label: 'Klasasti' },
    { value: 'star', label: 'Zvjezdasti' },
    { value: 'umbel', label: 'Štitasti' },
];

export function FlowerTab({
    state,
    onStateChange,
    onDefinitionChange,
}: PlantControlsProps) {
    const reproduction = state.definition.development.reproduction;
    const isEnabled = state.definition.flower.enabled;

    return (
        <div className="space-y-4">
            <Checkbox
                id="flower-enabled"
                label="Omogući cvjetove"
                checked={isEnabled}
                onCheckedChange={(checked: boolean) =>
                    onDefinitionChange('flower.enabled', checked)
                }
                className="h-4 w-4"
            />
            <SelectItems
                label="Oblik cvata"
                value={reproduction.form}
                items={flowerFormOptions}
                onValueChange={(value) =>
                    onDefinitionChange('development.reproduction.form', value)
                }
                disabled={!isEnabled}
            />
            <PlantSlider
                label={`Početak cvatnje: ${reproduction.flowerStart.toFixed(1)}`}
                value={[reproduction.flowerStart]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.reproduction.flowerStart',
                        value[0],
                    )
                }
                min={0}
                max={MAX_PLANT_GENERATION}
                step={0.1}
                disabled={!isEnabled}
            />
            <PlantSlider
                label={`Broj mjesta cvatnje: ${reproduction.siteCount}`}
                value={[reproduction.siteCount]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.reproduction.siteCount',
                        value[0],
                    )
                }
                min={0}
                max={24}
                step={1}
                disabled={!isEnabled}
            />
            <PlantSlider
                label={`Cvjetova po mjestu: ${reproduction.flowersPerSite}`}
                value={[reproduction.flowersPerSite]}
                onValueChange={(value) =>
                    onDefinitionChange(
                        'development.reproduction.flowersPerSite',
                        value[0],
                    )
                }
                min={0}
                max={12}
                step={1}
                disabled={!isEnabled}
            />
            <PlantSlider
                label={`Prikaz rasta cvjetova: ${(state.flowerGrowth * 100).toFixed(0)}%`}
                min={0}
                max={1}
                step={0.01}
                value={[state.flowerGrowth]}
                onValueChange={(value) =>
                    onStateChange({ flowerGrowth: value[0] })
                }
                disabled={!isEnabled}
            />
            <PlantSlider
                label={`Završna veličina: ${state.definition.flower.size.toFixed(3)}`}
                value={[state.definition.flower.size]}
                onValueChange={(value) =>
                    onDefinitionChange('flower.size', value[0])
                }
                min={0.01}
                max={0.3}
                step={0.005}
                disabled={!isEnabled}
            />
            <Input
                type="color"
                label="Boja"
                value={state.definition.flower.color}
                onChange={(event) =>
                    onDefinitionChange('flower.color', event.target.value)
                }
                className="h-10 w-full"
                disabled={!isEnabled}
            />
        </div>
    );
}
