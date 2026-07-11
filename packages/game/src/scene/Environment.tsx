'use client';

import { useFrame, useThree } from '@react-three/fiber';
import chroma from 'chroma-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as SunCalc from 'suncalc';
import { Color, type Vector3 } from 'three';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useLiveTime } from '../hooks/useLiveTime';
import { useSnapshotTime } from '../hooks/useSnapshotTime';
import { useWeatherNow } from '../hooks/useWeatherNow';
import type { Stack } from '../types/Stack';
import { type GameState, useGameState } from '../useGameState';
import { defaultGameBackgroundPaletteIndex } from './backgroundPalettes';
import { CloudLayer } from './CloudLayer';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import {
    type GameQualityProfile,
    resolveGameQualityProfile,
} from './gameQuality';
import { getMoonlitNightScales } from './moonlight';
import { Drops } from './Rain/Drops';
import { useSceneTimeInvalidation } from './SceneTime';
import { ShadowMapController } from './ShadowMapController';
import { SkyGradientBackground } from './SkyGradientBackground';
import Snow from './Snow/Snow';
import { Stars } from './Stars';
import { SunMoon } from './SunMoon';
import {
    resolveEnvironmentSkyBackgroundColors,
    resolveSkyBackgroundColor,
    resolveSkyGradientColors,
    resolveThemedSkyBackgroundColors,
} from './skyGradient';
import { altAzToScenePosition, timeOfDayToDate } from './sunPosition';
import {
    getVisualDaylightAmount,
    getVisualNightAmount,
    smoothstep,
    visualDayNightTimes,
} from './visualDayNight';
import { resolveWaterColors } from './waterColors';

const sunTemperatureScale = chroma
    .scale([
        chroma.temperature(20000),
        chroma.temperature(8000),
        chroma.temperature(6000),
        chroma.temperature(6000),
        chroma.temperature(2000),
        chroma.temperature(20000),
    ])
    .domain([
        visualDayNightTimes.dawnNightEnd,
        visualDayNightTimes.dawnLightEnd,
        visualDayNightTimes.dayStart,
        visualDayNightTimes.lateDayStart,
        visualDayNightTimes.duskNightStart,
        visualDayNightTimes.nightStart,
    ]);
type WeatherBlendConfig = {
    transitionSeconds: number;
};

const DEFAULT_WEATHER_BLEND_CONFIG: WeatherBlendConfig = {
    transitionSeconds: 1.2,
};

const DEBUG_WEATHER_BLEND_CONFIG: WeatherBlendConfig = {
    transitionSeconds: 0.35,
};
const WEATHER_BLEND_EPSILON = 0.0005;
const BACKGROUND_COLOR_TRANSITION_SECONDS = 0.55;
const BACKGROUND_COLOR_EPSILON = 0.001;

function dampNumber(
    current: number,
    target: number,
    smoothing: number,
    delta: number,
) {
    if (!Number.isFinite(current)) return target;
    const t = 1 - Math.exp(-Math.max(0.0001, smoothing) * delta);
    return current + (target - current) * t;
}

function isWithinBlendEpsilon(
    current: number | null | undefined,
    target: number | null | undefined,
) {
    return Math.abs((current ?? 0) - (target ?? 0)) <= WEATHER_BLEND_EPSILON;
}

function isWithinColorEpsilon(current: Color, target: Color) {
    return (
        Math.abs(current.r - target.r) <= BACKGROUND_COLOR_EPSILON &&
        Math.abs(current.g - target.g) <= BACKGROUND_COLOR_EPSILON &&
        Math.abs(current.b - target.b) <= BACKGROUND_COLOR_EPSILON
    );
}

function SceneBackgroundColor({
    animate,
    color,
}: {
    animate: boolean;
    color: Color;
}) {
    const { scene } = useThree();
    const displayedColor = useRef<Color>(new Color());
    const targetColor = useRef<Color>(new Color());
    const initialized = useRef(false);
    const colorRed = color.r;
    const colorGreen = color.g;
    const colorBlue = color.b;

    useEffect(() => {
        targetColor.current.setRGB(colorRed, colorGreen, colorBlue);

        if (!animate || !initialized.current) {
            displayedColor.current.setRGB(colorRed, colorGreen, colorBlue);
            initialized.current = true;
        }

        scene.background = displayedColor.current;
    }, [animate, colorBlue, colorGreen, colorRed, scene]);

    useEffect(() => {
        scene.background = displayedColor.current;

        return () => {
            if (scene.background === displayedColor.current) {
                scene.background = null;
            }
        };
    }, [scene]);

    useFrame((_, delta) => {
        if (!animate || !initialized.current) {
            return;
        }

        if (scene.background !== displayedColor.current) {
            scene.background = displayedColor.current;
        }

        if (isWithinColorEpsilon(displayedColor.current, targetColor.current)) {
            displayedColor.current.copy(targetColor.current);
            return;
        }

        displayedColor.current.lerp(
            targetColor.current,
            1 - Math.exp(-(1 / BACKGROUND_COLOR_TRANSITION_SECONDS) * delta),
        );
    });

    return null;
}

