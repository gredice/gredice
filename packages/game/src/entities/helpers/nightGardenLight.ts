import { isNightTimeOfDay } from '@gredice/js/blocks';

const gardenNightLightIntensityMultiplier = 10;
const gardenNightLightEmissivePeakMultiplier = 0.2;

export function resolveGardenNightLightIntensity(lightIntensity: number) {
    return lightIntensity * gardenNightLightIntensityMultiplier;
}

export function resolveGardenNightLightEmissivePeakIntensity(
    emissivePeakIntensity: number,
) {
    return emissivePeakIntensity * gardenNightLightEmissivePeakMultiplier;
}

export function getNightGardenGlowAmount(timeOfDay: number) {
    if (isNightTimeOfDay(timeOfDay)) {
        return 1;
    }

    const dawnFadeStart = 0.2;
    const dawnFadeEnd = 0.26;
    const duskFadeStart = 0.74;
    const duskFadeEnd = 0.8;

    if (timeOfDay > dawnFadeStart && timeOfDay < dawnFadeEnd) {
        return 1 - (timeOfDay - dawnFadeStart) / (dawnFadeEnd - dawnFadeStart);
    }

    if (timeOfDay > duskFadeStart && timeOfDay < duskFadeEnd) {
        return (timeOfDay - duskFadeStart) / (duskFadeEnd - duskFadeStart);
    }

    return 0;
}

export function resolveNightGardenLightFrame({
    emissiveBaseIntensity,
    emissivePeakIntensity,
    lightIntensity,
    physicalLightSelected,
    timeOfDay,
}: {
    emissiveBaseIntensity: number;
    emissivePeakIntensity: number;
    lightIntensity: number;
    physicalLightSelected: boolean;
    timeOfDay: number;
}) {
    const amount = getNightGardenGlowAmount(timeOfDay);
    const lightVisible = physicalLightSelected && amount > 0.001;

    return {
        emissiveIntensity:
            emissiveBaseIntensity +
            amount * (emissivePeakIntensity - emissiveBaseIntensity),
        lightIntensity: lightVisible ? amount * lightIntensity : 0,
        lightVisible,
    };
}

export function getNightGardenLightPhase(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) % 100_000;
    }
    return (hash / 100_000) * Math.PI * 2;
}
