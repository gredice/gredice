'use client';

import { useFrame } from '@react-three/fiber';
import {
    type PropsWithChildren,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useSyncExternalStore,
} from 'react';
import { type BufferGeometry, type Group, Material, Vector3 } from 'three';
import { useRainWetOverlayVisible } from '../rain/RainWetOverlay';
import { useGameState } from '../useGameState';
import {
    bindIdleBreathingSubtree,
    createIdleBreathingMaterial,
    createIdleBreathingUniforms,
    createIdleBreathingWorldUniforms,
    getIdleBreathingInstancedRole,
    getIdleBreathingPartsPivot,
    getIdleBreathingPivot,
    hasIdleBreathingOverlay,
    type IdleBreathingRole,
    type IdleBreathingSubtreeBindings,
    idleBreathingSnowThreshold,
    releaseIdleBreathingSubtree,
    resolveIdleBreathingAmplitude,
} from './idleBreathing';
import {
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneTimeUniform,
} from './SceneTime';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
/**
 * A breathing entity looks for meshes and materials that changed (a model
 * that finished loading, a swapped material) every this many rendered
 * frames, not on every frame. Until then a new mesh simply holds its rest
 * pose.
 */
const idleBreathingRebindFrames = 30;

function subscribeReducedMotion(listener: () => void) {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {};
    const media = window.matchMedia(reducedMotionQuery);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
}

function readReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia(reducedMotionQuery).matches
    );
}

/** Follows the system setting, including changes while the garden is open. */
export function usePrefersReducedMotion() {
    return useSyncExternalStore(
        subscribeReducedMotion,
        readReducedMotion,
        () => false,
    );
}

function useIdleBreathingAmplitude(role: IdleBreathingRole, enabled: boolean) {
    const fixedTime = useSceneFixedTimeSeconds();
    const reducedMotion = usePrefersReducedMotion();
    const snowLoaded = useGameState(
        (state) => state.snowCoverage > idleBreathingSnowThreshold,
    );
    return resolveIdleBreathingAmplitude({
        enabled: enabled && !snowLoaded,
        fixedTime: fixedTime !== undefined,
        reducedMotion,
        role,
    });
}

/**
 * Peak body stretch for an animal's idle breathing, or zero for reduced
 * motion and fixed-time captures. Animals keep breathing in snow. Pass it to
 * `idleBreathingScale` with `idleBreathingWave` on frames the animal already
 * renders.
 */
export function useAnimalIdleBreathingAmplitude() {
    const fixedTime = useSceneFixedTimeSeconds();
    const reducedMotion = usePrefersReducedMotion();
    return resolveIdleBreathingAmplitude({
        fixedTime: fixedTime !== undefined,
        reducedMotion,
        role: 'animal',
    });
}

function useIdleBreathingBatchUniforms(
    amplitude: number,
    pivotGeometry: BufferGeometry | undefined,
) {
    const time = useSceneTimeUniform();
    const requestRender = useSceneRenderRequest();
    const uniforms = useMemo(
        () =>
            createIdleBreathingUniforms(
                time,
                pivotGeometry && getIdleBreathingPivot(pivotGeometry),
            ),
        [pivotGeometry, time],
    );
    useLayoutEffect(() => {
        if (uniforms.grediceIdleBreathAmplitude.value === amplitude) return;
        uniforms.grediceIdleBreathAmplitude.value = amplitude;
        // Settle a batch that stops breathing (snow, reduced motion) at once.
        requestRender('idle-breathing-change');
    }, [amplitude, requestRender, uniforms]);
    return uniforms;
}

/**
 * Uniforms for one batch of breathing canopy materials. Every material bound
 * to the same uniforms (a canopy and its sprigs) shares pivot and phase, so
 * the parts stay together. `pivotGeometry` is the full canopy shape.
 */
export function useIdleBreathingUniforms(
    role: IdleBreathingRole,
    pivotGeometry: BufferGeometry,
    enabled = true,
) {
    return useIdleBreathingBatchUniforms(
        useIdleBreathingAmplitude(role, enabled),
        pivotGeometry,
    );
}

/**
 * The material an instanced batch of a living block draws with: a breathing
 * copy of the model material for the blocks listed in
 * `getIdleBreathingInstancedRole`, the model material itself otherwise.
 * While nothing breathes (reduced motion, captures, snow) the batch keeps the
 * model material, so it stays eligible for static packets and the static
 * scene cache.
 */
