'use client';

import { useThree } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react';
import { type Camera, OrthographicCamera } from 'three';
import type { GardenStack } from '../../types/Stack';
import { useGameState } from '../../useGameState';
import { resolveIslandFoggy } from '../atmosphereLighting';
import type { GameQualityProfile } from '../gameQuality';
import { SceneBlockDataContext } from '../SceneBlockDataContext';
import { type EnvironmentWeather, resolveWeatherStorm } from '../weatherBlend';
import { getMistRollGeometryData } from './fog/mistRollGeometry';
import {
    type MistSkyRollPlacement,
    resolveCloudBandReserve,
    resolveMistRollAmount,
    resolveMistRollUnitHalf,
    resolveMistSkyRolls,
} from './fog/mistRollLayout';
import {
    createGardenFootprintBlockLookup,
    type GardenFootprint,
    projectGardenFootprint,
    resolveGardenFootprintVolumes,
} from './gardenFootprint';
import {
    layoutSky,
    type SkyLayout,
    type ViewBasis,
    type ViewRect,
} from './skyLayout';
import {
    useWeatherReducedMotion,
    WeatherReducedMotionOverrideContext,
} from './useWeatherReducedMotion';
import {
    isWeatherHiddenLayer,
    type WeatherDebugOptions,
    type WeatherHiddenLayer,
    type WeatherLightningDebug,
} from './weatherDebug';
import { type ResolvedWeatherRoles, resolveWeatherRoles } from './weatherRoles';
import {
    resolveViewAreaScale,
    resolveWeatherTierCaps,
    type WeatherTierCaps,
} from './weatherTierCaps';
import { resolveWindClass, resolveWindDirectionDegrees } from './windClass';

/** Blended weather amounts every layer reads. */
export type WeatherFrameAmounts = {
    cloudy: number;
    foggy: number;
    rainy: number;
    snowy: number;
    /** Discrete thunder flag: the bolt starts and stops at once. */
    thundery: number;
    /** Damped storm amount, 0 to 1: the violet storm tint follows it. */
    storm: number;
    /** The one wind scale, class 0 to 4 (`windClass.ts`). */
    windClass: number;
    /** Wind direction in degrees (`resolveWindVector` for a vector). */
    windDirection: number;
    /** Snow lying on the ground, 0 to 1 (from accumulation, not snowfall). */
    snowCover: number;
};

/** The orthographic view: sizes in CSS pixels and world units. */
export type WeatherView = {
    widthPx: number;
    heightPx: number;
    /** CSS pixels per world unit (the camera zoom). */
    pixelsPerUnit: number;
    halfWidth: number;
    halfHeight: number;
    basis: ViewBasis;
};

export type WeatherFrame = {
    amounts: WeatherFrameAmounts;
    roles: ResolvedWeatherRoles;
    caps: WeatherTierCaps;
    reducedMotion: boolean;
    /** Visual time of day, 0 to 1. */
    timeOfDay: number;
    /**
     * `avatar` is the third- and first-person perspective view: sky props
     * and the band are off there; particles and ground effects stay.
     */
    cameraMode: 'orthographic' | 'avatar';
    /** Null in the avatar view. */
    view: WeatherView | null;
    /** The canvas pixel area over 1280 × 800, for particle counts. */
    viewAreaScale: number;
    /** Garden silhouette in view units; null in the avatar view. */
    footprint: GardenFootprint | null;
    /** The band, its bolt stretches and bolt anchors; null in the avatar view. */
    skyLayout: SkyLayout | null;
    /**
     * Free-sky props placed in order, each clear of the ones before it: the
     * band and the bolts (`skyLayout`), then the sky mist rolls; `reserved`
     * is all of their padded space, which the wind swooshes keep clear of.
     */
    skyProps: {
        /** The top band's reach the sky mist rolls stay below. */
        mistBand: ViewRect | null;
        mistSkyRolls: readonly MistSkyRollPlacement[];
        reserved: readonly ViewRect[];
    };
    debug: {
        hidden: ReadonlySet<WeatherHiddenLayer>;
        lightning: WeatherLightningDebug | null;
    };
};

const WeatherFrameContext = createContext<WeatherFrame | null>(null);

/** The weather frame; only inside `WeatherFrameProvider`. */
export function useWeatherFrame() {
    const frame = useContext(WeatherFrameContext);
    if (frame === null) {
        throw new Error('Missing WeatherFrameProvider in the tree');
    }
    return frame;
}

/** The weather frame, or null outside `WeatherFrameProvider`. */
export function useOptionalWeatherFrame() {
    return useContext(WeatherFrameContext);
}

export function isWeatherLayerHidden(
    frame: Pick<WeatherFrame, 'debug'>,
    layer: WeatherHiddenLayer,
) {
    return frame.debug.hidden.has(layer);
}

function normalized(x: number, y: number, z: number, sign = 1) {
    const length = Math.hypot(x, y, z) || 1;
    return {
        x: (sign * x) / length,
        y: (sign * y) / length,
        z: (sign * z) / length,
    };
}

