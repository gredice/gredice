'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { OrthographicCamera, SRGBColorSpace } from 'three';
import { useCurrentGarden } from '../../../hooks/useCurrentGarden';
import { useSceneCurrentGarden } from '../../../hooks/useSceneCurrentGarden';
import { resolveIslandFoggy } from '../../atmosphereLighting';
import { updateGameProfileMetadata } from '../../gameProfileMetadata';
import { MorningMist } from '../../MorningMist';
import { useSceneBlockData } from '../../SceneBlockDataContext';
import {
    sceneFrameRates,
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../../SceneTime';
import type { EnvironmentWeather } from '../../weatherBlend';
import { useWeatherFrame } from '../WeatherFrameContext';
import {
    attachGroundMistToScene,
    clearGroundMistUniforms,
    createGroundMistBlockHeightLookup,
    groundMistRules,
    installGroundMistShaderChunk,
    readGroundMistUniforms,
    resolveGroundMistBandScale,
    resolveGroundMistLevel,
    resolveGroundMistPhaseSpeed,
    writeGroundMistUniforms,
} from './groundMistShaderChunk';
import { type MistRollStats, MistRolls } from './MistRolls';

// The mist lives in the shared fog shader chunks, so it must be installed
// before the first material compiles; Environment imports this module.
installGroundMistShaderChunk();

/** Debug: measurements turn the ground mist off to compare the same frame. */
let groundMistDebugDisabled = false;

function publishFogDebug(
    stats: Record<string, unknown>,
    requestRender: (reason: string) => unknown,
) {
    // Only with the weather inspector (`&weatherInspect=1`) on.
    if (
        typeof window === 'undefined' ||
        !Reflect.has(window, '__grediceWeatherFrame')
    ) {
        return;
    }
    Reflect.set(window, '__grediceFogLayer', {
        ...stats,
        get mist() {
            return readGroundMistUniforms();
        },
        setGroundMistEnabled: (enabled: boolean) => {
            groundMistDebugDisabled = !enabled;
            requestRender('weather-fog-debug');
        },
    });
}

/**
 * WP4: lilac ground mist in bands that slide, a light back haze, mist rolls
 * along the rim and in free sky, and the morning mist wisps
 * (GAME_ART.md "Weather > Fog and mist").
 *
 * The ground mist and haze are not meshes: every lit material mixes them in
 * through the shared fog chunk (`groundMistShaderChunk.ts`), and the static
 * cache replay adds them on top of its capture, so moving mist is never
 * frozen into the cache. This layer only writes the shared uniforms and
 * holds a render lease while the bands slide.
 */
export function FogLayer() {
    const frame = useWeatherFrame();
    const blockData = useSceneBlockData();
    const { data: garden } = useCurrentGarden();
    const sceneGarden = useSceneCurrentGarden(garden);
    const stacks = sceneGarden?.stacks;
    const camera = useThree((state) => state.camera);
    const time = useSceneTimeUniform();
    const fixedTime = useSceneFixedTimeSeconds();
    const requestRender = useSceneRenderRequest();

    const { amounts, footprint, reducedMotion, roles } = frame;
    // The ground mist and back haze a storm or a shower brings follow the
    // island's cover curve; fog that is its own weather keeps all of it
    // (`resolveIslandFoggy`, which the mist rolls read too).
    const foggy = resolveIslandFoggy(amounts);
    const moving = foggy > groundMistRules.activeFoggy && !reducedMotion;
    useSceneTimeInvalidation(
        'weather-fog',
        moving && fixedTime === undefined,
        sceneFrameRates.ambient,
    );

    const groundY = useMemo(
        () =>
            resolveGroundMistLevel(
                stacks,
                createGroundMistBlockHeightLookup(blockData),
            ),
        [blockData, stacks],
    );

    const speed = resolveGroundMistPhaseSpeed(amounts.windClass);
    const state = useRef<{ phase: number; lastTime: number }>({
        phase: groundMistRules.phaseStart,
        lastTime: Number.NaN,
    });
    const color = useMemo((): [number, number, number] => {
        const rgb = { r: 0, g: 0, b: 0 };
        roles.mist.getRGB(rgb, SRGBColorSpace);
        return [rgb.r, rgb.g, rgb.b];
    }, [roles]);

    // Writes everything; the camera is read here, so pans and zooms only
    // need the frame they already render.
    const write = useCallback(() => {
        const sim = state.current;
        const now = time.value;
        if (reducedMotion) {
            sim.phase = groundMistRules.phaseStart;
        } else if (fixedTime !== undefined) {
            sim.phase = groundMistRules.phaseStart + fixedTime * speed;
        } else if (moving && Number.isFinite(sim.lastTime)) {
            sim.phase +=
                Math.max(0, Math.min(0.25, now - sim.lastTime)) * speed;
        }
        // Under `activeFoggy` the faint bands hold where they are (no jump
        // back to the start when the fog thins), and nothing renders for them.
        sim.lastTime = now;
        const e = camera.matrixWorld.elements;
        const orthographic = camera instanceof OrthographicCamera;
        const halfHeight = orthographic
            ? (camera.top - camera.bottom) / (2 * Math.max(1e-6, camera.zoom))
            : 1;
        const amount = groundMistDebugDisabled ? 0 : foggy;
        // Softer bands where the garden shows many rows (a farm).
        const ax = e[0] ?? 1;
        const az = e[2] ?? 0;
        const along = Math.hypot(ax, az) || 1;
        const bounds = footprint?.hullBounds;
        const bandScale =
            orthographic && bounds
                ? resolveGroundMistBandScale({
                      upDepth: ((e[4] ?? 0) * -az + (e[6] ?? 0) * ax) / along,
                      visibleHeight:
                          Math.min(bounds[3], halfHeight) -
                          Math.max(bounds[1], -halfHeight),
                  })
                : 1;
        return writeGroundMistUniforms({
            amount,
            phase: sim.phase,
            groundY,
            haze: orthographic ? amount * groundMistRules.hazeMax : 0,
            color,
            alongX: e[0] ?? 1,
            alongZ: e[2] ?? 0,
            up: [e[4] ?? 0, e[5] ?? 1, e[6] ?? 0],
            halfHeight,
            center: [e[12] ?? 0, e[13] ?? 0, e[14] ?? 0],
            bandScale,
        });
    }, [
        camera,
        color,
        fixedTime,
        foggy,
        footprint,
        groundY,
        moving,
        reducedMotion,
        speed,
        time,
    ]);

    // Weather, colour and garden changes reach the uniforms at once, even
    // when nothing else is rendering.
    useEffect(() => {
        if (write()) requestRender('weather-fog');
    }, [requestRender, write]);
    // The mist reaches the shaders only while this garden's scene renders.
    const scene = useThree((state) => state.scene);
    useEffect(() => attachGroundMistToScene(scene), [scene]);
    useEffect(
        () => () => {
            if (clearGroundMistUniforms()) requestRender('weather-fog-off');
        },
        [requestRender],
    );
    useFrame(() => {
        write();
    });

    const rollStats = useRef<MistRollStats | null>(null);
    const onRollStats = useCallback(
        (stats: MistRollStats) => {
            rollStats.current = stats;
            updateGameProfileMetadata({
                mistRimRollCount: stats.rimRolls,
                mistSkyRollCount: stats.skyRolls,
            });
            publishFogDebug({ rolls: stats, groundY }, requestRender);
        },
        [groundY, requestRender],
    );
    useEffect(() => {
        publishFogDebug({ rolls: rollStats.current, groundY }, requestRender);
    }, [groundY, requestRender]);
    useEffect(
        () => () =>
            updateGameProfileMetadata({
                mistRimRollCount: 0,
                mistSkyRollCount: 0,
            }),
        [],
    );

    const morningWeather = useMemo<EnvironmentWeather>(
        () => ({
            cloudy: amounts.cloudy,
            foggy: amounts.foggy,
            rainy: amounts.rainy,
            snowy: amounts.snowy,
            windSpeed: amounts.windClass,
        }),
        [
            amounts.cloudy,
            amounts.foggy,
            amounts.rainy,
            amounts.snowy,
            amounts.windClass,
        ],
    );

    return (
        <>
            <MistRolls
                blockData={blockData}
                onStats={onRollStats}
                stacks={stacks}
            />
            <MorningMist
                enabled
                gardenId={garden?.id}
                mistColor={roles.mist}
                reducedMotion={reducedMotion}
                snowCover={amounts.snowCover}
                stacks={stacks}
                tier={frame.caps.tier}
                timeOfDay={frame.timeOfDay}
                weather={morningWeather}
            />
        </>
    );
}
