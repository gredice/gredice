import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { createPrecipitationMaterial } from '../PrecipitationMaterial';
import {
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../SceneTime';
import { usePrecipitationFieldPosition } from '../usePrecipitationFieldPosition';
import {
    advanceRainMotionOffset,
    rainDropLook,
    rainMotionWrap,
} from './rainParticles';
import {
    rainStreakFragmentShader,
    rainStreakVertexShader,
} from './rainShaders';

/** Deterministic seeds, so a frozen frame shows the same drops every run. */
function createRainSeeds(capacity: number) {
    const seeds = new Float32Array(capacity * 4);
    let state = 0x2f6b9d1 ^ capacity;
    for (let index = 0; index < seeds.length; index += 1) {
        // mulberry32
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        seeds[index] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    return seeds;
}

type RainDropFieldProps = {
    /** Instance capacity of the buffer (the tier cap). */
    capacity: number;
    /** Drops drawn, at most the capacity. */
    count: number;
    /** Fall speed at the reference zoom, units per second. */
    fallSpeed: number;
    /** Signed sideways speed at the reference zoom (+ is screen right). */
    slant: number;
    /** Normalised motion (`resolveRainDropMotion`). */
    fallVelocity: number;
    windVelocity: number;
    /** Quad width, streak width and streak length in CSS pixels. */
    quadWidthPx: number;
    coreWidthPx: number;
    lengthPx: number;
    /** Share of the drop opacity shown, 0 to 1 (`resolveRainDropOpacity`). */
    opacity: number;
    /** Ground height the cloud base is measured from. */
    groundY: number;
    head: THREE.Color;
    tail: THREE.Color;
    viewHeightPx: number;
};

/**
 * Party-style rain: slim blue streaks of a fixed pixel size in a field sized
 * to the view, depth-tested, one instanced draw. Named `Weather:Rain`
 * (looked up by the precipitation camera-follow fixture).
 */
export function RainDropField({
    capacity,
    coreWidthPx,
    count,
    fallSpeed,
    fallVelocity,
    groundY,
    head,
    lengthPx,
    opacity,
    quadWidthPx,
    slant,
    tail,
    viewHeightPx,
    windVelocity,
}: RainDropFieldProps) {
    const fieldRef = useRef<THREE.Group>(null);
    usePrecipitationFieldPosition({ fieldRef, followCamera: true });
    const timeUniform = useSceneTimeUniform();
    const fixedTime = useSceneFixedTimeSeconds();
    const visible = count > 0 && opacity > 0.001;
    useSceneTimeInvalidation(
        'rain-particles',
        visible && fixedTime === undefined,
    );

    const geometry = useMemo(() => {
        const plane = new THREE.PlaneGeometry(1, 1);
        const instanced = new THREE.InstancedBufferGeometry();
        instanced.index = plane.index;
        instanced.setAttribute('position', plane.getAttribute('position'));
        instanced.setAttribute('uv', plane.getAttribute('uv'));
        instanced.setAttribute(
            'aSeed',
            new THREE.InstancedBufferAttribute(createRainSeeds(capacity), 4),
        );
        instanced.instanceCount = 0;
        return instanced;
    }, [capacity]);
    useEffect(() => () => geometry.dispose(), [geometry]);

    const uniforms = useMemo(
        () => ({
            uMotionEpoch: { value: timeUniform.value },
            uFallOffset: { value: 0 },
            uFallVelocity: { value: 0 },
            uWindOffset: { value: 0 },
            uWindVelocity: { value: 0 },
            uFallSpeed: { value: 0 },
            uSlant: { value: 0 },
            uOpacity: { value: 0 },
            uOpacityRange: {
                value: new THREE.Vector2(
                    rainDropLook.minOpacity,
                    rainDropLook.maxOpacity,
                ),
            },
            uGroundY: { value: 0 },
            uCloudBase: { value: 0 },
            uCloudFade: { value: 0 },
            uSizePx: {
                value: new THREE.Vector2(
                    rainDropLook.quadWidthPx,
                    rainDropLook.lengthPx,
                ),
            },
            uCoreWidthPx: { value: 0 },
            uHead: { value: new THREE.Color() },
            uTail: { value: new THREE.Color() },
        }),
        [timeUniform],
    );
    const viewHeightPxRef = useRef<THREE.IUniform<number>>({
        value: viewHeightPx,
    });
    const viewHeightPxUniform = viewHeightPxRef.current;
    viewHeightPxUniform.value = viewHeightPx;

    const material = useMemo(
        () =>
            createPrecipitationMaterial({
                fragmentShader: rainStreakFragmentShader,
                timeUniform,
                uniforms,
                vertexShader: rainStreakVertexShader,
                viewHeightPxUniform,
            }),
        [timeUniform, uniforms, viewHeightPxUniform],
    );
    useEffect(() => () => material.dispose(), [material]);

    // Rebase the normalised offsets whenever a speed changes, so a rain
    // blend, a zoom or reduced motion never makes the drops jump. A frozen
    // scene time (`fixedTimeSeconds`) places the drops at that time from
    // zero, so the frozen time scrubs the rain like every other effect.
    useLayoutEffect(() => {
        if (fixedTime !== undefined) {
            uniforms.uMotionEpoch.value = 0;
            uniforms.uFallOffset.value = 0;
            uniforms.uWindOffset.value = 0;
            uniforms.uFallVelocity.value = fallVelocity;
            uniforms.uWindVelocity.value = windVelocity;
            return;
        }
        const now = timeUniform.value;
        const elapsed = Math.max(0, now - uniforms.uMotionEpoch.value);
        uniforms.uFallOffset.value = advanceRainMotionOffset(
            uniforms.uFallOffset.value,
            uniforms.uFallVelocity.value,
            elapsed,
            rainMotionWrap.fall,
        );
        uniforms.uWindOffset.value = advanceRainMotionOffset(
            uniforms.uWindOffset.value,
            uniforms.uWindVelocity.value,
            elapsed,
            rainMotionWrap.wind,
        );
        uniforms.uMotionEpoch.value = now;
        uniforms.uFallVelocity.value = fallVelocity;
        uniforms.uWindVelocity.value = windVelocity;
    }, [fallVelocity, fixedTime, timeUniform, uniforms, windVelocity]);

    useLayoutEffect(() => {
        geometry.instanceCount = Math.min(capacity, Math.max(0, count));
        uniforms.uFallSpeed.value = fallSpeed;
        uniforms.uSlant.value = slant;
        uniforms.uOpacity.value = opacity;
        uniforms.uGroundY.value = groundY;
        uniforms.uCloudBase.value = rainDropLook.cloudBaseHeight;
        uniforms.uCloudFade.value = rainDropLook.cloudFadeHeight;
        uniforms.uSizePx.value.set(quadWidthPx, lengthPx);
        uniforms.uCoreWidthPx.value = coreWidthPx;
        uniforms.uHead.value.copy(head);
        uniforms.uTail.value.copy(tail);
    }, [
        capacity,
        coreWidthPx,
        count,
        fallSpeed,
        geometry,
        groundY,
        head,
        lengthPx,
        opacity,
        quadWidthPx,
        slant,
        tail,
        uniforms,
    ]);

    return (
        <group ref={fieldRef} name="Weather:Rain">
            <mesh
                name="Weather:RainDrops"
                geometry={geometry}
                material={material}
                frustumCulled={false}
                renderOrder={35}
                visible={visible}
                raycast={() => undefined}
            />
        </group>
    );
}