/** Camera axes from a camera's world matrix (column-major elements). */
export function resolveWeatherViewBasis(
    elements: ArrayLike<number>,
): ViewBasis {
    const at = (index: number) => elements[index] ?? 0;
    return {
        right: normalized(at(0), at(1), at(2)),
        up: normalized(at(4), at(5), at(6)),
        forward: normalized(at(8), at(9), at(10), -1),
        origin: { x: at(12), y: at(13), z: at(14) },
    };
}

function resolveWeatherView(
    camera: Camera,
    size: { width: number; height: number },
): WeatherView | null {
    if (!(camera instanceof OrthographicCamera)) {
        return null;
    }
    camera.updateMatrixWorld();
    const pixelsPerUnit = Math.max(1e-6, camera.zoom);
    return {
        widthPx: size.width,
        heightPx: size.height,
        pixelsPerUnit,
        halfWidth: size.width / 2 / pixelsPerUnit,
        halfHeight: size.height / 2 / pixelsPerUnit,
        basis: resolveWeatherViewBasis(camera.matrixWorld.elements),
    };
}

type WeatherFrameProviderProps = PropsWithChildren<{
    debug?: WeatherDebugOptions;
    quality: GameQualityProfile;
    /** Snow lying on the ground, 0 to 1. */
    snowCover: number;
    stacks: readonly GardenStack[] | undefined;
    timeOfDay: number;
    /** Blended weather (`useBlendedWeather`). */
    weather: EnvironmentWeather | undefined;
}>;

/**
 * One frame of shared weather state for every weather layer: blended
 * amounts, roles, tier caps, reduced motion, the view, the garden footprint
 * and the sky layout. Everything is memoised on its inputs, so a still
 * camera and settled weather cost nothing per frame.
 */
export function WeatherFrameProvider({
    debug,
    ...props
}: WeatherFrameProviderProps) {
    return (
        <WeatherReducedMotionOverrideContext.Provider
            value={debug?.reducedMotion ?? null}
        >
            <WeatherFrameValueProvider debug={debug} {...props} />
        </WeatherReducedMotionOverrideContext.Provider>
    );
}

