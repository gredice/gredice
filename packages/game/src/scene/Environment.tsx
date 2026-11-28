'use client';

import { useFrame, useThree } from '@react-three/fiber';
import {
    type RefObject,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import * as SunCalc from 'suncalc';
import { Color, type DirectionalLight, Vector3 } from 'three';
import { AutumnRustle } from '../audio/AutumnRustle';
import { WeatherAmbience } from '../audio/WeatherAmbience';
import { WindAmbience } from '../audio/WindAmbience';
import { PlantShaderPrewarm } from '../generators/plant/PlantShaderPrewarm';
import { useAutumnState } from '../hooks/useAutumnState';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useSceneCurrentGarden } from '../hooks/useSceneCurrentGarden';
import { useSnapshotTime } from '../hooks/useSnapshotTime';
import { useSyncGameTime } from '../hooks/useSyncGameTime';
import { useWeatherNow } from '../hooks/useWeatherNow';
import { lyingSnowFullCoverageCm } from '../snow/snowShader';
import { type GameState, useGameState } from '../useGameState';
import { WarmProps } from '../warmProps/WarmProps';
import { AutumnLeaves } from './AutumnLeaves';
import { AutumnPropWindEnvironment } from './AutumnPropWindEnvironment';
import {
    getCameraQuarterTurns,
    getMoonKeyAmount,
    resolveAtmosphereFog,
    resolveAtmosphereLighting,
    resolveSunColorRgb,
    resolveWeatherCoverDimming,
} from './atmosphereLighting';
import { getAutumnCanopyShadowKey } from './autumnCanopy';
import { defaultGameBackgroundPaletteIndex } from './backgroundPalettes';
import { ColdWeatherEffects } from './cold/ColdWeatherEffects';
import { DistantBirdFlocks } from './DistantBirdFlocks';
import { gameLightRig } from './gameArtStyle';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import {
    type GameQualityProfile,
    resolveGameQualityProfile,
} from './gameQuality';
import { enableGeneratedPlantShadowLayer } from './generatedPlantShadowLayer';
import { LocalizedSteam } from './LocalizedSteam';
import { getMoonlitNightScales } from './moonlight';
import { Perseids } from './PerseidMeteorShower';
import { getPerseidsMeteorRatePerHour, shouldRenderPerseids } from './perseids';
import { SceneBlockDataBoundary } from './SceneBlockDataBoundary';
import {
    useSceneRenderRequest,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
} from './SceneTime';
import { ShadowMapController } from './ShadowMapController';
import { SkyGradientBackground } from './SkyGradientBackground';
import { SolarEclipseSceneOverlay } from './SolarEclipseSceneOverlay';
import { Stars } from './Stars';
import { SunMoon } from './SunMoon';
import {
    buildDirectionalShadowDepthSignature,
    buildGardenShadowGeometrySignature,
} from './shadowMapScheduling';
import {
    resolveEnvironmentSkyBackgroundColors,
    resolveSkyBackgroundColor,
    resolveSkyGradientColors,
    resolveThemedSkyBackgroundColors,
} from './skyGradient';
import {
    getSolarEclipseState,
    getSolarEclipseVisualScales,
    type SolarEclipseState,
} from './solarEclipse';
import { altAzToScenePosition, timeOfDayToDate } from './sunPosition';
import { installSurfaceGradientShaderChunk } from './surfaceGradientShaderChunk';
import { useSceneAfterFrame } from './useSceneAfterFrame';
import {
    getVisualDaylightAmount,
    getVisualNightAmount,
    smoothstep,
} from './visualDayNight';
import { resolveBandCover } from './weather/sky/cloudBand';
import { resolveSkyBodyWeatherVisibility } from './weather/sky/skyBodyVisibility';
import { WeatherFrameProvider } from './weather/WeatherFrameContext';
import { WeatherLayers } from './weather/WeatherLayers';
import type { WeatherDebugOptions } from './weather/weatherDebug';
import {
    advanceWeatherBlend,
    type EnvironmentWeather,
    resolveWeatherBlendTarget,
    type WeatherBlendState,
} from './weatherBlend';

// The toy surface height gradient edits a shared shader chunk, so it must be
// installed before any garden material compiles.
installSurfaceGradientShaderChunk();