export function useIdleBreathingBlockMaterial(
    blockName: string,
    geometry: BufferGeometry,
    material: Material | Material[] | undefined,
) {
    const role = getIdleBreathingInstancedRole(blockName);
    const amplitude = useIdleBreathingAmplitude(
        role ?? 'flower',
        role !== undefined,
    );
    const uniforms = useIdleBreathingBatchUniforms(
        amplitude,
        role ? geometry : undefined,
    );
    const breathes = amplitude > 0;
    const breathingMaterial = useMemo(
        () =>
            breathes && material instanceof Material
                ? createIdleBreathingMaterial(material, uniforms)
                : null,
        [breathes, material, uniforms],
    );
    useEffect(() => () => breathingMaterial?.dispose(), [breathingMaterial]);
    return breathingMaterial ?? material;
}

/**
 * Breathes one living entity rendered as its own component, about the point
 * it stands on. The stretch runs in the vertex shader of every mesh below
 * this group (`bindIdleBreathingSubtree`), so only the drawn surface moves:
 * the event-refreshed shadow map and its lookups keep the rest pose, and the
 * plant never shadows itself. Weather overlays are custom shaders that do not
 * breathe, so a plant holds still while snow or rain wetness covers it, also
 * when the overlay is part of the entity itself (`hasIdleBreathingOverlay`).
 * With `parts`, only those meshes breathe, from the bottom of their bounds.
 */
export function IdleBreathingGroup({
    children,
    parts,
    pivot,
    role,
}: PropsWithChildren<{
    parts?: readonly string[];
    /** The ground point, in the parent group's space. */
    pivot: readonly [number, number, number];
    role: IdleBreathingRole;
}>) {
    const groupRef = useRef<Group>(null);
    const time = useSceneTimeUniform();
    const requestRender = useSceneRenderRequest();
    const rainWet = useRainWetOverlayVisible();
    const amplitude = useIdleBreathingAmplitude(role, !rainWet);
    const uniforms = useMemo(
        () => createIdleBreathingWorldUniforms(time),
        [time],
    );
    const bindingsRef = useRef<IdleBreathingSubtreeBindings>(new Map());
    const boundRef = useRef(new WeakSet<Material>());
    // Frames since the subtree was last bound; starts due, so the first
    // breathing frame binds at once.
    const framesSinceBindRef = useRef(idleBreathingRebindFrames);
    // The parts pivot in this group's space, from the rest geometry.
    const partsPivotRef = useRef<Vector3 | null>(null);
    // Whether a weather overlay was drawn on the entity at the last bind.
    const coveredRef = useRef(false);
    const [pivotX, pivotY, pivotZ] = pivot;

    useLayoutEffect(() => {
        const value = coveredRef.current ? 0 : amplitude;
        framesSinceBindRef.current = idleBreathingRebindFrames;
        if (uniforms.grediceIdleBreathAmplitude.value === value) return;
        uniforms.grediceIdleBreathAmplitude.value = value;
        // Settle a plant that stops breathing (snow, rain) at once.
        requestRender('idle-breathing-change');
    }, [amplitude, requestRender, uniforms]);

    useLayoutEffect(() => {
        const bindings = bindingsRef.current;
        const group = groupRef.current;
        return () => {
            releaseIdleBreathingSubtree(group, bindings);
            boundRef.current = new WeakSet();
        };
    }, []);

    useFrame(() => {
        const group = groupRef.current;
        if (!group || amplitude <= 0) return;
        const worldPivot = uniforms.grediceIdleBreathWorldPivot.value;
        if (framesSinceBindRef.current >= idleBreathingRebindFrames) {
            framesSinceBindRef.current = 0;
            coveredRef.current = hasIdleBreathingOverlay(group);
            const value = coveredRef.current ? 0 : amplitude;
            if (uniforms.grediceIdleBreathAmplitude.value !== value) {
                uniforms.grediceIdleBreathAmplitude.value = value;
                requestRender('idle-breathing-change');
            }
            bindIdleBreathingSubtree(
                group,
                uniforms,
                bindingsRef.current,
                boundRef.current,
                parts,
            );
            if (parts) {
                // Parts that have not loaded yet have nothing to breathe.
                const found = getIdleBreathingPartsPivot(
                    group,
                    parts,
                    worldPivot,
                );
                partsPivotRef.current = found
                    ? group.worldToLocal(
                          (partsPivotRef.current ?? new Vector3()).copy(found),
                      )
                    : null;
            }
        } else {
            framesSinceBindRef.current += 1;
        }
        // The group itself is never transformed, so a pivot in its own or
        // its parent's space maps to world space through its matrix, which
        // follows a bounce of the block.
        if (parts) {
            if (!partsPivotRef.current) return;
            worldPivot
                .copy(partsPivotRef.current)
                .applyMatrix4(group.matrixWorld);
        } else {
            worldPivot
                .set(pivotX, pivotY, pivotZ)
                .applyMatrix4(group.matrixWorld);
        }
    });

    return (
        <group ref={groupRef} name="Animation:IdleBreathing">
            {children}
        </group>
    );
}
