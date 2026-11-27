'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { useCurrentGarden } from '../../../hooks/useCurrentGarden';
import type { GardenStack } from '../../../types/Stack';
import { CloudShadowAttenuation } from '../../CloudShadowAttenuationLayer';
import {
    type CloudShadowField,
    getCloudShadowAttenuationMaterialUniforms,
    resolveCloudShadowCount,
    resolveCloudShadowEllipses,
    resolveCloudShadowLap,
    resolveCloudShadowOvercast,
    resolveCloudShadowProjection,
    resolveCloudShadowStrength,
} from '../../cloudShadowAttenuation';
import { updateGameProfileMetadata } from '../../gameProfileMetadata';
import {
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../../SceneTime';
import {
    isWeatherLayerHidden,
    useWeatherFrame,
    type WeatherFrame,
} from '../WeatherFrameContext';
import { createCloudDriftTravel, stepCloudDriftTravel } from '../windClass';
import { resolveWeatherCloudDrift } from './cloudDrift';
import {
    createSceneKeyLightCache,
    readSceneKeyLightDirection,
} from './sceneKeyLight';

/**
 * Moving lilac cloud shadows (GAME_ART.md "Weather > Cloud shadows"): soft
 * ellipses that travel over the garden with the clouds' drift
 * (`resolveWeatherCloudDrift`: sideways on screen, toward the side the band
 * drifts and the wind blows), not tied to the visible clouds (those sit in
 * the top band and cannot project onto the garden). High 6, medium 4,
 * low 0; partly cloudy uses three, overcast all.
 * Under overcast they keep moving, slower and lighter (decision D2), and
 * they tint the fill light too. 40% speed under reduced motion; gone in fog.
 *
 * The shadows are analytic: this layer writes six centres, radii and
 * amounts per frame into the shared material uniforms. No render target,
 * no mask, and the static cache replays them without a rebuild.
 */

function reportShadowCount(count: number) {
    updateGameProfileMetadata({ cloudProjectedShadowCount: count });
}

/**
 * The ground the shadows travel over: the garden's tiles, measured along
 * and across the drift axis by their spread (√3 × the standard deviation,
 * the half extent of an even strip) rather than their bounding box. For a
 * rectangle measured along its sides the two agree; a rectangle crossed on
 * the diagonal (the drift runs sideways on screen, a diagonal of the grid)
 * keeps its shadows over the garden instead of its box's empty corners.
 */
export function resolveCloudShadowField(
    stacks: readonly Pick<GardenStack, 'position'>[] | undefined,
    axis: { x: number; z: number },
): CloudShadowField {
    let count = 0;
    let sumX = 0;
    let sumZ = 0;
    for (const stack of stacks ?? []) {
        count += 1;
        sumX += stack.position.x;
        sumZ += stack.position.z;
    }
    if (!stacks || count === 0) {
        // No garden yet: a 5 × 5 island at the origin.
        return { centreX: 0, centreZ: 0, halfAlong: 2.5, halfAcross: 2.5 };
    }
    const centreX = sumX / count;
    const centreZ = sumZ / count;
    let along = 0;
    let across = 0;
    for (const stack of stacks) {
        const dx = stack.position.x - centreX;
        const dz = stack.position.z - centreZ;
        along += (dx * axis.x + dz * axis.z) ** 2;
        across += (dz * axis.x - dx * axis.z) ** 2;
    }
    // Each tile is a unit square: its own spread (1/12 any way) adds on.
    return {
        centreX,
        centreZ,
        halfAlong: Math.sqrt(3 * (along / count + 1 / 12)),
        halfAcross: Math.sqrt(3 * (across / count + 1 / 12)),
    };
}

export function CloudShadowDriver() {
    const frame = useWeatherFrame();
    const cap = frame.caps.cloudShadows;
    if (isWeatherLayerHidden(frame, 'sky') || cap <= 0) {
        return <CloudShadowsOff />;
    }
    return <CloudShadowEllipses cap={cap} frame={frame} />;
}

function CloudShadowsOff() {
    useEffect(() => {
        getCloudShadowAttenuationMaterialUniforms().strength.value = 0;
        reportShadowCount(0);
    }, []);
    return null;
}

function CloudShadowEllipses({
    cap,
    frame,
}: {
    cap: number;
    frame: WeatherFrame;
}) {
    const scene = useThree((state) => state.scene);
    const timeUniform = useSceneTimeUniform();
    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const { data: garden } = useCurrentGarden();
    const stacks = garden?.stacks;
    const uniforms = getCloudShadowAttenuationMaterialUniforms();
    const keyLightCache = useMemo(createSceneKeyLightCache, []);
    const keyDirection = useMemo(() => new Vector3(0.4, 0.8, -0.45), []);
    const frameRef = useRef(frame);
    frameRef.current = frame;
    const shownRef = useRef(-1);
    const travel = useMemo(createCloudDriftTravel, []);

    const { cloudy, foggy, rainy, snowy } = frame.amounts;
    const strength = resolveCloudShadowStrength(
        { cloudy, foggy, rainy, snowy },
        frame.roles.cloudShadowStrength,
    );
    const count = resolveCloudShadowCount(cloudy, cap);
    // The band's drift: sideways on screen, toward the band's side.
    const { axisX, axisZ, groundPerSecond } = resolveWeatherCloudDrift(frame);
    const axis = useMemo(() => ({ x: axisX, z: axisZ }), [axisX, axisZ]);
    const field = useMemo(
        () => resolveCloudShadowField(stacks, axis),
        [stacks, axis],
    );
    const lapsPerSecond = groundPerSecond / resolveCloudShadowLap(field);

    // Every lit material is patched as soon as this tier can show shadows,
    // so programs compile with the shadow code while the garden loads and
    // the first cloud of a session never stalls on a recompile. While no
    // shadow shows, the shader skips it (strength 0) and the static cache
    // keeps a single capture (`active` off).
    const showing = strength > 0.001 && count > 0;

    useSceneTimeInvalidation(
        'cloud-shadows',
        fixedTimeSeconds === undefined && showing,
    );

    useEffect(() => {
        if (!showing) {
            uniforms.strength.value = 0;
            if (shownRef.current !== 0) {
                shownRef.current = 0;
                reportShadowCount(0);
            }
        }
    }, [showing, uniforms]);

    useFrame(() => {
        if (!showing) {
            return;
        }
        const current = frameRef.current;
        uniforms.tint.value.copy(current.roles.cloudShadowTint);
        uniforms.axis.value.set(axis.x, axis.z);
        if (readSceneKeyLightDirection(scene, keyLightCache, keyDirection)) {
            const projection = resolveCloudShadowProjection(keyDirection);
            uniforms.projection.value.set(projection.x, projection.z);
        }
        const shown = resolveCloudShadowEllipses({
            amounts: uniforms.amounts.value,
            axis,
            count,
            ellipses: uniforms.ellipses.value,
            field,
            laps: stepCloudDriftTravel(
                travel,
                timeUniform.value,
                lapsPerSecond,
                fixedTimeSeconds !== undefined,
            ),
            overcast: resolveCloudShadowOvercast(current.amounts.cloudy),
            strength,
        });
        uniforms.strength.value = 1;
        if (shown !== shownRef.current) {
            shownRef.current = shown;
            reportShadowCount(shown);
        }
    });

    useEffect(
        () => () => {
            uniforms.strength.value = 0;
            reportShadowCount(0);
        },
        [uniforms],
    );

    return <CloudShadowAttenuation enabled active={showing} />;
}
