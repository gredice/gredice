import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
    Color,
    DynamicDrawUsage,
    InstancedMesh,
    Object3D,
    PlaneGeometry,
    ShaderMaterial,
    Vector3,
} from 'three';
import { updateGameProfileMetadata } from '../gameProfileMetadata';
import type { GameQualityProfileTier } from '../gameQuality';
import {
    useSceneFixedTimeSeconds,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../SceneTime';
import { useBreathSources } from './BreathSources';
import { breathCaps, getBreathCycle } from './coldWeather';

const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(listener: () => void) {
    const query = window.matchMedia(motionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}
const readMotion = () => window.matchMedia(motionQuery).matches;
const serverMotion = () => false;

export function ColdBreath({
    strength,
    tier,
}: {
    strength: number;
    tier: GameQualityProfileTier;
}) {
    const sources = useBreathSources();
    const visible = useSceneRuntimeVisible();
    const reducedMotion = useSyncExternalStore(
        subscribeMotion,
        readMotion,
        serverMotion,
    );
    const fixedTime = useSceneFixedTimeSeconds();
    const time = useSceneTimeUniform();
    const capacity = breathCaps[tier];
    const selectedSources = useMemo(
        () => sources.slice(0, capacity),
        [sources, capacity],
    );
    const active =
        strength > 0 &&
        capacity > 0 &&
        visible &&
        !reducedMotion &&
        sources.length > 0;
    const mesh = useMemo(() => {
        const geometry = new PlaneGeometry(1, 1);
        const material = new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: { strength: { value: 0 } },
            vertexShader: `varying vec2 vUv; varying float vAlpha;
                void main() { vUv = uv; vAlpha = instanceColor.r;
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
            fragmentShader: `uniform float strength; varying vec2 vUv; varying float vAlpha;
                void main() { float soft = 1.0 - smoothstep(0.12, 0.5, length(vUv - 0.5));
                    gl_FragColor = vec4(vec3(0.88, 0.94, 1.0), soft * vAlpha * strength); }`,
        });
        const batch = new InstancedMesh(
            geometry,
            material,
            Math.max(1, capacity),
        );
        // Allocate instanceColor once; its red channel carries per-puff opacity.
        batch.setColorAt(0, new Color(0, 0, 0));
        batch.instanceMatrix.setUsage(DynamicDrawUsage);
        batch.name = 'Weather:ColdBreath';
        batch.count = 0;
        batch.frustumCulled = false;
        batch.raycast = () => undefined;
        return batch;
    }, [capacity]);
    const reportedCount = useRef(-1);
    const scratch = useMemo(
        () => ({ transform: new Object3D(), position: new Vector3() }),
        [],
    );
    useSceneTimeInvalidation('cold-breath', active && fixedTime === undefined);
    useEffect(() => {
        reportedCount.current = -1;
        updateGameProfileMetadata({
            coldBreathCapacity: active ? capacity : 0,
        });
        return () =>
            updateGameProfileMetadata({
                coldBreathCapacity: 0,
                coldBreathCount: 0,
            });
    }, [active, capacity]);
    useEffect(
        () => () => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            mesh.dispose();
        },
        [mesh],
    );
    useFrame(({ camera }) => {
        mesh.count = 0;
        if (active) {
            mesh.material.uniforms.strength.value = strength;
            for (const source of selectedSources) {
                if (mesh.count >= capacity) break;
                let shown = true;
                for (
                    let node: Object3D | null = source.head;
                    node;
                    node = node.parent
                ) {
                    if (!node.visible) {
                        shown = false;
                        break;
                    }
                }
                if (!shown || !source.head.parent) continue;
                const cycle = getBreathCycle(source.id, time.value);
                // Sample the live cloned rig; never touch cached GLTF nodes.
                source.head.updateWorldMatrix(true, false);
                scratch.position
                    .set(0, -0.1, -0.5 - cycle.progress * 0.35)
                    .applyMatrix4(source.head.matrixWorld);
                scratch.position.y += cycle.progress * 0.12;
                scratch.transform.position.copy(scratch.position);
                scratch.transform.quaternion.copy(camera.quaternion);
                scratch.transform.scale.setScalar(cycle.size);
                scratch.transform.updateMatrix();
                mesh.setMatrixAt(mesh.count, scratch.transform.matrix);
                mesh.instanceColor?.setX(mesh.count, cycle.opacity);
                mesh.count++;
            }
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
        if (reportedCount.current !== mesh.count) {
            reportedCount.current = mesh.count;
            updateGameProfileMetadata({ coldBreathCount: mesh.count });
        }
    });
    return <primitive object={mesh} visible={active} />;
}