type WeatherBlendConfig = {
    transitionSeconds: number;
};

const DEFAULT_WEATHER_BLEND_CONFIG: WeatherBlendConfig = {
    transitionSeconds: 1.2,
};

const DEBUG_WEATHER_BLEND_CONFIG: WeatherBlendConfig = {
    transitionSeconds: 0.35,
};
const BACKGROUND_COLOR_TRANSITION_SECONDS = 0.55;
const BACKGROUND_COLOR_EPSILON = 0.001;

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
    const [transitionActive, setTransitionActive] = useState(false);
    const requestRender = useSceneRenderRequest();
    const colorRed = color.r;
    const colorGreen = color.g;
    const colorBlue = color.b;

    useSceneTimeInvalidation(
        'scene-background-color-transition',
        transitionActive,
    );

    useEffect(() => {
        targetColor.current.setRGB(colorRed, colorGreen, colorBlue);

        if (!animate || !initialized.current) {
            displayedColor.current.setRGB(colorRed, colorGreen, colorBlue);
            initialized.current = true;
            setTransitionActive(false);
        } else {
            setTransitionActive(
                !isWithinColorEpsilon(
                    displayedColor.current,
                    targetColor.current,
                ),
            );
        }

        scene.background = displayedColor.current;
        requestRender('scene-background-color-change');
    }, [animate, colorBlue, colorGreen, colorRed, requestRender, scene]);

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
            if (transitionActive) {
                setTransitionActive(false);
            }
            return;
        }

        displayedColor.current.lerp(
            targetColor.current,
            1 - Math.exp(-(1 / BACKGROUND_COLOR_TRANSITION_SECONDS) * delta),
        );
    });

    return null;
}

function GeneratedPlantShadowLayerBridge({
    directionalLightRef,
    enabled,
}: {
    directionalLightRef: RefObject<DirectionalLight | null>;
    enabled: boolean;
}) {
    const camera = useThree((state) => state.camera);

    useLayoutEffect(() => {
        const directionalLight = directionalLightRef.current;
        if (!enabled || !directionalLight) {
            return;
        }

        return enableGeneratedPlantShadowLayer({
            camera,
            directionalLight,
        });
    }, [camera, directionalLightRef, enabled]);

    return null;
}

function useBlendedWeather(
    weather: EnvironmentWeather | undefined,
    enabled: boolean,
    blendConfig: WeatherBlendConfig,
) {
    const [blendState, setBlendState] = useState<WeatherBlendState>(() => ({
        isBlending: false,
        weather,
    }));
    const targetRef = useRef<EnvironmentWeather | undefined>(weather);

    useEffect(() => {
        targetRef.current = weather;
        setBlendState((state) =>
            resolveWeatherBlendTarget(state, weather, enabled),
        );
    }, [enabled, weather]);

    useSceneTimeInvalidation('weather-blend', blendState.isBlending);

    useFrame((_, delta) => {
        if (!blendState.isBlending) {
            return;
        }

        setBlendState((state) =>
            advanceWeatherBlend(
                state,
                targetRef.current,
                blendConfig.transitionSeconds,
                delta,
            ),
        );
    });

    return blendState.weather;
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
        sunTemperature: resolveSunColorRgb(timeOfDay),
        hemisphereSkyColor: skyBackgroundColors.hemisphereSkyColor,
    };
    const intensities = {
        sun: getVisualDaylightAmount(timeOfDay),
    };
    return { timeOfDay, sunPosition, colors, intensities };
}

