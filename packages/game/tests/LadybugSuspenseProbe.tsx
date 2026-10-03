import { useFrame } from '@react-three/fiber';
import { type RefObject, useLayoutEffect, useRef } from 'react';
import { InstancedMesh, Matrix4, Mesh } from 'three';
import { useFaunaFrame } from '../src/entities/animals/FaunaRuntimeProvider';
import {
    useSceneAfterRenderSubscription,
    useSceneTimeInvalidation,
} from '../src/scene/SceneTime';
import type { createGameState } from '../src/useGameState';
import type { LadybugSuspenseLifecycle } from './ladybugSuspenseWitness';

export function LadybugSuspenseProbe({
    output,
    store,
    lifecycle,
}: {
    output: RefObject<HTMLOutputElement | null>;
    store: ReturnType<typeof createGameState>;
    lifecycle: LadybugSuspenseLifecycle;
}) {
    // A real owned 60 Hz render lease exercises the intervening frames where
    // the unchanged 30 Hz fauna simulation does not take a fixed step.
    useSceneTimeInvalidation('test:ladybug-visibility-witness', true, 60);
    const subscribeAfterRender = useSceneAfterRenderSubscription();
    const simulationSteps = useRef(0);
    const previousSteps = useRef(0);
    const frames = useRef(0);
    const renderedMeshes = useRef(0);
    const hookedMeshes = useRef(new Set<Mesh>());
    const history = useRef<unknown[]>([]);
    const sample = useRef({});
    const matrix = useRef(new Matrix4());
    useFaunaFrame(() => {
        simulationSteps.current += 1;
    });
    useFrame(({ scene, clock }) => {
        frames.current += 1;
        renderedMeshes.current = 0;
        const witness = scene.getObjectByName('ladybug-suspense-witness');
        const actors = (witness?.children ?? [])
            .filter((child) => child.getObjectByName('Ladybug_BodyPivot'))
            .map((root, index) => {
                let meshes = 0;
                const materials = new Set<string>();
                root.traverse((object) => {
                    if (!(object instanceof Mesh)) return;
                    meshes += 1;
                    for (const material of Array.isArray(object.material)
                        ? object.material
                        : [object.material]) {
                        materials.add(material.uuid);
                    }
                    if (hookedMeshes.current.has(object)) return;
                    hookedMeshes.current.add(object);
                    const previous = object.onAfterRender;
                    object.onAfterRender = (...args) => {
                        previous.call(object, ...args);
                        renderedMeshes.current += 1;
                    };
                });
                return {
                    id: `ladybug-${index + 1}`,
                    uuid: root.uuid,
                    visible: root.visible,
                    meshes,
                    materials: materials.size,
                    position: root.position.toArray(),
                };
            });
        const shadows = scene.getObjectByName('ActorGroundingShadows');
        let visibleShadows = 0;
        if (shadows instanceof InstancedMesh) {
            for (let index = 0; index < shadows.count; index += 1) {
                shadows.getMatrixAt(index, matrix.current);
                if (matrix.current.elements[5] > 0) visibleShadows += 1;
            }
        }
        const steps = simulationSteps.current - previousSteps.current;
        previousSteps.current = simulationSteps.current;
        sample.current = {
            frame: frames.current,
            time: clock.elapsedTime,
            simulationSteps: simulationSteps.current,
            steps,
            boundary: { ...lifecycle },
            actors,
            visibleActors: actors.filter((actor) => actor.visible).length,
            visibleShadows,
            phases: store
                .getState()
                .faunaWorld.getDebugEntries()
                .map((entry) => ({
                    id: entry.id,
                    phase: entry.phase,
                    behavior: entry.behavior,
                })),
        };
    }, -5);
    useLayoutEffect(
        () =>
            subscribeAfterRender(() => {
                const frame = {
                    ...sample.current,
                    renderedMeshes: renderedMeshes.current,
                };
                history.current.push(frame);
                if (history.current.length > 600) history.current.shift();
                if (output.current) {
                    output.current.dataset.sample = JSON.stringify(frame);
                    output.current.dataset.history = JSON.stringify(
                        history.current,
                    );
                }
            }),
        [output, subscribeAfterRender],
    );
    return null;
}
