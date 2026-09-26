import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
    DynamicDrawUsage,
    Frustum,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    Object3D,
    PlaneGeometry,
    Quaternion,
    ShaderMaterial,
    Sphere,
    Vector3,
} from 'three';
import { useGameState } from '../useGameState';
import { updateGameProfileMetadata } from './gameProfileMetadata';
import type { GameQualityProfileTier } from './gameQuality';
import {
    useSceneFixedTimeSeconds,
    useSceneRenderRequest,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from './SceneTime';
import { useSteamSources } from './SteamSources';
import {
    createSteamParticle,
    resolveSteamStrength,
    sampleSteamParticle,
    steamEmitterCaps,
    steamParticlesPerEmitter,
} from './steamMotion';

const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(listener: () => void) {
    const query = window.matchMedia(motionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}

export function LocalizedSteam({
    tier,
    enabled,
    windSpeed = 0,
    windDirection = 0,
    rain = 0,
    snow = 0,
}: {
    tier: GameQualityProfileTier;
    enabled: boolean;
    windSpeed?: number;
    windDirection?: number;
    rain?: number;
    snow?: number;
}) {
    const { sources } = useSteamSources();
    const reducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        () => window.matchMedia(motionQuery).matches,
        () => false,
    );
    const snowCoverage = useGameState((state) => state.snowCoverage);
    const visible = useSceneRuntimeVisible();
    const fixedTime = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const requestRender = useSceneRenderRequest();
    const capacity = steamEmitterCaps[tier] * steamParticlesPerEmitter;
    const strength = resolveSteamStrength({
        enabled,
        reducedMotion,
        rain,
        snow: Math.max(snow, snowCoverage),
    });
    // The sorted registry admits a stable prefix, bounding both sampling and GPU work.
    const descriptors = useMemo(
        () =>
            sources.slice(0, steamEmitterCaps[tier]).map((source) => ({
                source,
                particles: Array.from(
                    { length: steamParticlesPerEmitter },
                    (_, index) => createSteamParticle(source.id, index),
                ),
            })),
        [sources, tier],
    );
    const mesh = useMemo(() => {
        const geometry = new PlaneGeometry(1, 1);
        geometry.setAttribute(
            'steamOpacity',
            new InstancedBufferAttribute(
                new Float32Array(Math.max(1, capacity)),
                1,
            ).setUsage(DynamicDrawUsage),
        );
        const material = new ShaderMaterial({
            transparent: true,
            depthTest: true,
            depthWrite: false,
            toneMapped: false,
            vertexShader: `
                attribute float steamOpacity;
                varying vec2 vUv;
                varying float vOpacity;
                void main() {
                    vUv = uv;
                    vOpacity = steamOpacity;
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                varying float vOpacity;
                void main() {
                    float radius = length((vUv - 0.5) * 2.0);
                    float alpha = (1.0 - smoothstep(0.0, 1.0, radius)) * vOpacity;
                    if (alpha < 0.002) discard;
                    gl_FragColor = vec4(0.94, 0.95, 0.92, alpha);
                    #include <colorspace_fragment>
                }
            `,
        });
        const value = new InstancedMesh(
            geometry,
            material,
            Math.max(1, capacity),
        );
        value.name = 'Weather:LocalizedSteam';
        value.count = 0;
        value.frustumCulled = false;
        value.instanceMatrix.setUsage(DynamicDrawUsage);
        value.raycast = () => {};
        return value;
    }, [capacity]);
    const scratch = useMemo(
        () => ({
            transform: new Object3D(),
            frustum: new Frustum(),
            projection: new Matrix4(),
            inverse: new Matrix4(),
            orientation: new Quaternion(),
            origin: new Vector3(),
            sphere: new Sphere(new Vector3(), 0.4),
        }),
        [],
    );
    const [inView, setInView] = useState(false);
    useSceneTimeInvalidation(
        'localized-steam',
        visible && strength > 0 && inView && fixedTime === undefined,
    );
    // Input/visibility changes need a single frame even when the animation lease is off.
    // biome-ignore lint/correctness/useExhaustiveDependencies: These inputs deliberately invalidate the scene.
    useEffect(() => {
        requestRender('localized-steam-change');
    }, [
        descriptors,
        fixedTime,
        requestRender,
        strength,
        visible,
        windDirection,
        windSpeed,
    ]);
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            mesh.dispose();
        },
        [mesh],
    );
    useEffect(() => {
        updateGameProfileMetadata({ steamParticleCapacity: capacity });
        return () =>
            updateGameProfileMetadata({
                steamParticleCapacity: 0,
                steamParticleCount: 0,
                steamEmitterCount: 0,
            });
    }, [capacity]);
    useFrame(({ camera }) => {
        let count = 0;
        let emitters = 0;
        if (visible && strength > 0) {
            scratch.frustum.setFromProjectionMatrix(
                scratch.projection.multiplyMatrices(
                    camera.projectionMatrix,
                    camera.matrixWorldInverse,
                ),
            );
            mesh.updateWorldMatrix(true, false);
            scratch.inverse.copy(mesh.matrixWorld).invert();
            camera.getWorldQuaternion(scratch.orientation);
            for (const { source, particles } of descriptors) {
                let ancestor: Object3D | null = source.object;
                while (ancestor?.visible) ancestor = ancestor.parent;
                if (ancestor) continue;
                source.object.getWorldPosition(scratch.origin);
                scratch.sphere.center.copy(scratch.origin);
                scratch.sphere.center.y += 0.15;
                if (!scratch.frustum.intersectsSphere(scratch.sphere)) continue;
                emitters++;
                for (const particle of particles) {
                    const sample = sampleSteamParticle(
                        particle,
                        time.value,
                        source.radius,
                        windSpeed,
                        windDirection,
                    );
                    scratch.transform.position
                        .set(sample.x, sample.y, sample.z)
                        // Rise and weather direction stay world-aligned as the prop rotates.
                        .add(scratch.origin);
                    scratch.transform.quaternion.copy(scratch.orientation);
                    scratch.transform.scale.setScalar(sample.size);
                    scratch.transform.updateMatrix();
                    scratch.transform.matrix.premultiply(scratch.inverse);
                    mesh.setMatrixAt(count, scratch.transform.matrix);
                    mesh.geometry
                        .getAttribute('steamOpacity')
                        .setX(count, sample.opacity * strength);
                    count++;
                }
            }
        }
        mesh.count = count;
        mesh.visible = count > 0;
        if (count > 0) {
            mesh.instanceMatrix.needsUpdate = true;
            mesh.geometry.getAttribute('steamOpacity').needsUpdate = true;
        }
        // Only visibility boundaries affect React; particle motion stays outside it.
        if (inView !== emitters > 0) setInView(emitters > 0);
        updateGameProfileMetadata({
            steamParticleCount: count,
            steamEmitterCount: emitters,
        });
    });
    return <primitive object={mesh} />;
}
