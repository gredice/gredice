'use client';

import { getEffectiveGardenStackBlockHeight } from '@gredice/js/gardenBlocks';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import {
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    type IUniform,
    PlaneGeometry,
    ShaderMaterial,
    Vector4,
} from 'three';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useSceneBlockData } from '../SceneBlockDataContext';
import {
    useSceneContinuousRenderReader,
    useSceneTimeUniform,
} from '../SceneTime';
import { createGardenFootprintBlockLookup } from '../weather/gardenFootprint';
import type { ResolvedWeatherRoles } from '../weather/weatherRoles';
import {
    snowSparkleFragmentShader,
    snowSparkleVertexShader,
} from './snowFieldShaders';
import {
    createSnowFlakeSeeds,
    resolveSnowSparkleSpots,
    snowFieldStyle,
} from './snowParticles';

/**
 * About 14 small four-ray sparkles that twinkle on full snow cover (2.6 s
 * each), wandering over the open terrain tiles of the garden. One instanced
 * draw; off under reduced motion (the caller passes a count of 0).
 *
 * They hold no render lease, so still lying snow on a clear day keeps no
 * frame loop running. Their clock follows scene time only on frames the
 * scene renders at a steady rate anyway (falling snow, fauna, plant sway or
 * any other lease); when nothing else renders they hold still, and a
 * one-off frame (a hover, a tap) shows them where they stopped.
 */
export function SnowSparkles({
    amount,
    capacity,
    count,
    roles,
}: {
    amount: number;
    capacity: number;
    count: number;
    roles: Pick<ResolvedWeatherRoles, 'flakeCore'>;
}) {
    const timeUniform = useSceneTimeUniform();
    const readContinuousRender = useSceneContinuousRenderReader();
    // The sparkles' own clock: it starts at the scene time and copies it on
    // every steadily rendered frame (after the scene clock has advanced it).
    const sparkleTime = useMemo<IUniform<number>>(
        () => ({ value: timeUniform.value }),
        [timeUniform],
    );
    useFrame(() => {
        if (readContinuousRender()) {
            sparkleTime.value = timeUniform.value;
        }
    });
    const visibleCount = Math.max(0, Math.min(capacity, Math.floor(count)));

    const blockData = useSceneBlockData();
    const { data: garden } = useCurrentGarden();
    const stacks = garden?.stacks;
    const spots = useMemo(() => {
        const lookup = createGardenFootprintBlockLookup(blockData);
        return resolveSnowSparkleSpots(stacks, (name, supportName) =>
            getEffectiveGardenStackBlockHeight({
                blockHeight: lookup(name)?.height ?? 0,
                blockName: name,
                supportBlockName: supportName,
            }),
        );
    }, [blockData, stacks]);

    const geometry = useMemo(() => {
        const plane = new PlaneGeometry(1, 1);
        const instanced = new InstancedBufferGeometry();
        instanced.index = plane.index;
        instanced.setAttribute('position', plane.getAttribute('position'));
        instanced.setAttribute('uv', plane.getAttribute('uv'));
        // Two seeds per sparkle: its phase and its spot sequence.
        const seeds = createSnowFlakeSeeds(capacity, 'weather-snow-sparkles');
        instanced.setAttribute(
            'aSeed',
            new InstancedBufferAttribute(
                seeds.subarray(0, Math.max(0, capacity) * 2),
                2,
            ),
        );
        instanced.instanceCount = 0;
        return instanced;
    }, [capacity]);
    useEffect(() => () => geometry.dispose(), [geometry]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: built once per clock; spots, amount and colour are set below.
    const material = useMemo(
        () =>
            new ShaderMaterial({
                depthTest: true,
                depthWrite: false,
                fragmentShader: snowSparkleFragmentShader,
                name: 'Weather:SnowSparkleMaterial',
                toneMapped: false,
                transparent: true,
                uniforms: {
                    uTime: sparkleTime,
                    uCycle: { value: snowFieldStyle.sparkleCycleSeconds },
                    uAmount: { value: 0 },
                    uSize: { value: snowFieldStyle.sparkleSizeUnits },
                    uLift: { value: snowFieldStyle.sparkleLift },
                    uSpotCount: { value: 0 },
                    uSpots: {
                        value: Array.from(
                            { length: snowFieldStyle.sparkleSpotCapacity },
                            () => new Vector4(),
                        ),
                    },
                    uColor: { value: roles.flakeCore.clone() },
                },
                vertexShader: snowSparkleVertexShader,
            }),
        [sparkleTime],
    );
    useEffect(() => () => material.dispose(), [material]);

    useLayoutEffect(() => {
        const slots: Vector4[] = material.uniforms.uSpots.value;
        spots.forEach((spot, index) => {
            slots[index]?.set(spot.x, spot.y, spot.z, 1);
        });
        material.uniforms.uSpotCount.value = Math.min(
            spots.length,
            slots.length,
        );
    }, [material, spots]);

    useLayoutEffect(() => {
        material.uniforms.uAmount.value = amount;
        material.uniforms.uColor.value.copy(roles.flakeCore);
    }, [amount, material, roles.flakeCore]);

    const drawn = spots.length > 0 ? visibleCount : 0;
    useLayoutEffect(() => {
        geometry.instanceCount = drawn;
    }, [drawn, geometry]);

    return (
        <mesh
            frustumCulled={false}
            geometry={geometry}
            material={material}
            name={`Weather:SnowSparkles:count:${drawn}`}
            renderOrder={7}
            visible={drawn > 0}
        />
    );
}