export type EnvironmentProps = {
    celestialOffsetMultiplier?: number;
    noBackground?: boolean;
    noSound?: boolean;
    noWeather?: boolean;
    /** Static catalogue/review captures can preserve the dormant asset appearance. */
    noWarmProps?: boolean;
    /** Preserve static captures without distant wildlife crossings. */
    noDistantBirdFlocks?: boolean;
    quality?: GameQualityProfile;
    weather?: Partial<GameState['weather']>;
    /** Debug switches: hidden layers, reduced motion, lightning, inspect. */
    weatherDebug?: WeatherDebugOptions;
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

const cameraViewDirection = new Vector3();

/**
 * Quarter turns of the rendered camera around the garden. The key light is
 * folded to the camera's side, so it follows the camera itself: a reset to
 * a saved view does not always update `worldRotation`. Checked after each
 * rendered frame, once the camera rig has moved the camera; a turn
 * re-renders once.
 */
function useCameraQuarterTurns() {
    const camera = useThree((state) => state.camera);
    const worldRotation = useGameState((state) => state.worldRotation);
    const [turns, setTurns] = useState(
        () =>
            getCameraQuarterTurns(
                camera.getWorldDirection(cameraViewDirection),
            ) ?? worldRotation,
    );
    const turnsRef = useRef(turns);
    turnsRef.current = turns;

    const checkCamera = useCallback(() => {
        const next = getCameraQuarterTurns(
            camera.getWorldDirection(cameraViewDirection),
        );
        if (next !== null && next !== turnsRef.current) {
            turnsRef.current = next;
            setTurns(next);
        }
    }, [camera]);
    useSceneAfterFrame(checkCamera);

    return turns;
}

function useEnvironmentElements({
    backgroundPaletteIndex,
    location,
    currentTime,
    solarEclipse,
    timeOfDay,
    weather,
}: {
    backgroundPaletteIndex: number;
    location: { lat: number; lon: number };
    currentTime: Date;
    solarEclipse: SolarEclipseState | null;
    timeOfDay: number;
    weather: EnvironmentWeather | null | undefined;
}) {
    const sunPosition = useMemo(
        () =>
            getSunPosition(
                { lat: location.lat, lon: location.lon },
                currentTime,
                timeOfDay,
            ),
        [currentTime, location.lat, location.lon, timeOfDay],
    );
    const solarEclipseObscuration = solarEclipse?.obscuration ?? 0;
    const solarEclipseScales = useMemo(
        () => getSolarEclipseVisualScales(solarEclipseObscuration),
        [solarEclipseObscuration],
    );
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

    // Background color
    const effectiveBackground = skyBackgroundColors.background;
    const backgroundRed = effectiveBackground[0];
    const backgroundGreen = effectiveBackground[1];
    const backgroundBlue = effectiveBackground[2];
    const backgroundColor = useMemo(() => {
        const color = resolveSkyBackgroundColor({
            background: [backgroundRed, backgroundGreen, backgroundBlue],
            moonlitSkyScale: moonlitNightScales.skyScale,
            weather,
        });
        return color.multiplyScalar(solarEclipseScales.sky);
    }, [
        backgroundBlue,
        backgroundGreen,
        backgroundRed,
        moonlitNightScales.skyScale,
        solarEclipseScales.sky,
        weather,
    ]);
    const moonlight = moonlitNightScales.visibleMoonlight;
    const skyLowerColor = useMemo(
        () =>
            resolveSkyGradientColors({
                backgroundColor,
                backgroundPaletteIndex,
                moonlight,
                solarEclipseObscuration: solarEclipse?.obscuration,
                timeOfDay,
                weather,
            }).lower,
        [
            backgroundColor,
            backgroundPaletteIndex,
            moonlight,
            solarEclipse?.obscuration,
            timeOfDay,
            weather,
        ],
    );

    // At night the key light turns into the moon, so it needs the moon's
    // place in the sky. Only resolved while it can contribute.
    const moonPositionNeeded = moonlight > 0 && getMoonKeyAmount(timeOfDay) > 0;
    const moonPositionKey = moonPositionNeeded ? sceneDate.getTime() : null;
    const moonPosition = useMemo(() => {
        if (moonPositionKey === null) {
            return null;
        }
        const moon = SunCalc.getMoonPosition(
            new Date(moonPositionKey),
            location.lat,
            location.lon,
        );
        return altAzToScenePosition(moon.altitude, moon.azimuth);
    }, [location.lat, location.lon, moonPositionKey]);

    const worldRotation = useCameraQuarterTurns();
    const hemisphereSkyRed = skyBackgroundColors.hemisphereSkyColor[0];
    const hemisphereSkyGreen = skyBackgroundColors.hemisphereSkyColor[1];
    const hemisphereSkyBlue = skyBackgroundColors.hemisphereSkyColor[2];
    const lighting = useMemo(
        () =>
            resolveAtmosphereLighting({
                backgroundColor,
                hemisphereSkyColor: new Color().setRGB(
                    hemisphereSkyRed / 255,
                    hemisphereSkyGreen / 255,
                    hemisphereSkyBlue / 255,
                    'srgb',
                ),
                moonlight,
                moonPosition,
                solarEclipseScales,
                sunPosition,
                timeOfDay,
                weather,
                worldRotation,
            }),
        [
            backgroundColor,
            hemisphereSkyBlue,
            hemisphereSkyGreen,
            hemisphereSkyRed,
            moonPosition,
            moonlight,
            solarEclipseScales,
            sunPosition,
            timeOfDay,
            weather,
            worldRotation,
        ],
    );

    return {
        background: backgroundColor,
        ambient: lighting.ambient,
        hemisphere: lighting.hemisphere,
        directionalLight: {
            color: lighting.key.color,
            position: lighting.key.position,
            intensity: lighting.key.intensity,
            shadowVisibility: lighting.key.shadowVisibility,
        },
        sky: {
            lowerColor: skyLowerColor,
            moonlight,
        },
    };
}

const baseCameraShadowSize = 20;
const defaultLocation = { lat: 45.739, lon: 16.572 };

export function StaticEnvironment({
    noBackground,
    quality,
}: Pick<EnvironmentProps, 'noBackground' | 'quality'>) {
    const qualityProfile = quality ?? resolveGameQualityProfile();
    const directionalLightRef = useRef<DirectionalLight | null>(null);
    const currentTime = useSnapshotTime();
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const backgroundPaletteIndex = useGameState(
        (state) => state.backgroundPaletteIndex,
    );
    const { background, ambient, hemisphere, directionalLight, sky } =
        useEnvironmentElements({
            backgroundPaletteIndex,
            location: defaultLocation,
            currentTime,
            solarEclipse: null,
            timeOfDay,
            weather: undefined,
        });
    const shadowInvalidationKey = buildDirectionalShadowDepthSignature({
        lightPosition: directionalLight.position,
        shadowCameraSize: baseCameraShadowSize,
        shadowMapSize: qualityProfile.shadowMapSize,
        shadows: qualityProfile.shadows,
    });

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
            <ambientLight color={ambient.color} intensity={ambient.intensity} />
            <hemisphereLight
                position={[0, 1, 0]}
                color={hemisphere.color}
                groundColor={hemisphere.groundColor}
                intensity={hemisphere.intensity}
            />
            <directionalLight
                ref={directionalLightRef}
                intensity={directionalLight.intensity}
                color={directionalLight.color}
                position={directionalLight.position}
                shadow-intensity={
                    qualityProfile.shadows
                        ? directionalLight.shadowVisibility *
                          gameLightRig.shadowIntensity
                        : 0
                }
                shadow-mapSize={
                    qualityProfile.shadows ? qualityProfile.shadowMapSize : 1
                }
                shadow-radius={gameLightRig.shadowRadius}
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
                <GeneratedPlantShadowLayerBridge
                    directionalLightRef={directionalLightRef}
                    enabled={qualityProfile.shadows}
                />
            </directionalLight>
        </>
    );
}

