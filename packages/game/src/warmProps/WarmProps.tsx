import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Frustum, Matrix4, Object3D, Plane, Ray, Vector3 } from 'three';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
import type { GameQualityProfileTier } from '../scene/gameQuality';
import {
    useSceneFixedTimeSeconds,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../scene/SceneTime';
import { useGameState } from '../useGameState';
import { useWarmPropSources } from './WarmPropSources';
import { createWarmPropMeshes } from './warmPropMeshes';
import {
    resolveWarmPropPolicy,
    warmPropCaps,
    warmPropCrackleGain,
    warmPropFlicker,
    warmPropPhase,
} from './warmPropState';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
function subscribeReducedMotion(listener: () => void) {
    const query = window.matchMedia(reducedMotionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}
function getReducedMotion() {
    return window.matchMedia(reducedMotionQuery).matches;
}

export function WarmProps({
    tier,
    enabled = true,
    soundEnabled = true,
    rain = 0,
    snow = 0,
    windSpeed = 0,
    windDirection = 0,
}: {
    tier: GameQualityProfileTier;
    enabled?: boolean;
    soundEnabled?: boolean;
    rain?: number;
    snow?: number;
    windSpeed?: number;
    windDirection?: number;
}) {
    const sources = useWarmPropSources();
    const ranked = useMemo(
        () =>
            sources
                .map((source) => ({
                    ...source,
                    phase: warmPropPhase(source.id),
                    fire: source.anchors.find((anchor) => anchor.id === 'fire'),
                    smoke: source.anchors.find(
                        (anchor) => anchor.id === 'smoke',
                    ),
                    sound: source.anchors.find(
                        (anchor) => anchor.id === 'sound',
                    ),
                }))
                .sort((a, b) => a.phase - b.phase || a.id.localeCompare(b.id)),
        [sources],
    );
    const visible = useSceneRuntimeVisible();
    const snowCoverage = useGameState((state) => state.snowCoverage);
    const fixedTime = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const reducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotion,
        () => false,
    );
    const policy = resolveWarmPropPolicy({
        tier,
        enabled,
        visible,
        reducedMotion,
        rain,
        snow: Math.max(snow, snowCoverage),
    });
    const meshes = useMemo(
        () => createWarmPropMeshes(warmPropCaps[tier]),
        [tier],
    );
    const scratch = useMemo(
        () => ({
            transform: new Object3D(),
            position: new Vector3(),
            listener: new Vector3(),
            worldScale: new Vector3(),
            ray: new Ray(),
            ground: new Plane(new Vector3(0, 1, 0), 0),
            frustum: new Frustum(),
            viewProjection: new Matrix4(),
        }),
        [],
    );
    const audio = useGameState((state) => state.audio);
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    const audioState = useSyncExternalStore(
        audio.subscribe,
        audio.getState,
        audio.getState,
    );
    const loop = audio.ambient.useMusic(
        `${appBaseUrl}/assets/sounds/warm-prop-crackle-v1.wav`,
        { volume: 0, silentFailure: true },
    );
    const audible =
        soundEnabled &&
        policy.capacity > 0 &&
        !audioState.isBackgrounded &&
        !audioState.master.isMuted &&
        !audioState.ambient.isMuted &&
        audioState.master.volume > 0 &&
        audioState.ambient.volume > 0;
    const previousGain = useRef(-1);
    useSceneTimeInvalidation(
        'warm-props',
        sources.length > 0 && policy.animate && fixedTime === undefined,
    );
    useEffect(() => {
        if (!audible) {
            loop.stop();
            previousGain.current = -1;
            updateGameProfileMetadata({ warmPropCrackleGain: 0 });
        }
    }, [audible, loop.stop]);
    useEffect(() => () => meshes.dispose(), [meshes]);
    useEffect(() => {
        if (policy.capacity > 0) return;
        meshes.fire.count = 0;
        meshes.smoke.count = 0;
        for (const source of sources)
            if (source.embers?.current)
                source.embers.current.emissiveIntensity = 0;
        updateGameProfileMetadata({ warmPropCount: 0, warmPropSmokeCount: 0 });
    }, [policy.capacity, meshes, sources]);
    useEffect(
        () => () => {
            loop.stop();
            previousGain.current = -1;
            for (const source of sources)
                if (source.embers?.current)
                    source.embers.current.emissiveIntensity = 0;
            updateGameProfileMetadata({
                warmPropCount: 0,
                warmPropSmokeCount: 0,
                warmPropCapacity: 0,
                warmPropCrackleGain: 0,
            });
        },
        [sources, loop.stop],
    );

    useFrame(({ camera }) => {
        const {
            transform,
            position,
            listener,
            worldScale,
            ray,
            ground,
            frustum,
            viewProjection,
        } = scratch;
        frustum.setFromProjectionMatrix(
            viewProjection.multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse,
            ),
        );
        camera.getWorldPosition(ray.origin);
        camera.getWorldDirection(ray.direction);
        // The orthographic camera sits far from the garden. Listen at its ground
        // focus, so panning away fades the loop without depending on camera rig distance.
        const hasListener = ray.intersectPlane(ground, listener) !== null;
        let count = 0;
        let fireCount = 0;
        let smokeCount = 0;
        let gain = 0;
        const smokeOpacity = meshes.smoke.geometry.getAttribute('smokeOpacity');
        for (const source of ranked) {
            if (source.embers?.current)
                source.embers.current.emissiveIntensity = 0;
            if (count >= policy.capacity || !source.fire) continue;
            let shown = true;
            for (
                let node: Object3D | null = source.object;
                node;
                node = node.parent
            )
                if (!node.visible) shown = false;
            if (!shown) continue;
            source.object.updateWorldMatrix(true, false);
            position
                .set(...source.fire.position)
                .applyMatrix4(source.object.matrixWorld);
            if (!frustum.containsPoint(position)) continue;
            count++;
            source.object.getWorldScale(worldScale);
            const seconds = policy.animate ? time.value : 0;
            const flicker = warmPropFlicker(seconds, source.phase);
            if (source.embers?.current)
                source.embers.current.emissiveIntensity = flicker * 1.4;
            for (let index = 0; index < 3; index++) {
                const angle =
                    source.phase * Math.PI * 2 + (index * Math.PI * 2) / 3;
                transform.position.set(
                    source.fire.position[0] +
                        Math.cos(angle) * source.fire.radius * 0.32,
                    source.fire.position[1],
                    source.fire.position[2] +
                        Math.sin(angle) * source.fire.radius * 0.32,
                );
                transform.rotation.set(0, angle, 0);
                // Closed cart firebox: keep every vertex below the pan, never
                // draw through the door just to make hidden flames visible.
                transform.scale.set(
                    1,
                    source.kind === 'cart' ? 0.3 : flicker,
                    1,
                );
                transform.updateMatrix();
                transform.matrix.premultiply(source.object.matrixWorld);
                meshes.fire.setMatrixAt(fireCount++, transform.matrix);
            }
            if (source.smoke)
                for (let index = 0; index < policy.smokePerSource; index++) {
                    const age =
                        (seconds / 2.8 +
                            source.phase +
                            index / policy.smokePerSource) %
                        1;
                    const drift =
                        Math.min(3, Math.max(0, windSpeed)) * 0.02 * age;
                    const windAngle = (windDirection * Math.PI) / 180;
                    transform.position
                        .set(
                            source.smoke.position[0] +
                                Math.sin(windAngle) * drift,
                            source.smoke.position[1] + age * 0.38,
                            source.smoke.position[2] +
                                Math.cos(windAngle) * drift,
                        )
                        .applyMatrix4(source.object.matrixWorld);
                    transform.quaternion.copy(camera.quaternion);
                    transform.scale.setScalar(
                        source.smoke.radius *
                            (0.5 + age * 0.8) *
                            Math.max(
                                Math.abs(worldScale.x),
                                Math.abs(worldScale.y),
                                Math.abs(worldScale.z),
                            ),
                    );
                    transform.updateMatrix();
                    meshes.smoke.setMatrixAt(smokeCount, transform.matrix);
                    smokeOpacity.setX(
                        smokeCount++,
                        Math.sin(age * Math.PI) * 0.13,
                    );
                }
            if (audible && hasListener && source.sound) {
                position
                    .set(...source.sound.position)
                    .applyMatrix4(source.object.matrixWorld);
                gain = Math.max(
                    gain,
                    warmPropCrackleGain(position.distanceTo(listener)),
                );
            }
        }
        meshes.fire.count = fireCount;
        meshes.smoke.count = smokeCount;
        meshes.fire.instanceMatrix.needsUpdate = true;
        meshes.smoke.instanceMatrix.needsUpdate = true;
        smokeOpacity.needsUpdate = true;
        if (audible && Math.abs(gain - previousGain.current) > 0.0001) {
            loop.setTargetVolume(gain, 0.3);
            previousGain.current = gain;
        }
        updateGameProfileMetadata({
            warmPropCount: count,
            warmPropSmokeCount: smokeCount,
            warmPropCapacity: warmPropCaps[tier],
            warmPropCrackleGain: gain,
        });
    });
    return (
        <>
            <primitive object={meshes.fire} visible={policy.capacity > 0} />
            <primitive
                object={meshes.smoke}
                visible={policy.smokePerSource > 0}
            />
        </>
    );
}
