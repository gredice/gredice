'use client';

import { Delete, Reset } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Slider } from '@signalco/ui-primitives/Slider';
import { plantNames, plantTypes } from '../../lib/plant-definitions';
import type { PlantControlsProps } from '../@types/plant-generator';
import { CreatePlantModal } from './CreatePlantModal';
import { VisibilityControls } from './VisibilityControls';

export function SettingsTab({
    state,
    visibility,
    onStateChange,
    onVisibilityChange,
    onDefinitionChange,
    onRandomizeSeed,
    onCreateCustomPlant,
    onDeleteCustomPlant,
}: PlantControlsProps) {
    const allPlants = { ...plantTypes, ...state.customPlants };
    const allPlantNames = [...plantNames, ...Object.keys(state.customPlants)];
    const isCustomPlant = !plantNames.includes(state.plantType);

    return (
        <div className="space-y-4">
            {/* Plant Type Selection */}
            <Row spacing={1} alignItems="end">
                <SelectItems
                    items={allPlantNames.map((name) => ({
                        value: name,
                        label: allPlants[name].name,
                    }))}
                    className="w-full"
                    label="Vrsta biljke"
                    onValueChange={(value) =>
                        onStateChange({ plantType: value })
                    }
                    value={state.plantType}
                />
                {isCustomPlant && (
                    <IconButton
                        title="Obriši biljku"
                        variant="plain"
                        onClick={() => onDeleteCustomPlant(state.plantType)}
                        className="text-red-500 hover:text-red-700"
                    >
                        <Delete className="h-4 w-4" />
                    </IconButton>
                )}
            </Row>

            {/* Create Custom Plant Button */}
            <CreatePlantModal
                currentDefinition={state.definition}
                existingNames={allPlantNames.map((name) => name.toLowerCase())}
                onCreatePlant={onCreateCustomPlant}
            />

            {/* Plant Name (editable for custom plants) */}
            {isCustomPlant && (
                <Input
                    label="Naziv biljke"
                    value={state.definition.name}
                    onChange={(e) => onDefinitionChange('name', e.target.value)}
                    placeholder="Enter plant name..."
                />
            )}
            <Row spacing={1} alignItems="end">
                <Input
                    label="Sjeme"
                    value={state.seed}
                    fullWidth
                    onChange={(e) => onStateChange({ seed: e.target.value })}
                />
                <IconButton
                    title="Novo sjeme"
                    variant="plain"
                    onClick={onRandomizeSeed}
                >
                    <Reset className="h-4 w-4" />
                </IconButton>
            </Row>

            <Slider
                label={`Generacija: ${state.generation}`}
                min={0}
                max={12}
                step={1}
                value={[state.generation]}
                onValueChange={(v) => onStateChange({ generation: v[0] })}
            />
            <Slider
                label={`Kut: ${state.definition.angle}°`}
                value={[state.definition.angle]}
                onValueChange={(v) => onDefinitionChange('angle', v[0])}
                min={0}
                max={90}
                step={1}
            />
            <Slider
                label={`Visina: ${state.definition.height.toFixed(2)}`}
                value={[state.definition.height]}
                onValueChange={(v) => onDefinitionChange('height', v[0])}
                min={0.1}
                max={2}
                step={0.05}
            />
            <Slider
                label={`Grananje: ${state.definition.branching.toFixed(2)}`}
                value={[state.definition.branching]}
                onValueChange={(v) => onDefinitionChange('branching', v[0])}
                min={0.1}
                max={2}
                step={0.05}
            />
            <Slider
                label={`Nestabilnost: ${state.definition.directionVariability.toFixed(2)}`}
                value={[state.definition.directionVariability]}
                onValueChange={(v) =>
                    onDefinitionChange('directionVariability', v[0])
                }
                min={0}
                max={1}
                step={0.01}
            />
            <VisibilityControls
                visibility={visibility}
                onVisibilityChange={onVisibilityChange}
            />
        </div>
    );
}
