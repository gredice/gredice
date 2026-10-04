export type WeatherPart =
    | 'sun'
    | 'moon'
    | 'cloud'
    | 'raindrop'
    | 'snowflake'
    | 'lightning'
    | 'fog';

export type WeatherDefinition = {
    name: string;
    label: string;
    sky: 'clear' | 'few' | 'partly' | 'mostly' | 'cloudy' | 'overcast' | 'fog';
    precipitation?: { kind: 'rain' | 'snow' | 'sleet'; intensity: 1 | 2 | 3 };
    thunder?: boolean;
    fog?: boolean;
};

export type WeatherPeriod = 'day' | 'night';

export type WeatherLayer = {
    id: string;
    part: WeatherPart;
    x: number;
    y: number;
    width: number;
    height: number;
    brightness?: number;
};

/** Compose in a fixed 64px square: sky behind cloud, effects underneath. */
export function composeWeatherLayers(
    definition: WeatherDefinition,
    period: WeatherPeriod,
): WeatherLayer[] {
    const { sky, precipitation, thunder, fog } = definition;
    const layers: WeatherLayer[] = [];
    const hasEffects = Boolean(precipitation || thunder || fog);
    const hasCelestial = ['clear', 'few', 'partly', 'mostly'].includes(sky);
    const cloudBrightness = period === 'night' ? 0.78 : thunder ? 0.86 : 1;

    if (hasCelestial) {
        const size =
            sky === 'clear' ? (fog ? 38 : 52) : sky === 'few' ? 40 : 32;
        layers.push({
            id: 'celestial',
            part: period === 'day' ? 'sun' : 'moon',
            x: sky === 'clear' ? (64 - size) / 2 : 2,
            y: sky === 'clear' && !fog ? 6 : 0,
            width: size,
            height: size,
        });
    }

    if (sky !== 'clear' && sky !== 'fog') {
        if (sky === 'overcast') {
            layers.push({
                id: 'back-cloud',
                part: 'cloud',
                x: 2,
                y: hasEffects ? 4 : 9,
                width: 42,
                height: 30,
                brightness: cloudBrightness * 0.83,
            });
        }
        const smallCloud = sky === 'few' && !hasEffects;
        layers.push({
            id: 'cloud',
            part: 'cloud',
            x: smallCloud ? 28 : sky === 'partly' && !hasEffects ? 17 : 6,
            y: hasEffects ? 12 : smallCloud ? 29 : 20,
            width: smallCloud ? 34 : sky === 'partly' && !hasEffects ? 45 : 56,
            height: hasEffects ? 33 : smallCloud ? 25 : 38,
            brightness: cloudBrightness,
        });
    }

    if (fog) {
        layers.push({
            id: 'fog',
            part: 'fog',
            x: 3,
            y:
                sky === 'fog'
                    ? 17
                    : precipitation
                      ? 33
                      : sky === 'clear'
                        ? 30
                        : 35,
            width: 58,
            height: sky === 'fog' ? 32 : precipitation ? 18 : 26,
            brightness: period === 'night' ? 0.88 : 1,
        });
    }

    if (thunder) {
        layers.push({
            id: 'lightning',
            part: 'lightning',
            x: precipitation ? 7 : 23,
            y: 33,
            width: 21,
            height: 30,
        });
    }

    if (precipitation) {
        // Sleet always includes both water and snow, even at light intensity.
        const count =
            precipitation.intensity + (precipitation.kind === 'sleet' ? 1 : 0);
        const centers =
            count === 1
                ? [32]
                : count === 2
                  ? [22, 42]
                  : count === 3
                    ? [16, 32, 48]
                    : [10, 24, 40, 54];
        for (let index = 0; index < count; index += 1) {
            const snow =
                precipitation.kind === 'snow' ||
                (precipitation.kind === 'sleet' && index % 2 === 1);
            const size = fog ? 13 : snow ? 17 : 16;
            const width = snow ? size : thunder && count === 3 ? 9 : 11;
            const center = thunder
                ? count === 1
                    ? 46
                    : 33 + (index * 23) / (count - 1)
                : centers[index];
            layers.push({
                id: `precipitation-${index}`,
                part: snow ? 'snowflake' : 'raindrop',
                x: center - width / 2,
                y: fog ? 50 : 44 + (index % 2 === 1 ? 2 : 0),
                width,
                height: size,
            });
        }
    }
    return layers;
}
