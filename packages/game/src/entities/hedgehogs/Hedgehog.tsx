import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AnimationMixer, type Group, Mesh } from 'three';
import {
    useSceneFixedTimeSeconds,
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
    useSceneTimeUniform,
} from '../../scene/SceneTime';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { useActorGroundingShadow } from '../animals/ActorGroundingShadows';
import type { HedgehogHabitat } from './hedgehogHabitat';
import { planHedgehogVisit, sampleHedgehogVisit } from './hedgehogVisit';

const noRaycast = () => {};
const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(listener: () => void) {
    const query = window.matchMedia(motionQuery);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
}
const getMotion = () => window.matchMedia(motionQuery).matches;

export function Hedgehog({
    habitat,
    sequence,
    lowQuality,
    onComplete,
}: {
    habitat: HedgehogHabitat;
    sequence: number;
    lowQuality: boolean;
    onComplete: () => void;
}) {
    const gltf = useGameGLTF('Hedgehog');
    const model = useMemo(() => {
        const root = gltf.scene.clone(true);
        root.traverse((node) => {
            if (node instanceof Mesh) {
                node.castShadow = false;
                node.receiveShadow = true;
                node.raycast = noRaycast;
            }
        });
        return root;
    }, [gltf.scene]);
    const mixer = useMemo(() => new AnimationMixer(model), [model]);
    const actions = useMemo(
        () =>
            new Map(
                gltf.animations.map((clip) => [
                    clip.name,
                    mixer.clipAction(clip),
                ]),
            ),
        [gltf.animations, mixer],
    );
    const route = useMemo(
        () => planHedgehogVisit(habitat, sequence),
        [habitat, sequence],
    );
    const group = useRef<Group>(null);
    const state = useRef<{
        elapsed: number;
        last: number | null;
        clip: string;
        complete: boolean;
        lastPoseAt: number;
    }>({
        elapsed: 0,
        last: null,
        clip: '',
        complete: false,
        lastPoseAt: -Infinity,
    });
    const time = useSceneTimeUniform();
    const fixed = useSceneFixedTimeSeconds();
    const visible = useSceneRuntimeVisible();
    const reducedMotion = useSyncExternalStore(
        subscribeMotion,
        getMotion,
        () => true,
    );
    const updateShadow = useActorGroundingShadow({
        id: `hedgehog:${habitat.id}`,
        species: 'hedgehog',
        primaryCasterCount: 0,
    });
    useSceneTimeInvalidation(
        'fauna:hedgehog',
        visible && fixed === undefined,
        lowQuality ? 15 : 24,
    );
    useEffect(() => {
        if (!visible) state.current.last = null;
    }, [visible]);
    useEffect(
        () => () => {
            mixer.stopAllAction();
            mixer.uncacheRoot(model);
        },
        [mixer, model],
    );
    useFrame(() => {
        const root = group.current;
        if (!root || state.current.complete) return;
        root.visible = visible;
        if (!visible) {
            state.current.last = null;
            return;
        }
        const now = time.value;
        if (fixed !== undefined) state.current.elapsed = fixed;
        else {
            if (state.current.last !== null)
                // The route is sampled analytically, so slow frames must not
                // extend the visit. Visibility changes reset last separately.
                state.current.elapsed += Math.max(0, now - state.current.last);
            state.current.last = now;
        }
        const sample = sampleHedgehogVisit(route, state.current.elapsed);
        if (sample.complete) {
            state.current.complete = true;
            root.visible = false;
            onComplete();
            return;
        }
        if (
            fixed === undefined &&
            now - state.current.lastPoseAt < 1 / (lowQuality ? 15 : 24)
        )
            return;
        state.current.lastPoseAt = now;
        root.position.copy(reducedMotion ? habitat.approach : sample.position);
        root.rotation.y = sample.yaw;
        const clip = reducedMotion ? 'HedgehogIdle' : sample.clip;
        if (state.current.clip !== clip) {
            mixer.stopAllAction();
            actions.get(clip)?.reset().play();
            state.current.clip = clip;
        }
        const action = actions.get(clip);
        if (action) {
            action.time = reducedMotion
                ? 0
                : sample.clipTime % action.getClip().duration;
            mixer.update(0);
        }
        root.userData.clip = clip;
        root.userData.elapsed = state.current.elapsed;
        root.userData.sequence = sequence;
        updateShadow?.({
            x: root.position.x,
            z: root.position.z,
            actorY: root.position.y,
            receiverY: root.position.y,
            yaw: root.rotation.y,
            visible,
        });
    });
    return (
        <group ref={group} name={`Hedgehog:${habitat.id}`} dispose={null}>
            <primitive object={model} />
        </group>
    );
}
