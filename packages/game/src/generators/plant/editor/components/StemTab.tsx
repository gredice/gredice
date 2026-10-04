'use client';

import { Checkbox } from '@gredice/ui/Checkbox';
import { Input } from '@gredice/ui/Input';
import { defaultThornDefinition } from '../../lib/plant-definitions';
import type { PlantControlsProps } from '../@types/plant-generator';
import { PlantSlider } from './PlantSlider';

export function StemTab({
    state,
    onDefinitionChange,
    onDefinitionChanges,
}: PlantControlsProps) {
    const thorn = state.definition.thorn ?? defaultThornDefinition;
    const special = state.definition.development.special ?? {};
    const thornCount = special.thornCount ?? 0;

    return (
        <div className="space-y-4">
            <PlantSlider
                label={`Max radijus: ${state.definition.stem.radius.toFixed(3)}`}
                value={[state.definition.stem.radius]}
                onValueChange={(v) => onDefinitionChange('stem.radius', v[0])}
                min={0.01}
                max={0.2}
                step={0.001}
            />
            <PlantSlider
                label={`Opadanje radijusa: ${state.definition.stem.radiusDecay.toFixed(2)}`}
                value={[state.definition.stem.radiusDecay]}
                onValueChange={(v) =>
                    onDefinitionChange('stem.radiusDecay', v[0])
                }
                min={0}
                max={2}
                step={0.05}
            />
            <PlantSlider
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
            <Checkbox
                id="thorn-enabled"
                label="Omogući trnje / bodlje"
                checked={thorn.enabled}
                onCheckedChange={(checked: boolean) => {
                    onDefinitionChanges([
                        { path: 'thorn.enabled', value: checked },
                        {
                            path: 'development.special',
                            value: {
                                ...special,
                                thornCount: checked
                                    ? Math.max(8, thornCount)
                                    : 0,
                            },
                        },
                    ]);
                }}
                className="h-4 w-4"
            />
            <PlantSlider
                label={`Veličina trnja: ${thorn.size.toFixed(2)}`}
                value={[thorn.size]}
                onValueChange={(v) => onDefinitionChange('thorn.size', v[0])}
                min={0.02}
                max={0.2}
                step={0.01}
                disabled={!thorn.enabled}
            />
            <PlantSlider
                label={`Broj trnja: ${thornCount}`}
                value={[thornCount]}
                onValueChange={(value) =>
                    onDefinitionChange('development.special', {
                        ...special,
                        thornCount: value[0],
                    })
                }
                min={0}
                max={80}
                step={1}
                disabled={!thorn.enabled}
            />
            <Input
                label="Boja trnja"
                type="color"
                value={thorn.color}
                onChange={(e) =>
                    onDefinitionChange('thorn.color', e.target.value)
                }
                className="w-full h-10"
                disabled={!thorn.enabled}
            />
        </div>
    );
}
