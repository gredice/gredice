'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import { ShaderMaterial, Vector2 } from 'three';
import type { ResolvedWeatherRoles } from '../weather/weatherRoles';
import { useSnowFlakeGeometry } from './SnowDiscs';
import {
    snowIconFragmentShader,
    snowIconVertexShader,
} from './snowFieldShaders';
import { snowFieldStyle } from './snowParticles';
import type { SnowFieldUniforms } from './useSnowField';

/**
 * Icon snowflakes (GAME_ART.md "Weather > Snow"): 12% of the flakes are the
 * team's snowflake icon, 20 to 26 px, drawn as a distance field on one quad
 * (decision D3: the vector shape, no texture). They spin at 0.6 rad/s either
 * way, and not at all under reduced motion. One instanced draw.
 */
export function SnowIconFlakes({
    capacity,
    count,
    field,
    reducedMotion,
    roles,
}: {
    capacity: number;
    count: number;
    field: SnowFieldUniforms;
    reducedMotion: boolean;
    roles: Pick<
        ResolvedWeatherRoles,
        'iconFlakeFace' | 'iconFlakeGlint' | 'iconFlakeRim'
    >;
}) {
    const geometry = useSnowFlakeGeometry(capacity, 'weather-snow-icons');
    // biome-ignore lint/correctness/useExhaustiveDependencies: built once per field; colours and spin are set below.
    const material = useMemo(
        () =>
            new ShaderMaterial({
                depthTest: true,
                depthWrite: false,
                fragmentShader: snowIconFragmentShader,
                name: 'Weather:SnowIconFlakeMaterial',
                toneMapped: false,
                transparent: true,
                uniforms: {
                    ...field,
                    uIconSizePx: {
                        value: new Vector2(...snowFieldStyle.iconSizePx),
                    },
                    uIconFall: {
                        value: new Vector2(...snowFieldStyle.iconFallFactor),
                    },
                    uIconSway: { value: snowFieldStyle.iconSway },
                    uSpin: { value: snowFieldStyle.iconSpin },
                    uFace: { value: roles.iconFlakeFace.clone() },
                    uRim: { value: roles.iconFlakeRim.clone() },
                    uGlint: { value: roles.iconFlakeGlint.clone() },
                },
                vertexShader: snowIconVertexShader,
            }),
        [field],
    );
    useEffect(() => () => material.dispose(), [material]);

    useLayoutEffect(() => {
        material.uniforms.uFace.value.copy(roles.iconFlakeFace);
        material.uniforms.uRim.value.copy(roles.iconFlakeRim);
        material.uniforms.uGlint.value.copy(roles.iconFlakeGlint);
    }, [
        material,
        roles.iconFlakeFace,
        roles.iconFlakeGlint,
        roles.iconFlakeRim,
    ]);

    useLayoutEffect(() => {
        material.uniforms.uSpin.value = reducedMotion
            ? 0
            : snowFieldStyle.iconSpin;
    }, [material, reducedMotion]);

    const visibleCount = Math.max(0, Math.min(capacity, Math.floor(count)));
    useLayoutEffect(() => {
        geometry.instanceCount = visibleCount;
    }, [geometry, visibleCount]);

    return (
        <mesh
            frustumCulled={false}
            geometry={geometry}
            material={material}
            name={`Weather:SnowIconFlakes:count:${visibleCount}:capacity:${capacity}`}
            renderOrder={37}
            visible={visibleCount > 0}
        />
    );
}
