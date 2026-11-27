'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import {
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    PlaneGeometry,
    ShaderMaterial,
    Vector2,
    Vector3,
} from 'three';
import type { ResolvedWeatherRoles } from '../weather/weatherRoles';
import {
    snowDiscFragmentShader,
    snowDiscVertexShader,
} from './snowFieldShaders';
import { createSnowFlakeSeeds, snowFieldStyle } from './snowParticles';
import type { SnowFieldUniforms } from './useSnowField';

/** One camera-facing quad per flake, seeds per instance. */
export function useSnowFlakeGeometry(capacity: number, key: string) {
    const geometry = useMemo(() => {
        const plane = new PlaneGeometry(1, 1);
        const instanced = new InstancedBufferGeometry();
        instanced.index = plane.index;
        instanced.setAttribute('position', plane.getAttribute('position'));
        instanced.setAttribute('uv', plane.getAttribute('uv'));
        instanced.setAttribute(
            'aSeed',
            new InstancedBufferAttribute(
                createSnowFlakeSeeds(capacity, key),
                4,
            ),
        );
        instanced.instanceCount = 0;
        return instanced;
    }, [capacity, key]);
    useEffect(() => () => geometry.dispose(), [geometry]);
    return geometry;
}

/**
 * Soft two-tone snow discs of 7, 9.5 and 12.5 px (GAME_ART.md "Weather >
 * Snow"): a light core, a tinted edge and a small highlight. One instanced
 * draw, depth-tested, so the garden hides the flakes behind it.
 */
export function SnowDiscs({
    capacity,
    count,
    field,
    roles,
}: {
    capacity: number;
    count: number;
    field: SnowFieldUniforms;
    roles: Pick<ResolvedWeatherRoles, 'flakeCore' | 'flakeEdge'>;
}) {
    const geometry = useSnowFlakeGeometry(capacity, 'weather-snow-discs');
    // biome-ignore lint/correctness/useExhaustiveDependencies: built once per field; the role colours are copied in below.
    const material = useMemo(
        () =>
            new ShaderMaterial({
                depthTest: true,
                depthWrite: false,
                fragmentShader: snowDiscFragmentShader,
                name: 'Weather:SnowDiscMaterial',
                toneMapped: false,
                transparent: true,
                uniforms: {
                    ...field,
                    uSizesPx: {
                        value: new Vector3(...snowFieldStyle.discSizesPx),
                    },
                    uDiscFall: {
                        value: new Vector2(...snowFieldStyle.discFallFactor),
                    },
                    uDiscSway: { value: snowFieldStyle.discSway },
                    uCore: { value: roles.flakeCore.clone() },
                    uEdge: { value: roles.flakeEdge.clone() },
                },
                vertexShader: snowDiscVertexShader,
            }),
        [field],
    );
    useEffect(() => () => material.dispose(), [material]);

    useLayoutEffect(() => {
        material.uniforms.uCore.value.copy(roles.flakeCore);
        material.uniforms.uEdge.value.copy(roles.flakeEdge);
    }, [material, roles.flakeCore, roles.flakeEdge]);

    const visibleCount = Math.max(0, Math.min(capacity, Math.floor(count)));
    useLayoutEffect(() => {
        geometry.instanceCount = visibleCount;
    }, [geometry, visibleCount]);

    return (
        <mesh
            frustumCulled={false}
            geometry={geometry}
            material={material}
            name={`Weather:SnowFlakes:count:${visibleCount}:capacity:${capacity}`}
            renderOrder={36}
            visible={visibleCount > 0}
        />
    );
}