function useBlendedWeather(
    weather: EnvironmentWeather | undefined,
    enabled: boolean,
    blendConfig: WeatherBlendConfig,
) {
    const [blendedWeather, setBlendedWeather] = useState<
        EnvironmentWeather | undefined
    >(weather);
    const targetRef = useRef<EnvironmentWeather | undefined>(weather);

    useEffect(() => {
        targetRef.current = weather;
        if (!enabled || !weather) {
            setBlendedWeather(weather);
        }
    }, [enabled, weather]);

    useFrame((_, delta) => {
        if (!enabled || !targetRef.current) {
            return;
        }

        const target = targetRef.current;
        setBlendedWeather((current) => {
            if (!current) {
                return target;
            }

            const smoothing = 1 / blendConfig.transitionSeconds;
            const next = {
                ...target,
                cloudy: dampNumber(
                    current.cloudy ?? 0,
                    target.cloudy ?? 0,
                    smoothing,
                    delta,
                ),
                foggy: dampNumber(
                    current.foggy ?? 0,
                    target.foggy ?? 0,
                    smoothing,
                    delta,
                ),
                rainy: dampNumber(
                    current.rainy ?? 0,
                    target.rainy ?? 0,
                    smoothing,
                    delta,
                ),
                snowy: dampNumber(
                    current.snowy ?? 0,
                    target.snowy ?? 0,
                    smoothing,
                    delta,
                ),
                windSpeed: dampNumber(
                    current.windSpeed ?? 0,
                    target.windSpeed ?? 0,
                    smoothing,
                    delta,
                ),
                snowAccumulation: dampNumber(
                    current.snowAccumulation ?? 0,
                    target.snowAccumulation ?? 0,
                    smoothing,
                    delta,
                ),
                // Keep direction and thunder discrete to preserve deterministic storm timing
                // and prevent jitter around cardinal boundaries.
                windDirection: target.windDirection,
                thundery: target.thundery,
            };
            const changed =
                !isWithinBlendEpsilon(current.cloudy, next.cloudy) ||
                !isWithinBlendEpsilon(current.foggy, next.foggy) ||
                !isWithinBlendEpsilon(current.rainy, next.rainy) ||
                !isWithinBlendEpsilon(current.snowy, next.snowy) ||
                !isWithinBlendEpsilon(current.windSpeed, next.windSpeed) ||
                !isWithinBlendEpsilon(
                    current.snowAccumulation,
                    next.snowAccumulation,
                ) ||
                current.windDirection !== next.windDirection ||
                current.thundery !== next.thundery;

            return changed ? next : current;
        });
    });

    return blendedWeather;
}

function getSunPosition(
    { lat, lon }: { lat: number; lon: number },
    currentTime: Date,
    timeOfDay: number,
) {
    const date = timeOfDayToDate(currentTime, timeOfDay);
    const { altitude, azimuth } = SunCalc.getPosition(date, lat, lon);
    return altAzToScenePosition(altitude, azimuth);
}

export function environmentState(
    { lat, lon }: { lat: number; lon: number },
    currentTime: Date,
    timeOfDay: number,
) {
    const sunPosition = getSunPosition({ lat, lon }, currentTime, timeOfDay);
    const skyBackgroundColors = resolveEnvironmentSkyBackgroundColors({
        backgroundPaletteIndex: defaultGameBackgroundPaletteIndex,
        timeOfDay,
    });
    const colors = {
        background: skyBackgroundColors.background,
        sunTemperature: sunTemperatureScale(timeOfDay).rgb(),
        hemisphereSkyColor: skyBackgroundColors.hemisphereSkyColor,
    };
    const intensities = {
        sun: getVisualDaylightAmount(timeOfDay),
    };
    return { timeOfDay, sunPosition, colors, intensities };
}

export type EnvironmentProps = {
    noBackground?: boolean;
    noSound?: boolean;
    noWeather?: boolean;
    quality?: GameQualityProfile;
    weather?: Partial<GameState['weather']>;
};

type EnvironmentWeather = {
    cloudy?: number;
    foggy?: number;
    rainy?: number;
    snowAccumulation?: number;
    snowy?: number;
    thundery?: number;
    windDirection?: string | null;
    windSpeed?: number;
};

const fallbackWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowAccumulation: 0,
    snowy: 0,
    thundery: 0,
    windDirection: 'N',
    windSpeed: 0,
};

function resolveWindDirection(
    windDirection:
        | NonNullable<GameState['weather']>['windDirection']
        | string
        | undefined,
    fallback: string | null | undefined,
) {
    const resolvedFallback = fallback ?? fallbackWeather.windDirection;
    if (typeof windDirection === 'number') {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return (
            directions[Math.round(windDirection / 45) % 8] ?? resolvedFallback
        );
    }

    return windDirection ?? resolvedFallback;
}

