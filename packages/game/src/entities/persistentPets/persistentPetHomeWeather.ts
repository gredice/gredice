const solidSurfaceWeather = {
    rain: {
        darkness: 0.65,
        glossiness: 0.44,
        topSurfaceBias: 2.4,
    },
    snow: {
        coverageMultiplier: 0.55,
        maxThickness: 0.04,
        noiseScale: 3.2,
        slopeExponent: 2.8,
    },
};

const roofSurfaceWeather = {
    rain: solidSurfaceWeather.rain,
    snow: {
        ...solidSurfaceWeather.snow,
        coverageMultiplier: 1,
        maxThickness: 0.085,
    },
};

export function getPersistentPetHomeSurfaceWeather(nodeName: string) {
    return nodeName.includes('_Roof')
        ? roofSurfaceWeather
        : solidSurfaceWeather;
}
