'use client';

import { Delete, Reset } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
    plantTypeNames,
    plantTypes,
} from '../../lib/plant-definitions';
import type { PlantControlsProps } from '../@types/plant-generator';
import { CreatePlantModal } from './CreatePlantModal';
import { InfoHint } from './InfoHint';
import { PlantSlider } from './PlantSlider';
import { VisibilityControls } from './VisibilityControls';

export function SettingsTab({
    state,
    visibility,
    onStateChange,
    onPlantTypeChange,
    onVisibilityChange,
    onDefinitionChange,
    onRandomizeSeed,
    onCreateCustomPlant,
    onDeleteCustomPlant,
    onResetDefinition,
    canResetDefinition,
}: PlantControlsProps) {
    const allPlants: Record<string, PlantDefinition> = {
        ...plantTypes,
        ...state.customPlants,
    };
    const generationLabel = state.generation.toFixed(1);
    const allPlantNames = [
        ...plantTypeNames,
        ...Object.keys(state.customPlants),
    ];
    const isCustomPlant = !plantTypeNames.includes(state.plantType);

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
                    onValueChange={onPlantTypeChange}
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
            <Row spacing={1} alignItems="center">
                <Button
                    variant="outlined"
                    onClick={onResetDefinition}
                    disabled={!canResetDefinition}
                    className="flex-1"
                >
                    <Reset className="h-4 w-4 shrink-0" />
                    Vrati zadani preset
                </Button>
                <InfoHint
                    label="Kako radi reset"
                    title="Reset na zadani preset"
                >
                    <p>
                        Vraća L-system pravila, boje i ostale parametre na
                        originalni ugrađeni preset trenutne biljke.
                    </p>
                    <p>
                        Za prilagođene biljke gumb je isključen jer nemaju
                        unaprijed zadani izvorni preset.
                    </p>
                </InfoHint>
            </Row>

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

            <PlantSlider
                label={`Generacija: ${generationLabel} (oko ${generationLabel}. tjedan)`}
                min={0}
                max={MAX_PLANT_GENERATION}
                step={0.1}
                value={[state.generation]}
                onValueChange={(v) => onStateChange({ generation: v[0] })}
            />
            <PlantSlider
                label={`Kut: ${state.definition.angle}°`}
                value={[state.definition.angle]}
                onValueChange={(v) => onDefinitionChange('angle', v[0])}
                min={0}
                max={90}
                step={1}
            />
            <PlantSlider
                label={`Visina: ${state.definition.height.toFixed(2)}`}
                value={[state.definition.height]}
                onValueChange={(v) => onDefinitionChange('height', v[0])}
                min={0.1}
                max={2}
                step={0.05}
            />
            <PlantSlider
                label={`Grananje: ${state.definition.branching.toFixed(2)}`}
                value={[state.definition.branching]}
                onValueChange={(v) => onDefinitionChange('branching', v[0])}
                min={0.1}
                max={2}
                step={0.05}
            />
            <PlantSlider
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
