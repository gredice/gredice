'use client';

import { useMemo } from 'react';
import { useGeneratedLSystemSymbols } from '../../generators/plant/hooks/useGeneratedLSystem';
import {
    MAX_PLANT_GENERATION,
    type PlantDefinition,
} from '../../generators/plant/lib/plant-definitions';
import { PlantGenerator } from '../../generators/plant/PlantGenerator';

interface RaisedBedGeneratedPlantProps {
    definition: PlantDefinition;
    generation: number;
    position: readonly [number, number, number];
    scale: number;
    seed: string;
}

export function RaisedBedGeneratedPlant({
    definition,
    generation,
    position,
    scale,
    seed,
}: RaisedBedGeneratedPlantProps) {
    const clampedGeneration = Math.min(
        MAX_PLANT_GENERATION,
        Math.max(0, generation),
    );
    const lSystemTask = useMemo(
        () => ({
            axiom: definition.axiom,
            iterations: Math.ceil(clampedGeneration),
            rules: definition.rules,
            seed,
        }),
        [clampedGeneration, definition.axiom, definition.rules, seed],
    );
    const { symbols: lSystemSymbolsResult } =
        useGeneratedLSystemSymbols(lSystemTask);
    const lSystemSymbols = lSystemSymbolsResult ?? [];

    return (
        <group position={position} scale={[scale, scale, scale]}>
            <PlantGenerator
                plantDefinition={definition}
                lSystemSymbols={lSystemSymbols}
                generation={clampedGeneration}
                seed={seed}
                flowerGrowth={1}
                fruitGrowth={1}
            />
        </group>
    );
}