function useEnvironmentElements({
    backgroundPaletteIndex,
    location,
    currentTime,
    timeOfDay,
    weather,
}: {
    backgroundPaletteIndex: number;
    location: { lat: number; lon: number };
    currentTime: Date;
    timeOfDay: number;
    weather: EnvironmentWeather | null | undefined;
}) {
    const {
        sunPosition,
        colors: { sunTemperature },
        intensities: { sun: sunIntensity },
    } = environmentState(location, currentTime, timeOfDay);
    const sceneDate = timeOfDayToDate(currentTime, timeOfDay);
    const moonlitNightScales = getMoonlitNightScales({
        date: sceneDate,
        location,
        timeOfDay,
    });
    const themedBackground = resolveThemedSkyBackgroundColors({
        backgroundPaletteIndex,
        timeOfDay,
    });
    const skyBackgroundColors =
        themedBackground ??
        resolveEnvironmentSkyBackgroundColors({
            backgroundPaletteIndex,
            timeOfDay,
        });
    const hasThemedBackground = themedBackground !== null;

    // Directional light
    const sunTemperatureRed = sunTemperature[0] / 255;
    const sunTemperatureGreen = sunTemperature[1] / 255;
    const sunTemperatureBlue = sunTemperature[2] / 255;
    const directionalLightColor = useMemo(
        () =>
            new Color().setRGB(
                sunTemperatureRed,
                sunTemperatureGreen,
                sunTemperatureBlue,
                'srgb',
            ),
        [sunTemperatureBlue, sunTemperatureGreen, sunTemperatureRed],
    );
    const directionalLightIntensity = Math.max(
        0,
        sunIntensity * 5 -
            (weather?.cloudy ?? 0) * 4 -
            (weather?.foggy ?? 0) * 4,
    );
    const directionalLightPosition = sunPosition;

    // Ambient light
    const ambientIntensityOffset = 1;
    const ambientLightIntensity =
        (sunIntensity *
            (2 + Math.max(0, -(weather?.cloudy ?? 0) - (weather?.foggy ?? 0))) +
            ambientIntensityOffset) *
        moonlitNightScales.lightScale;

    // Background color
    const effectiveBackground = skyBackgroundColors.background;
    const backgroundRed = effectiveBackground[0];
    const backgroundGreen = effectiveBackground[1];
    const backgroundBlue = effectiveBackground[2];
    const backgroundColor = useMemo(
        () =>
            resolveSkyBackgroundColor({
                background: [backgroundRed, backgroundGreen, backgroundBlue],
                moonlitSkyScale: moonlitNightScales.skyScale,
                weather,
            }),
        [
            backgroundBlue,
            backgroundGreen,
            backgroundRed,
            moonlitNightScales.skyScale,
            weather,
        ],
    );
    const moonlight = moonlitNightScales.visibleMoonlight;
    const skyLowerColor = useMemo(
        () =>
            resolveSkyGradientColors({
                backgroundColor,
                backgroundPaletteIndex,
                moonlight,
                timeOfDay,
                weather,
            }).lower,
        [
            backgroundColor,
            backgroundPaletteIndex,
            moonlight,
            timeOfDay,
            weather,
        ],
    );

    const waterColors = resolveWaterColors({
        skyColor: backgroundColor,
        timeOfDay,
        weather: weather ?? undefined,
    });

    const effectiveHemisphereSkyColor = skyBackgroundColors.hemisphereSkyColor;
    const hemisphereSkyRed = effectiveHemisphereSkyColor[0] / 255;
    const hemisphereSkyGreen = effectiveHemisphereSkyColor[1] / 255;
    const hemisphereSkyBlue = effectiveHemisphereSkyColor[2] / 255;
    const hemisphereColor = useMemo(
        () =>
            new Color().setRGB(
                hasThemedBackground ? hemisphereSkyRed : hemisphereSkyRed * -0,
                hemisphereSkyGreen,
                hemisphereSkyBlue,
                'srgb',
            ),
        [
            hasThemedBackground,
            hemisphereSkyBlue,
            hemisphereSkyGreen,
            hemisphereSkyRed,
        ],
    );

    const hemisphereGroundColor = useMemo(() => {
        const color = new Color();
        if (hasThemedBackground) {
            color.copy(backgroundColor);
            color.multiplyScalar(0.42);
            return color;
        }

        color.setRGB(
            (backgroundColor.r / 255) * 0.5,
            (backgroundColor.g / 255) * 0.5,
            (backgroundColor.b / 255) * 0.5,
            'srgb',
        );
        return color;
    }, [backgroundColor, hasThemedBackground]);
    const hemisphereIntensity =
        (sunIntensity * 2 + 3) * moonlitNightScales.lightScale;

    return {
        background: backgroundColor,
        ambient: {
            intensity: ambientLightIntensity,
        },
        hemisphere: {
            color: hemisphereColor,
            groundColor: hemisphereGroundColor,
            intensity: hemisphereIntensity,
        },
        directionalLight: {
            color: directionalLightColor,
            position: directionalLightPosition,
            intensity: directionalLightIntensity,
        },
        sky: {
            lowerColor: skyLowerColor,
            moonlight,
        },
        waterColors,
    };
}