/**
 * Clear air keeps a fog attached that never reaches the garden (it starts
 * far behind the camera), so the FOG shader variant of every lit program
 * never toggles when fog comes and goes. A toggle recompiled every program
 * the first time a weather change crossed it, a long frame mid-blend.
 * Constant, so clear weather never changes the static cache's light rig.
 */
const inertAtmosphereFog = {
    color: new Color('#ffffff'),
    near: 1e6,
    far: 1e6 + 1,
} as const;

export function Environment({
    celestialOffsetMultiplier,
    noBackground,
    noSound,
    noWeather,
    noWarmProps,
    noDistantBirdFlocks,
    quality,
    weather,
    weatherDebug,
}: EnvironmentProps) {
    const qualityProfile = quality ?? resolveGameQualityProfile();
    const directionalLightRef = useRef<DirectionalLight | null>(null);
    const sceneRuntimeVisible = useSceneRuntimeVisible();

    const timeOfDay = useGameState((state) => state.timeOfDay);
    const dayNightCycleDisabled = useGameState(
        (state) => state.dayNightCycleDisabled,
    );
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
    const activePlacementCount = useGameState(
        (state) => Object.keys(state.blockPlacementDropAnimations).length,
    );
    const setRainSurfaceIntensity = useGameState(
        (state) => state.setRainSurfaceIntensity,
    );
    const setSnowCoverage = useGameState((state) => state.setSnowCoverage);
    const weatherVisualizationDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const weatherDisabled = noWeather || weatherVisualizationDisabled;
    const autumn = useAutumnState();

    const { data: garden } = useCurrentGarden();
    const sceneGarden = useSceneCurrentGarden(garden);
    const location = useMemo(
        () => ({
            lat: garden?.location.lat ?? defaultLocation.lat,
            lon: garden?.location.lon ?? defaultLocation.lon,
        }),
        [garden?.location.lat, garden?.location.lon],
    );
    const currentTime = useSyncGameTime(location);
    const solarEclipse = useMemo(
        () =>
            dayNightCycleDisabled
                ? null
                : getSolarEclipseState(currentTime, location),
        [currentTime, dayNightCycleDisabled, location],
    );
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
            // Overrides must explicitly provide temperature; never inherit a
            // cached live temperature into a frozen/debug weather fixture.
            temperature: overrideWeather.temperature ?? null,
            isStale: false,
            source: undefined,
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
    // No environment-wide render lease for weather: every weather layer
    // (`WeatherLayers.tsx`) holds its own lease only while it moves, so
    // still, clear weather renders nothing per frame.

    const blendConfig = hasWeatherOverride
        ? DEBUG_WEATHER_BLEND_CONFIG
        : DEFAULT_WEATHER_BLEND_CONFIG;
    const blendedWeather = useBlendedWeather(
        actualWeather,
        !weatherDisabled,
        blendConfig,
    );

    const { background, ambient, hemisphere, directionalLight, sky } =
        useEnvironmentElements({
            backgroundPaletteIndex,
            location,
            currentTime,
            solarEclipse,
            timeOfDay,
            weather: blendedWeather,
        });

    // Handle fog: it takes the sky colour at the horizon and thickens gently
    // toward the back of the garden instead of hiding it.
    const fog = blendedWeather?.foggy ?? 0;
    // Lower cloud cover keeps more of the clear-day light on the island,
    // including the fog a storm or a shower brings (GAME_ART.md "Weather >
    // Clouds and overcast"); exactly today's from cover 0.75 up.
    const coverShare = useMemo(
        () => resolveWeatherCoverDimming(blendedWeather),
        [blendedWeather],
    );
    const nightVisibility = getVisualNightAmount(timeOfDay);
    const atmosphereFog = useMemo(
        () =>
            resolveAtmosphereFog({
                foggy: fog * coverShare,
                horizonColor: sky.lowerColor,
            }) ?? inertAtmosphereFog,
        [coverShare, fog, sky.lowerColor],
    );

    // Rain wets the garden surfaces; the drops, splashes and puddles are the
    // rain layer's (`weather/rain/RainLayer.tsx`).
    const rain = blendedWeather?.rainy ?? 0;

    useEffect(() => {
        setRainSurfaceIntensity(weatherDisabled ? 0 : rain);
    }, [rain, setRainSurfaceIntensity, weatherDisabled]);

    const snowParticles = blendedWeather?.snowy ?? 0;

    // Particle, cloud and other weather counts come from the weather layers.
    useEffect(() => {
        updateGameProfileMetadata({
            shadowMapSize: qualityProfile.shadowMapSize,
            shadowsEnabled: qualityProfile.shadows,
            weatherDisabled,
        });
    }, [qualityProfile.shadowMapSize, qualityProfile.shadows, weatherDisabled]);

    // The sky's cover: thunder always brings the overcast deck
    // (GAME_ART.md "Weather > Clouds and overcast").
    const thunder = (blendedWeather?.thundery ?? 0) > 0 ? 1 : 0;
    const cloudCover = resolveBandCover(blendedWeather?.cloudy ?? 1, thunder);
    const fogCover = blendedWeather?.foggy ?? 0;
    const effectiveCloudCover = Math.min(1, cloudCover + fogCover * 0.35);
    // Stars hide as cloud grows (GAME_ART.md "Weather > Clear").
    const starVisibility = weatherDisabled
        ? 0
        : Math.max(0, 1 - cloudCover / 0.6) ** 1.5 * nightVisibility;
    const showStars = starVisibility > 0;
    const perseidsVisibility = closeupCameraSettled ? 0 : starVisibility;
    const perseidsMeteorRate = getPerseidsMeteorRatePerHour(currentTime);
    const showPerseids = shouldRenderPerseids({
        date: currentTime,
        skyVisibility: perseidsVisibility,
    });
    // The sun or moon hides behind the deck (gone at 0.85), in fog and in
    // falling snow, with no residual ghost disc.
    const bodyVisibility = weatherDisabled
        ? 1
        : resolveSkyBodyWeatherVisibility({
              cloudy: resolveBandCover(blendedWeather?.cloudy ?? 0, thunder),
              foggy: fogCover,
              snowy: snowParticles,
          });
    // The key light casts shadows by day and, more softly, under the moon.
    // Cover fades them, by the island's cover share (1 while the weather
    // loads, as the cover then counts as full).
    const shadowCoverShare = blendedWeather ? coverShare : 1;
    const shadowVisibility = weatherDisabled
        ? directionalLight.shadowVisibility
        : Math.max(
              0,
              directionalLight.shadowVisibility *
                  (1 -
                      smoothstep(0.42, 0.95, effectiveCloudCover) *
                          shadowCoverShare),
          );
    const gardenShadowSignature = useMemo(
        () => buildGardenShadowGeometrySignature(garden?.stacks),
        [garden?.stacks],
    );
    const shadowInvalidationKey = buildDirectionalShadowDepthSignature({
        lightPosition: directionalLight.position,
        shadowCameraSize,
        shadowMapSize: qualityProfile.shadowMapSize,
        shadows: qualityProfile.shadows,
    });
    const shadowGeometryKey = [
        `garden:${gardenShadowSignature}`,
        `view:${view}:${closeupBlockId ?? ''}`,
        `pickup:${pickupBlockId ?? ''}`,
        `winter:${winterMode}`,
        `canopy:${getAutumnCanopyShadowKey(garden?.stacks, weatherDisabled ? 1 : autumn.leafRetention)}`,
    ].join('||');
    const shadowMapSize = qualityProfile.shadows
        ? qualityProfile.shadowMapSize
        : 1;
    const directionalLightKey = `directional-shadow:${qualityProfile.shadows ? qualityProfile.shadowMapSize : 0}`;

    // Handle ground snow coverage - based on accumulated snow in cm
    const snowAccumulationCm = blendedWeather?.snowAccumulation ?? 0;
    // Scale: 0 cm = 0, 30 cm = 1, the scale the snow overlays' settle ranges
    // (`grassSettleCm`) are written in.
    const snowCoverage = Math.min(
        1,
        snowAccumulationCm / lyingSnowFullCoverageCm,
    );

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

    return (
        <>
            <PlantShaderPrewarm
                enabled={isGroundView}
                variantKey={
                    qualityProfile.shadows ? 'shadows' : 'without-shadows'
                }
            />
            <ShadowMapController
                activePlacementCount={activePlacementCount}
                enabled={qualityProfile.shadows}
                geometryKey={shadowGeometryKey}
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
                        screenOffsetMultiplier={celestialOffsetMultiplier}
                        solarEclipseObscuration={solarEclipse?.obscuration}
                        timeOfDay={timeOfDay}
                        weather={blendedWeather}
                    />
                </>
            )}
            <ambientLight
                name="Environment:AmbientLight"
                color={ambient.color}
                intensity={ambient.intensity}
            />
            <hemisphereLight
                name="Environment:HemisphereLight"
                position={[0, 1, 0]}
                color={hemisphere.color}
                groundColor={hemisphere.groundColor}
                intensity={hemisphere.intensity}
            />
            {/* TODO: Update shadow camera position based on camera position */}
            <directionalLight
                ref={directionalLightRef}
                key={directionalLightKey}
                name="Environment:SunDirectionalLight"
                intensity={directionalLight.intensity}
                color={directionalLight.color}
                position={directionalLight.position}
                shadow-intensity={
                    qualityProfile.shadows
                        ? shadowVisibility * gameLightRig.shadowIntensity
                        : 0
                }
                shadow-mapSize-height={shadowMapSize}
                shadow-mapSize-width={shadowMapSize}
                shadow-radius={gameLightRig.shadowRadius}
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
                <GeneratedPlantShadowLayerBridge
                    directionalLightRef={directionalLightRef}
                    enabled={qualityProfile.shadows}
                />
            </directionalLight>
            {!noWarmProps && (
                <WarmProps
                    tier={qualityProfile.tier}
                    enabled={!weatherDisabled}
                    soundEnabled={!noSound}
                    rain={blendedWeather?.rainy ?? 0}
                    snow={blendedWeather?.snowy ?? 0}
                    windSpeed={blendedWeather?.windSpeed ?? 0}
                    windDirection={windDirection}
                />
            )}
            <AutumnPropWindEnvironment
                speed={windSpeed}
                direction={windDirection}
                snow={Math.max(snowCoverage, blendedWeather?.snowy ?? 0)}
                enabled={!weatherDisabled}
            />
            <WeatherAmbience
                weather={actualWeather}
                timeOfDay={timeOfDay}
                enabled={!noSound && sceneRuntimeVisible}
                debug={hasWeatherOverride}
            />
            <WindAmbience
                windSpeed={actualWeather?.windSpeed ?? 0}
                rainIntensity={actualWeather?.rainy ?? 0}
                enabled={!noSound && !weatherDisabled && sceneRuntimeVisible}
                debug={hasWeatherOverride}
            />
            <AutumnRustle
                windSpeed={blendedWeather?.windSpeed ?? 0}
                enabled={!noSound && !weatherDisabled && sceneRuntimeVisible}
            />
            <LocalizedSteam
                tier={qualityProfile.tier}
                enabled={!weatherDisabled}
                windSpeed={blendedWeather?.windSpeed ?? 0}
                windDirection={windDirection}
                rain={rain}
                snow={snowParticles}
            />
            <SceneBlockDataBoundary>
                <AutumnLeaves
                    tier={qualityProfile.tier}
                    stacks={sceneGarden?.stacks}
                    gardenId={garden?.id}
                    enabled={!weatherDisabled}
                    windSpeed={blendedWeather?.windSpeed ?? 0}
                    windDirection={windDirection}
                    rain={blendedWeather?.rainy ?? 0}
                    snow={blendedWeather?.snowy ?? 0}
                />
                <DistantBirdFlocks
                    tier={qualityProfile.tier}
                    stacks={sceneGarden?.stacks}
                    gardenId={garden?.id}
                    enabled={
                        !weatherDisabled &&
                        !noDistantBirdFlocks &&
                        !closeupCameraSettled
                    }
                    rain={blendedWeather?.rainy ?? 0}
                    snow={blendedWeather?.snowy ?? 0}
                    fog={blendedWeather?.foggy ?? 0}
                    windSpeed={blendedWeather?.windSpeed ?? 0}
                />
                <ColdWeatherEffects
                    weather={actualWeather}
                    tier={qualityProfile.tier}
                    enabled={!weatherDisabled}
                />
            </SceneBlockDataBoundary>
            {showStars && (
                <Stars visibility={closeupCameraSettled ? 0 : starVisibility} />
            )}
            {showPerseids && (
                <Perseids
                    meteorsPerHour={perseidsMeteorRate}
                    visibility={perseidsVisibility}
                />
            )}
            {!noBackground && (
                <SunMoon
                    screenOffsetMultiplier={celestialOffsetMultiplier}
                    solarEclipse={solarEclipse}
                    visibility={closeupCameraSettled ? 0 : bodyVisibility}
                />
            )}
            {!weatherDisabled && (
                <fog
                    attach="fog"
                    args={[
                        atmosphereFog.color,
                        atmosphereFog.near,
                        atmosphereFog.far,
                    ]}
                />
            )}
            {!weatherDisabled && (
                <SceneBlockDataBoundary>
                    <WeatherFrameProvider
                        debug={weatherDebug}
                        quality={qualityProfile}
                        snowCover={snowCoverage}
                        stacks={sceneGarden?.stacks}
                        timeOfDay={timeOfDay}
                        weather={blendedWeather}
                    >
                        <WeatherLayers />
                    </WeatherFrameProvider>
                </SceneBlockDataBoundary>
            )}
            {(solarEclipse?.obscuration ?? 0) > 0 ? (
                <SolarEclipseSceneOverlay
                    obscuration={solarEclipse?.obscuration ?? 0}
                />
            ) : null}
        </>
    );
}
