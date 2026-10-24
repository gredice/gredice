import { useThree } from '@react-three/fiber';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import {
    AnimationClip,
    Group,
    InstancedMesh,
    Matrix4,
    NumberKeyframeTrack,
} from 'three';
import { useActorGroundingShadow } from '../src/entities/animals/ActorGroundingShadows';
import {
    useFaunaFrame,
    useFaunaRenderFrame,
    useFaunaWalkDistance,
} from '../src/entities/animals/FaunaRuntimeProvider';
import { useFaunaAnimations } from '../src/entities/animals/useFaunaAnimations';
import {
    useSceneRuntimeVisible,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';
import { useSceneAfterFrame } from '../src/scene/useSceneAfterFrame';

export function FaunaRuntimeProbe({
    id,
    onSample,
}: {
    id: string;
    onSample: (sample: string) => void;
}) {
    const actor = useRef<Group>(null);
    const scene = useThree((state) => state.scene);
    const visible = useSceneRuntimeVisible();
    const walkDistance = useFaunaWalkDistance();
    const model = useMemo(() => {
        const root = new Group();
        const bone = new Group();
        bone.name = 'bone';
        root.add(bone);
        const clips = [
            new AnimationClip('walk', 1, [
                new NumberKeyframeTrack('bone.rotation[y]', [0, 1], [0, 1]),
            ]),
        ];
        return { root, bone, clips };
    }, []);
    const { actions } = useFaunaAnimations(model.clips, model.root);
    useLayoutEffect(() => {
        actions.walk?.play();
    }, [actions]);
    useSceneTimeInvalidation(`fauna-order-${id}`, true, 60);
    const updateShadow = useActorGroundingShadow({
        id,
        species: 'cow',
        primaryCasterCount: 0,
    });
    const counters = useRef({
        frames: 0,
        steps: 0,
        mixerFailures: 0,
        poseFailures: 0,
        shadowFailures: 0,
        gaitFailures: 0,
        x: 0,
        maxDelta: 0,
    });
    const shadowMatrix = useMemo(() => new Matrix4(), []);
    useFaunaFrame((_, delta) => {
        if (!actor.current) return;
        actor.current.position.x += delta;
        walkDistance.set(actor.current.position.x);
        counters.current.steps += 1;
        counters.current.maxDelta = Math.max(counters.current.maxDelta, delta);
    }, actor);
    useFaunaRenderFrame(() => {
        const group = actor.current;
        if (!group) return;
        if (Math.abs(model.bone.rotation.y - (actions.walk?.time ?? 0)) > 1e-8)
            counters.current.mixerFailures += 1;
        model.bone.rotation.y = 2;
        const gait = walkDistance.get();
        if (Math.abs(gait - group.position.x) > 1e-8)
            counters.current.gaitFailures += 1;
        updateShadow?.({
            actorY: 0,
            receiverY: 0,
            visible: true,
            x: group.position.x,
            yaw: 0,
            z: 0,
        });
    });
    useSceneAfterFrame(
        useCallback(() => {
            const group = actor.current;
            if (!group) return;
            counters.current.frames += 1;
            counters.current.x = group.position.x;
            if (Math.abs(model.bone.rotation.y - 2) > 1e-8)
                counters.current.poseFailures += 1;
            const shadows = scene.getObjectByName('ActorGroundingShadows');
            if (shadows instanceof InstancedMesh && shadows.count > 0) {
                shadows.getMatrixAt(0, shadowMatrix);
                if (
                    Math.abs(shadowMatrix.elements[12] - group.position.x) >
                    1e-6
                )
                    counters.current.shadowFailures += 1;
            } else counters.current.shadowFailures += 1;
            onSample(JSON.stringify({ ...counters.current, visible }));
        }, [model, onSample, scene, shadowMatrix, visible]),
    );
    useEffect(() => {
        onSample(JSON.stringify({ ...counters.current, visible }));
    }, [onSample, visible]);
    return (
        <group ref={actor}>
            <primitive object={model.root} />
            <mesh>
                <boxGeometry args={[0.2, 0.2, 0.2]} />
                <meshBasicMaterial color="coral" />
            </mesh>
        </group>
    );
}