const baseCameraShadowSize = 20;
const cloudShadowRefreshMsByMode: Record<
    GameQualityProfile['cloudShadowMode'],
    number
> = {
    hard: 96,
    soft: 64,
};
const defaultLocation = { lat: 45.739, lon: 16.572 };

function roundShadowSignatureValue(value: number) {
    return Number.isFinite(value) ? value.toFixed(4) : '0';
}

function buildStackShadowSignature(stacks: Stack[] | undefined) {
    return (stacks ?? [])
        .map((stack) => {
            const blocks = stack.blocks
                .map(
                    (block) =>
                        `${block.id}:${block.name}:${block.rotation}:${block.variant ?? ''}`,
                )
                .join(',');

            return `${roundShadowSignatureValue(stack.position.x)},${roundShadowSignatureValue(stack.position.y)},${roundShadowSignatureValue(stack.position.z)}:${blocks}`;
        })
        .join('|');
}

function buildLightShadowSignature({
    currentTime,
    directionalLight,
    shadowCameraSize,
    shadowMapSize,
    shadowVisibility,
    shadows,
    timeOfDay,
}: {
    currentTime: Date;
    directionalLight: {
        color: Color;
        intensity: number;
        position: Vector3;
    };
    shadowCameraSize: number;
    shadowMapSize: number;
    shadowVisibility: number;
    shadows: boolean;
    timeOfDay: number;
}) {
    return [
        shadows ? 'shadows' : 'no-shadows',
        shadowMapSize,
        roundShadowSignatureValue(shadowCameraSize),
        roundShadowSignatureValue(timeOfDay),
        currentTime.toISOString(),
        roundShadowSignatureValue(shadowVisibility),
        roundShadowSignatureValue(directionalLight.intensity),
        roundShadowSignatureValue(directionalLight.position.x),
        roundShadowSignatureValue(directionalLight.position.y),
        roundShadowSignatureValue(directionalLight.position.z),
        roundShadowSignatureValue(directionalLight.color.r),
        roundShadowSignatureValue(directionalLight.color.g),
        roundShadowSignatureValue(directionalLight.color.b),
    ].join('|');
}

export function StaticEnvironment({
    noBackground,
    quality,
}: Pick<EnvironmentProps, 'noBackground' | 'quality'>) {
    const qualityProfile = quality ?? resolveGameQualityProfile();
    const currentTime = useSnapshotTime();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const backgroundPaletteIndex = useGameState(
        (state) => state.backgroundPaletteIndex,
    );
    const setWaterColors = useGameState((state) => state.setWaterColors);
    const {
        background,
        ambient,
        hemisphere,
        directionalLight,
        sky,
        waterColors,
    } = useEnvironmentElements({
        backgroundPaletteIndex,
        location: defaultLocation,
        currentTime,
        timeOfDay,
        weather: undefined,
    });
    const shadowInvalidationKey = useMemo(
        () =>
            buildLightShadowSignature({
                currentTime,
                directionalLight,
                shadowCameraSize: baseCameraShadowSize,
                shadowMapSize: qualityProfile.shadowMapSize,
                shadowVisibility: 1,
                shadows: qualityProfile.shadows,
                timeOfDay,
            }),
        [
            currentTime,
            directionalLight,
            qualityProfile.shadowMapSize,
            qualityProfile.shadows,
            timeOfDay,
        ],
    );
    const waterDeep = waterColors.deep;
    const waterFoam = waterColors.foam;
    const waterShallow = waterColors.shallow;

    useEffect(() => {
        setWaterColors({
            deep: waterDeep,
            foam: waterFoam,
            shallow: waterShallow,
        });
    }, [setWaterColors, waterDeep, waterFoam, waterShallow]);

    return (
        <>
            <ShadowMapController
                enabled={qualityProfile.shadows}
                invalidationKey={shadowInvalidationKey}
            />
            {!noBackground && (
                <>
                    <SceneBackgroundColor animate={false} color={background} />
                    <SkyGradientBackground
                        animate={false}
                        backgroundColor={background}
                        backgroundPaletteIndex={backgroundPaletteIndex}
                        currentTime={currentTime}
                        location={defaultLocation}
                        moonlight={sky.moonlight}
                        timeOfDay={timeOfDay}
                    />
                </>
            )}
            <ambientLight intensity={ambient.intensity} />
            <hemisphereLight
                position={[0, 1, 0]}
                color={hemisphere.color}
                groundColor={hemisphere.groundColor}
                intensity={hemisphere.intensity}
            />
            <directionalLight
                intensity={directionalLight.intensity}
                color={directionalLight.color}
                position={directionalLight.position}
                shadow-intensity={qualityProfile.shadows ? 1 : 0}
                shadow-mapSize={
                    qualityProfile.shadows ? qualityProfile.shadowMapSize : 1
                }
                shadow-radius={2.2}
                shadow-normalBias={0.03}
                castShadow={qualityProfile.shadows}
            >
                <orthographicCamera
                    attach="shadow-camera"
                    args={[
                        -baseCameraShadowSize,
                        baseCameraShadowSize,
                        baseCameraShadowSize,
                        -baseCameraShadowSize,
                    ]}
                />
            </directionalLight>
        </>
    );
}