function WeatherFrameValueProvider({
    children,
    debug,
    quality,
    snowCover,
    stacks,
    timeOfDay,
    weather,
}: WeatherFrameProviderProps) {
    const camera = useThree((state) => state.camera);
    const width = useThree((state) => state.size.width);
    const height = useThree((state) => state.size.height);
    // The camera rig publishes a new snapshot only when the camera moved.
    const cameraVersion = useGameState(
        (state) => state.gameCameraSnapshot?.version ?? 0,
    );
    const blockData = useContext(SceneBlockDataContext)?.data;
    const reducedMotion = useWeatherReducedMotion();
    const timings = useRef({ footprintMs: 0, layoutMs: 0 });

    const cloudy = weather?.cloudy ?? 0;
    const foggy = weather?.foggy ?? 0;
    const rainy = weather?.rainy ?? 0;
    const snowy = weather?.snowy ?? 0;
    const thundery = weather?.thundery ?? 0;
    const storm = resolveWeatherStorm(weather);
    const windClass = resolveWindClass(weather);
    const windDirection = resolveWindDirectionDegrees(weather?.windDirection);

    const amounts = useMemo<WeatherFrameAmounts>(
        () => ({
            cloudy,
            foggy,
            rainy,
            snowy,
            thundery,
            storm,
            windClass,
            windDirection,
            snowCover,
        }),
        [
            cloudy,
            foggy,
            rainy,
            snowy,
            snowCover,
            storm,
            thundery,
            windClass,
            windDirection,
        ],
    );

    const roles = useMemo(
        () => resolveWeatherRoles(timeOfDay, { cloudy, rainy, snowy, storm }),
        [cloudy, rainy, snowy, storm, timeOfDay],
    );

    const { rainParticleMultiplier, shadows, snowParticleMultiplier, tier } =
        quality;
    const caps = useMemo(
        () =>
            resolveWeatherTierCaps({
                rainParticleMultiplier,
                shadows,
                snowParticleMultiplier,
                tier,
            }),
        [rainParticleMultiplier, shadows, snowParticleMultiplier, tier],
    );

    const volumes = useMemo(
        () =>
            resolveGardenFootprintVolumes(
                stacks,
                createGardenFootprintBlockLookup(blockData),
            ),
        [blockData, stacks],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: the camera is mutable; its snapshot version marks a move.
    const view = useMemo(
        () => resolveWeatherView(camera, { width, height }),
        [camera, cameraVersion, height, width],
    );

    const footprint = useMemo(() => {
        if (!view) {
            return null;
        }
        const started = performance.now();
        const projected = projectGardenFootprint(volumes, view.basis);
        timings.current.footprintMs = performance.now() - started;
        return projected;
    }, [view, volumes]);

    const thunder = thundery > 0;
    const skyLayout = useMemo(() => {
        if (!view || !footprint) {
            return null;
        }
        const started = performance.now();
        const layout = layoutSky({
            cloudy,
            obstacles: footprint,
            thunder,
            view,
            windClass,
        });
        timings.current.layoutMs = performance.now() - started;
        return layout;
    }, [cloudy, footprint, thunder, view, windClass]);

    // Sky mist rolls take free sky after the band and the bolts; the
    // swooshes then keep clear of all of them. Same amount as `MistRolls`
    // draws: storm and shower fog follows the island's cover curve.
    const mistVisible =
        resolveMistRollAmount(resolveIslandFoggy(amounts)) > 0.01;
    const mistSkyRollCap = caps.mistSkyRolls;
    const mistBand = useMemo(
        () =>
            mistVisible && view && footprint
                ? resolveCloudBandReserve({
                      cloudy,
                      storm,
                      thunder,
                      view,
                      obstacles: footprint,
                  })
                : null,
        [cloudy, footprint, mistVisible, storm, thunder, view],
    );
    const skyProps = useMemo(() => {
        if (!mistVisible || !view || !footprint || !skyLayout) {
            return {
                mistBand,
                mistSkyRolls: [],
                reserved: skyLayout?.placed ?? [],
            };
        }
        const sizes = getMistRollGeometryData().map((data) => data.size);
        const mistSkyRolls = resolveMistSkyRolls({
            cap: mistSkyRollCap,
            view,
            obstacles: footprint,
            placed: skyLayout.placed,
            band: mistBand,
            pad: skyLayout.pad,
            unitHalf: resolveMistRollUnitHalf(view.basis, sizes),
        });
        const [padU, padV] = skyLayout.pad;
        return {
            mistBand,
            mistSkyRolls,
            reserved: [
                ...skyLayout.placed,
                ...mistSkyRolls.map(
                    ({ rect }): ViewRect => [
                        rect[0] - padU,
                        rect[1] - padV,
                        rect[2] + padU,
                        rect[3] + padV,
                    ],
                ),
            ],
        };
    }, [footprint, mistBand, mistSkyRollCap, mistVisible, skyLayout, view]);

    // Keyed by value: the debug options may arrive as fresh objects.
    const hiddenKey = [...(debug?.hide ?? [])].sort().join(',');
    const lightningMode = debug?.lightning?.mode ?? null;
    const lightningSeconds =
        debug?.lightning?.mode === 'at' ? debug.lightning.seconds : null;
    const debugValue = useMemo(() => {
        const hidden = new Set<WeatherHiddenLayer>();
        for (const name of hiddenKey.split(',')) {
            if (isWeatherHiddenLayer(name)) hidden.add(name);
        }
        const lightning: WeatherLightningDebug | null =
            lightningMode === 'off'
                ? { mode: 'off' }
                : lightningMode === 'at' && lightningSeconds !== null
                  ? { mode: 'at', seconds: lightningSeconds }
                  : null;
        return { hidden, lightning };
    }, [hiddenKey, lightningMode, lightningSeconds]);

    const viewAreaScale = resolveViewAreaScale(width, height);
    const value = useMemo<WeatherFrame>(
        () => ({
            amounts,
            roles,
            caps,
            reducedMotion,
            timeOfDay,
            cameraMode: view ? 'orthographic' : 'avatar',
            view,
            viewAreaScale,
            footprint,
            skyLayout,
            skyProps,
            debug: debugValue,
        }),
        [
            amounts,
            caps,
            debugValue,
            footprint,
            reducedMotion,
            roles,
            skyLayout,
            skyProps,
            timeOfDay,
            view,
            viewAreaScale,
        ],
    );

    const inspect = Boolean(debug?.inspect);
    useEffect(() => {
        if (!inspect || typeof window === 'undefined') {
            return;
        }
        // Debug only: time a camera change (projection and layout) warm,
        // averaged, since one call is below the timer's resolution.
        let cameraChangeMs: number | null = null;
        if (value.view) {
            const runs = 50;
            const started = performance.now();
            for (let run = 0; run < runs; run += 1) {
                layoutSky({
                    cloudy: value.amounts.cloudy,
                    obstacles: projectGardenFootprint(
                        volumes,
                        value.view.basis,
                    ),
                    thunder: value.amounts.thundery > 0,
                    view: value.view,
                    windClass: value.amounts.windClass,
                });
            }
            cameraChangeMs = (performance.now() - started) / runs;
        }
        Reflect.set(window, '__grediceWeatherFrame', {
            amounts: value.amounts,
            caps: value.caps,
            cameraMode: value.cameraMode,
            debug: {
                hidden: [...value.debug.hidden],
                lightning: value.debug.lightning,
            },
            footprint: value.footprint,
            reducedMotion: value.reducedMotion,
            skyLayout: value.skyLayout,
            skyProps: value.skyProps,
            timings: { ...timings.current, cameraChangeMs },
            view: value.view,
        });
    }, [inspect, value, volumes]);

    return (
        <WeatherFrameContext.Provider value={value}>
            {children}
        </WeatherFrameContext.Provider>
    );
}
