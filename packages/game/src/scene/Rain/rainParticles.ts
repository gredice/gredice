export const rainParticleVisibilityThreshold = 0.03;

const lightRainParticleCount = 200;
const mediumRainParticleCount = 600;
const heavyRainParticleCount = 2000;

export function normalizeRainParticleIntensity(intensity: number) {
    if (!Number.isFinite(intensity)) {
        return 0;
    }

    return Math.min(1, Math.max(0, intensity));
}

function resolveBaseRainParticleCount(intensity: number) {
    if (intensity < 0.4) {
        return lightRainParticleCount;
    }

    if (intensity > 0.9) {
        return heavyRainParticleCount;
    }

    return mediumRainParticleCount;
}

export function resolveRainParticleState(
    intensity: number,
    particleMultiplier: number,
) {
    const normalizedIntensity = normalizeRainParticleIntensity(intensity);
    const normalizedMultiplier =
        normalizeRainParticleIntensity(particleMultiplier);
    const particleCount = Math.round(
        resolveBaseRainParticleCount(normalizedIntensity) *
            normalizedMultiplier,
    );
    const visible =
        normalizedIntensity > rainParticleVisibilityThreshold &&
        particleCount > 0;

    return {
        activeCount: visible ? particleCount : 0,
        intensity: normalizedIntensity,
    };
}
