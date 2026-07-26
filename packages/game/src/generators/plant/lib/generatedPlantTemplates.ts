import type { PlantDefinition } from './plant-definitions';

export const generatedPlantTemplateVariantCount = 4;

function hashString(value: string) {
    let hash = 2_166_136_261;

    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }

    return hash >>> 0;
}

export function getGeneratedPlantInstanceVariation(seed: string) {
    const yawUnit = hashString(`${seed}:yaw`) / 0x1_0000_0000;
    const scaleUnit = hashString(`${seed}:scale`) / 0x1_0000_0000;
    const tintRedUnit = hashString(`${seed}:tint:red`) / 0x1_0000_0000;
    const tintGreenUnit = hashString(`${seed}:tint:green`) / 0x1_0000_0000;
    const tintBlueUnit = hashString(`${seed}:tint:blue`) / 0x1_0000_0000;
    const swayPhaseUnit = hashString(`${seed}:sway-phase`) / 0x1_0000_0000;

    return {
        leafColorMultiplier: [
            0.96 + tintRedUnit * 0.08,
            0.96 + tintGreenUnit * 0.08,
            0.96 + tintBlueUnit * 0.08,
        ] as const,
        scaleMultiplier: 0.94 + scaleUnit * 0.12,
        swayPhaseRadians: swayPhaseUnit * Math.PI * 2,
        yawRadians: yawUnit * Math.PI * 2,
    };
}

export function resolveGeneratedPlantTemplateVariant(
    seed: string,
    variantCount = generatedPlantTemplateVariantCount,
) {
    if (!Number.isInteger(variantCount) || variantCount <= 0) {
        throw new RangeError('Plant template variant count must be positive');
    }

    return hashString(seed) % variantCount;
}

export function getGeneratedPlantTemplateSeed({
    definition,
    generation,
    variant,
}: {
    definition: PlantDefinition;
    generation: number;
    variant: number;
}) {
    return `${definition.name}:generation:${generation}:template:${variant}`;
}

export function getGeneratedPlantTemplateKey({
    definition,
    flowerGrowth,
    fruitGrowth,
    generation,
    showFlowers = true,
    showLeaves = true,
    showProduce = true,
    variant,
}: {
    definition: PlantDefinition;
    flowerGrowth: number;
    fruitGrowth: number;
    generation: number;
    showFlowers?: boolean;
    showLeaves?: boolean;
    showProduce?: boolean;
    variant: number;
}) {
    return JSON.stringify([
        definition,
        generation,
        flowerGrowth,
        fruitGrowth,
        showFlowers,
        showLeaves,
        showProduce,
        variant,
    ]);
}