export function Environment({
    noBackground,
    noSound,
    noWeather,
    quality,
    weather,
}: EnvironmentProps) {
    const qualityProfile = quality ?? resolveGameQualityProfile();

    const currentTime = useLiveTime();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const syncTimeOfDay = useGameState((state) => state.syncTimeOfDay);
    const backgroundPaletteIndex = useGameState(
        (state) => state.backgroundPaletteIndex,
    );
    const view = useGameState((state) => state.view);
    const closeupCameraActive = useGameState(
        (state) => state.closeupCameraActive,
    );
    const closeupCameraSettled = useGameState(
        (state) => state.closeupCameraSettled,
    );
    const isGroundView = view === 'closeup' || closeupCameraActive;
    const closeupBlockId = useGameState((state) => state.closeupBlock?.id);
    const pickupBlockId = useGameState((state) => state.pickupBlock?.id);
    const winterMode = useGameState((state) => state.winterMode);
    const dropAnimationSignature = useGameState((state) =>
        Object.entries(state.blockPlacementDropAnimations)
            .map(
                ([blockId, animation]) =>
                    `${blockId}:${animation.sequence}:${animation.particlesSpawned ? 'particles' : 'pending'}`,
            )
            .sort()
            .join('|'),
    );
    const ambientAudioMixer = useGameState((state) => state.audio.ambient);
    const setSnowCoverage = useGameState((state) => state.setSnowCoverage);
    const setWaterColors = useGameState((state) => state.setWaterColors);
    const weatherVisualizationDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const weatherDisabled = noWeather || weatherVisualizationDisabled;

    const { data: garden } = useCurrentGarden();
    const location = useMemo(
        () => ({
            lat: garden?.location.lat ?? defaultLocation.lat,
            lon: garden?.location.lon ?? defaultLocation.lon,
        }),
        [garden?.location.lat, garden?.location.lon],
    );
    useEffect(() => {
        syncTimeOfDay(location, currentTime);
    }, [currentTime, location, syncTimeOfDay]);
    const shadowCameraSize = useMemo(() => {
        const stacks = garden?.stacks;
        if (!stacks?.length) {
            return baseCameraShadowSize;
        }

        const xs = stacks.map((stack) => stack.position.x);
        const zs = stacks.map((stack) => stack.position.z);
        const spanX = Math.max(...xs) - Math.min(...xs);
        const spanZ = Math.max(...zs) - Math.min(...zs);
        return Math.max(
            baseCameraShadowSize,
            Math.max(spanX, spanZ) * 0.6 + 12,
        );
    }, [garden]);

    const gameWeather = useGameState((state) => state.weather);
    const hasWeatherOverride = Boolean(gameWeather ?? weather);
    const { data: weatherNow } = useWeatherNow(
        !weatherDisabled && !hasWeatherOverride && garden !== undefined,
        garden?.farmId,
    );
    const overrideWeather = weatherDisabled
        ? undefined
        : (gameWeather ?? weather);
    const actualWeather = useMemo<EnvironmentWeather | undefined>(() => {
        if (weatherDisabled) {
            return undefined;
        }

        if (!overrideWeather) {
            if (!weatherNow) {
                return undefined;
            }
            return weatherNow;
        }

        const baseWeather = weatherNow ?? fallbackWeather;

        return {
            ...baseWeather,
            rainy: overrideWeather.rainy ?? baseWeather.rainy,
            foggy: overrideWeather.foggy ?? baseWeather.foggy,
            cloudy: overrideWeather.cloudy ?? baseWeather.cloudy,
            snowy: overrideWeather.snowy ?? baseWeather.snowy,
            thundery: overrideWeather.thundery ?? baseWeather.thundery,
            windSpeed: overrideWeather.windSpeed ?? baseWeather.windSpeed,
            windDirection: resolveWindDirection(
                overrideWeather.windDirection,
                baseWeather.windDirection,
            ),
            snowAccumulation:
                overrideWeather.snowAccumulation ??
                baseWeather.snowAccumulation,
        };
    }, [overrideWeather, weatherDisabled, weatherNow]);
    const activeWeatherAnimation =
        !weatherDisabled &&
        ((actualWeather?.cloudy ?? 0) > 0.01 ||
            (actualWeather?.foggy ?? 0) > 0.01 ||
            (actualWeather?.rainy ?? 0) > 0 ||
            (actualWeather?.snowy ?? 0) > 0);
    useSceneTimeInvalidation(activeWeatherAnimation);

    // Sound management
    const morningAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Morning 01.mp3',
    );
    const dayAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Day Birds 01.mp3',
    );
    const nightAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Night 01.mp3',
    );
    const dayRainAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Day Rain 01.mp3',
    );
    const rainHeavyAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Rain Heavy 01.mp3',
    );
    const rainLightModAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Mod Rain Light 01.mp3',
    );
    const rainMediumModAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Mod Rain Medium 01.mp3',
    );
    useEffect(() => {
        if (noSound) {
            return;
        }

        if (actualWeather && (actualWeather.rainy ?? 0) > 0.9) {
            rainHeavyAmbient.play();
        } else {
            if (timeOfDay > 0.15 && timeOfDay < 0.3) {
                morningAmbient.play();
            } else if (timeOfDay > 0.3 && timeOfDay < 0.8) {
                if (actualWeather && (actualWeather.rainy ?? 0) > 0) {
                    dayRainAmbient.play();
                } else {
                    dayAmbient.play();
                }
            } else {
                nightAmbient.play();
            }

            if (actualWeather) {
                if ((actualWeather.rainy ?? 0) > 0.9) {
                    rainMediumModAmbient.play();
                } else if ((actualWeather.rainy ?? 0) > 0.4) {
                    rainLightModAmbient.play();
                }
            }
        }

        return () => {
            morningAmbient.stop();
            dayAmbient.stop();
            nightAmbient.stop();
            dayRainAmbient.stop();
            rainHeavyAmbient.stop();
            rainLightModAmbient.stop();
            rainMediumModAmbient.stop();
        };
    }, [
        timeOfDay,
        actualWeather,
        noSound,
        dayAmbient.play,
        dayAmbient.stop,
        dayRainAmbient.play,
        dayRainAmbient.stop,
        morningAmbient.play,
        morningAmbient.stop,
        nightAmbient.play,
        nightAmbient.stop,
        rainHeavyAmbient.play,
        rainHeavyAmbient.stop,
        rainLightModAmbient.play,
        rainLightModAmbient.stop,
        rainMediumModAmbient.play,
        rainMediumModAmbient.stop,
    ]);

    const blendConfig = hasWeatherOverride
        ? DEBUG_WEATHER_BLEND_CONFIG
        : DEFAULT_WEATHER_BLEND_CONFIG;
    const blendedWeather = useBlendedWeather(
        actualWeather,
        !weatherDisabled,
        blendConfig,
    );

    const {
        background,
        ambient,
        hemisphere,
        directionalLight,
        sky,
        waterColors,
    } = useEnvironmentElements({
        backgroundPaletteIndex,
        location,
        currentTime,
        timeOfDay,
        weather: blendedWeather,
    });
    const waterDeep = waterColors.deep;
    const waterFoam = waterColors.foam;
    const waterShallow = waterColors.shallow;

    useEffect(() => {
        setWaterColors({
            deep: waterDeep,
            foam: waterFoam,
            shallow: waterShallow,
        });
    }, [setWaterColors, waterDeep, waterFoam, waterShallow]);

    // Handle fog
    const fog = blendedWeather?.foggy ?? 0;
    const fogNear = 170 - fog * 30;
    const nightVisibility = getVisualNightAmount(timeOfDay);
    const fogColor =
        nightVisibility < 0.5 ? new Color(0xaaaaaa) : new Color(0x55556a);

    // Handle rain
    const rain = blendedWeather?.rainy ?? 0;
    const baseRainParticleCount = rain < 0.4 ? 200 : rain > 0.9 ? 2000 : 600;
    const rainParticleCount = Math.round(
        baseRainParticleCount * qualityProfile.rainParticleMultiplier,
    );

    // Handle snow particles - based on current weather (snowy intensity 0-1)
    const snowParticles = blendedWeather?.snowy ?? 0;
    const snowParticleCount = Math.round(
        snowParticles * 5000 * qualityProfile.snowParticleMultiplier,
    );

    useEffect(() => {
        updateGameProfileMetadata({
            rainParticleCount:
                !weatherDisabled && rain > 0 ? rainParticleCount : 0,
            shadowMapSize: qualityProfile.shadowMapSize,
            shadowsEnabled: qualityProfile.shadows,
            snowParticleCount:
                !weatherDisabled && snowParticles > 0 ? snowParticleCount : 0,
            weatherDisabled,
        });
    }, [
        qualityProfile.shadowMapSize,
        qualityProfile.shadows,
        rain,
        rainParticleCount,
        snowParticleCount,
        snowParticles,
        weatherDisabled,
    ]);

    // Light clouds keep only a few faint bright stars visible, but only at
    // night or during twilight transitions.
    const cloudCover = blendedWeather?.cloudy ?? 1;
    const fogCover = blendedWeather?.foggy ?? 0;
    const effectiveCloudCover = Math.min(1, cloudCover + fogCover * 0.35);
    const starVisibility = weatherDisabled
        ? 0
        : Math.max(0, 1 - cloudCover / 0.6) ** 1.5 * nightVisibility;
    const showStars = starVisibility > 0;
    // Dense clouds or fog dim the sun/moon discs toward a small residual
    // glow. The curve drops fast so 70%+ overcast reads as "no sun" rather
    // than a dimmer but still-solid disc, but never fully hits zero — matching
    // the directional light which still casts minimal shadows at full cover.
    const obstruction = Math.min(1, Math.max(cloudCover, fogCover));
    const bodyVisibility = weatherDisabled
        ? 1
        : Math.max(0.05, (1 - obstruction) ** 2);
    const daylightVisibility = getVisualDaylightAmount(timeOfDay);
    const shadowVisibility = weatherDisabled
        ? 1
        : Math.max(
              0,
              daylightVisibility *
                  (1 - smoothstep(0.42, 0.95, effectiveCloudCover)),
          );
    const cloudShadowStrength = weatherDisabled
        ? 0
        : daylightVisibility *
          smoothstep(0.08, 0.22, cloudCover) *
          (1 - smoothstep(0.5, 0.9, effectiveCloudCover));
    const cloudShadowDynamicRefreshMs =
        qualityProfile.shadows && cloudShadowStrength > 0
            ? cloudShadowRefreshMsByMode[qualityProfile.cloudShadowMode]
            : undefined;
    const gardenShadowSignature = useMemo(
        () => buildStackShadowSignature(garden?.stacks),
        [garden?.stacks],
    );
    const shadowInvalidationKey = useMemo(
        () =>
            [
                buildLightShadowSignature({
                    currentTime,
                    directionalLight,
                    shadowCameraSize,
                    shadowMapSize: qualityProfile.shadowMapSize,
                    shadowVisibility,
                    shadows: qualityProfile.shadows,
                    timeOfDay,
                }),
                `cloud:${roundShadowSignatureValue(cloudShadowStrength)}:${cloudShadowDynamicRefreshMs ?? 0}`,
                `garden:${gardenShadowSignature}`,
                `view:${view}:${closeupBlockId ?? ''}`,
                `pickup:${pickupBlockId ?? ''}`,
                `drop:${dropAnimationSignature}`,
                `winter:${winterMode}`,
            ].join('||'),
        [
            closeupBlockId,
            cloudShadowDynamicRefreshMs,
            cloudShadowStrength,
            currentTime,
            directionalLight,
            dropAnimationSignature,
            gardenShadowSignature,
            pickupBlockId,
            qualityProfile.shadowMapSize,
            qualityProfile.shadows,
            shadowCameraSize,
            shadowVisibility,
            timeOfDay,
            view,
            winterMode,
        ],
    );
    const shadowMapSize = qualityProfile.shadows
        ? qualityProfile.shadowMapSize
        : 1;
    const directionalLightKey = `directional-shadow:${qualityProfile.shadows ? qualityProfile.shadowMapSize : 0}:${qualityProfile.cloudShadowMode}`;

    // Handle ground snow coverage - based on accumulated snow in cm
    const snowAccumulationCm = blendedWeather?.snowAccumulation ?? 0;
    const snowCoverage = Math.min(1, snowAccumulationCm / 30); // Scale: 0cm=0, 30cm=1

    useEffect(() => {
        setSnowCoverage(snowCoverage);
    }, [setSnowCoverage, snowCoverage]);

    // Handle wind
    const windSpeed = blendedWeather?.windSpeed ?? 0;
    // Convert compass direction string to degrees
    const compassToDirection: Record<string, number> = {
        N: 0,
        NE: 45,
        E: 90,
        SE: 135,
        S: 180,
        SW: 225,
        W: 270,
        NW: 315,
    };
    const windDirection =
        typeof blendedWeather?.windDirection === 'string'
            ? (compassToDirection[blendedWeather.windDirection] ?? 0)
            : 0;

    const [lightningFlash, setLightningFlash] = useState(0);
    const lightningScheduleTimeout = useRef<number | null>(null);
    const lightningClearTimeout = useRef<number | null>(null);

    useEffect(() => {
        const thunderLevel = actualWeather?.thundery ?? 0;
        if (weatherDisabled || thunderLevel <= 0) {
            setLightningFlash(0);
            if (lightningScheduleTimeout.current !== null) {
                window.clearTimeout(lightningScheduleTimeout.current);
                lightningScheduleTimeout.current = null;
            }
            if (lightningClearTimeout.current !== null) {
                window.clearTimeout(lightningClearTimeout.current);
                lightningClearTimeout.current = null;
            }
            return;
        }

        const stormStrength = Math.min(
            1,
            thunderLevel * 0.6 +
                (blendedWeather?.rainy ?? 0) * 0.3 +
                (blendedWeather?.cloudy ?? 0) * 0.2,
        );
        const nightFactor = 0.2 + nightVisibility * 0.6;
        const flashStrength = Math.min(
            1,
            0.35 + stormStrength * 0.45 + nightFactor,
        );

        const scheduleNextFlash = () => {
            const minimumDelayMs = 8000;
            const maximumDelayMs = 22000;
            const chanceWindowMs =
                maximumDelayMs -
                (maximumDelayMs - minimumDelayMs) * Math.min(1, stormStrength);
            const delayMs =
                minimumDelayMs + Math.random() * Math.max(2000, chanceWindowMs);

            lightningScheduleTimeout.current = window.setTimeout(() => {
                setLightningFlash(flashStrength);
                lightningClearTimeout.current = window.setTimeout(() => {
                    setLightningFlash(0);
                    lightningClearTimeout.current = null;
                }, 120);
                scheduleNextFlash();
            }, delayMs);
        };

        scheduleNextFlash();

        return () => {
            if (lightningScheduleTimeout.current !== null) {
                window.clearTimeout(lightningScheduleTimeout.current);
                lightningScheduleTimeout.current = null;
            }
            if (lightningClearTimeout.current !== null) {
                window.clearTimeout(lightningClearTimeout.current);
                lightningClearTimeout.current = null;
                setLightningFlash(0);
            }
        };
    }, [
        blendedWeather?.cloudy,
        blendedWeather?.rainy,
        actualWeather?.thundery,
        nightVisibility,
        weatherDisabled,
    ]);

    return (
        <>
            <ShadowMapController
                dynamicRefreshMs={cloudShadowDynamicRefreshMs}
                enabled={qualityProfile.shadows}
                invalidationKey={shadowInvalidationKey}
            />
            {!noBackground && (
                <>
                    <SceneBackgroundColor
                        animate
                        color={isGroundView ? sky.lowerColor : background}
                    />
                    <SkyGradientBackground
                        animate
                        backgroundColor={background}
                        backgroundPaletteIndex={backgroundPaletteIndex}
                        currentTime={currentTime}
                        groundView={isGroundView}
                        hideCelestialGlow={closeupCameraSettled}
                        location={location}
                        moonlight={sky.moonlight}
                        timeOfDay={timeOfDay}
                        weather={blendedWeather}
                    />
                </>
            )}
            <ambientLight
                name="Environment:AmbientLight"
                intensity={ambient.intensity}
            />
            {lightningFlash > 0 && (
                <ambientLight
                    name="Environment:LightningAmbientLight"
                    color={0xf8fbff}
                    intensity={lightningFlash * 1.2}
                />
            )}
            <hemisphereLight
                name="Environment:HemisphereLight"
                position={[0, 1, 0]}
                color={hemisphere.color}
                groundColor={hemisphere.groundColor}
                intensity={hemisphere.intensity}
            />
            {/* TODO: Update shadow camera position based on camera position */}
            <directionalLight
                key={directionalLightKey}
                name="Environment:SunDirectionalLight"
                intensity={directionalLight.intensity}
                color={directionalLight.color}
                position={directionalLight.position}
                shadow-intensity={qualityProfile.shadows ? shadowVisibility : 0}
                shadow-mapSize-height={shadowMapSize}
                shadow-mapSize-width={shadowMapSize}
                shadow-radius={2.2}
                // shadow-near={0.01}
                // shadow-far={1000}
                shadow-normalBias={0.03}
                castShadow={qualityProfile.shadows}
            >
                <orthographicCamera
                    name="Environment:SunShadowCamera"
                    attach="shadow-camera"
                    args={[
                        -shadowCameraSize,
                        shadowCameraSize,
                        shadowCameraSize,
                        -shadowCameraSize,
                    ]}
                />
            </directionalLight>
            {!weatherDisabled && blendedWeather && (
                <CloudLayer
                    cloudy={blendedWeather.cloudy ?? 0}
                    foggy={blendedWeather.foggy ?? 0}
                    shadowMode={qualityProfile.cloudShadowMode}
                    shadowStrength={
                        qualityProfile.shadows ? cloudShadowStrength : 0
                    }
                    stacks={garden?.stacks}
                    timeOfDay={timeOfDay}
                    windDirection={windDirection}
                    windSpeed={windSpeed}
                />
            )}
            {showStars && (
                <Stars visibility={closeupCameraSettled ? 0 : starVisibility} />
            )}
            {!noBackground && (
                <SunMoon
                    visibility={closeupCameraSettled ? 0 : bodyVisibility}
                />
            )}
            {!weatherDisabled && fog > 0 && (
                <fog attach="fog" args={[fogColor, fogNear, 190]} />
            )}
            {!weatherDisabled && rain > 0 && (
                <Drops count={rainParticleCount} />
            )}
            {!weatherDisabled && snowParticles > 0 && (
                <Snow
                    count={snowParticleCount}
                    windSpeed={windSpeed}
                    windDirection={windDirection}
                />
            )}
            {lightningFlash > 0 && (
                <fog
                    attach="fog"
                    args={[
                        new Color(0xdde9ff),
                        Math.max(80, fogNear - 20),
                        220,
                    ]}
                />
            )}
        </>
    );
}
