import { useStore } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { type Object3D, Quaternion, Vector3 } from 'three';
import {
    useScenePostRenderFlush,
    useSceneRuntimeVisible,
} from '../src/scene/SceneTime';
import { useGameStateStore } from '../src/useGameState';
import {
    type FaunaTrajectoryActor,
    type FaunaTrajectoryFrame,
    type FaunaTrajectoryScenario,
    type FaunaTrajectoryWitness,
    faunaTrajectorySpecies,
} from './faunaTrajectoryState';

function isPrimitive(object: Object3D) {
    const instance: unknown = Reflect.get(object, '__r3f');
    return (
        typeof instance === 'object' &&
        instance !== null &&
        Reflect.get(instance, 'type') === 'primitive'
    );
}

/** Observation is outside actor callbacks and does not replace any species logic. */
export function FaunaTrajectoryDriver({
    assetsReady,
    scenario,
}: {
    assetsReady: boolean;
    scenario: FaunaTrajectoryScenario;
}) {
    const root = useStore();
    const store = useGameStateStore();
    const visible = useSceneRuntimeVisible();
    const flushPostRender = useScenePostRenderFlush();
    const flags = useRef({ assetsReady, visible });
    flags.current = { assetsReady, visible };
    useLayoutEffect(() => {
        const originalAdvance = root.getState().advance;
        let manual = false;
        let frameIndex = -1;
        let automaticHiddenAdvances = 0;
        // Keep asset/React readiness independent of wall-clock RAF timing.
        // Semantic population timers still run through the production scheduler.
        const controlledAdvance: typeof originalAdvance = (...args) => {
            if (manual) originalAdvance(...args);
            else if (!flags.current.visible) automaticHiddenAdvances += 1;
        };
        root.setState({ advance: controlledAdvance });
        const identity = new WeakMap<Object3D, string>();
        const nextIdentity = new Map<string, number>();
        const worldPoint = new Vector3();
        const worldQuaternion = new Quaternion();
        const worldScale = new Vector3();
        function snapshot(): FaunaTrajectoryFrame {
            const state = root.getState();
            state.scene.updateMatrixWorld(true);
            const actors: FaunaTrajectoryActor[] = [];
            const counts: Record<string, number> = Object.fromEntries(
                faunaTrajectorySpecies.map((species) => [species, 0]),
            );
            state.scene.traverse((scope) => {
                if (!scope.name.startsWith('witness:')) return;
                const species = scope.name.slice('witness:'.length);
                if (!(species in counts)) return;
                scope.traverse((model) => {
                    if (!isPrimitive(model)) return;
                    // GLTF scene roots contain the named rig. Nested nut and
                    // effect models must never count as an additional animal.
                    let matchesSpecies = false;
                    model.traverse((node) => {
                        if (
                            node.name.startsWith(
                                `${species === 'Bird' ? 'BirdSmall' : species}_`,
                            )
                        )
                            matchesSpecies = true;
                    });
                    if (!matchesSpecies) return;
                    let id = identity.get(model);
                    if (!id) {
                        const index = nextIdentity.get(species) ?? 0;
                        nextIdentity.set(species, index + 1);
                        id = `${species}:${index}`;
                        identity.set(model, id);
                    }
                    const pose: FaunaTrajectoryActor['pose'] = [];
                    const hasVisualWrapper =
                        species === 'Dog' || species === 'Rabbit';
                    const visualWrapper = hasVisualWrapper
                        ? model.parent
                        : null;
                    if (visualWrapper)
                        pose.push({
                            name: '@visual',
                            position: visualWrapper.position.toArray(),
                            quaternion: visualWrapper.quaternion.toArray(),
                            scale: visualWrapper.scale.toArray(),
                        });
                    model.traverse((node) => {
                        if (
                            node === model ||
                            node.type === 'Bone' ||
                            node.name.includes('Pivot')
                        )
                            pose.push({
                                name: node === model ? '@model' : node.name,
                                position: node.position.toArray(),
                                quaternion: node.quaternion.toArray(),
                                scale: node.scale.toArray(),
                            });
                    });
                    let actorVisible = true;
                    for (
                        let parent: Object3D | null = model;
                        parent;
                        parent = parent.parent
                    )
                        actorVisible &&= parent.visible;
                    if (actorVisible) counts[species] += 1;
                    // Dog/Rabbit have an immutable visual yaw/scale wrapper;
                    // the actual actor ref is its parent. Record both layers.
                    const actorRoot =
                        (visualWrapper ? visualWrapper.parent : model.parent) ??
                        model;
                    actors.push({
                        id,
                        species,
                        visible: actorVisible,
                        position: actorRoot
                            .getWorldPosition(worldPoint)
                            .toArray(),
                        quaternion: actorRoot
                            .getWorldQuaternion(worldQuaternion)
                            .toArray(),
                        scale: actorRoot.getWorldScale(worldScale).toArray(),
                        pose,
                    });
                });
            });
            return {
                index: frameIndex,
                time: state.clock.elapsedTime,
                counts,
                actors: actors.sort((left, right) =>
                    left.id.localeCompare(right.id),
                ),
                // This is the actual mounted species' runtime output, including
                // selected targets, movement phases and navigation metadata.
                debug: structuredClone([
                    ...store.getState().faunaWorld.getDebugEntries(),
                ]),
                visible: flags.current.visible,
                submittedFrames: state.gl.info.render.frame,
            };
        }
        const expectedModels = {
            Cow: 2,
            Cat: 1,
            Dog: 1,
            Bird: 1,
            Frog: 1,
            Horse: 1,
            Rabbit: 1,
            Squirrel: 1,
            Chicken: 1,
            Goat: 1,
            Piglet: 1,
            Sheep: 2,
            Ladybug: 5,
            Butterfly: 0,
            Slug: 0,
            Bee: scenario === 'day' ? 1 : 0,
            Bat: scenario === 'night' ? 2 : 0,
        };
        const witness: FaunaTrajectoryWitness = {
            ready: () => {
                if (!flags.current.assetsReady || !flags.current.visible)
                    return false;
                const actors = snapshot().actors;
                return Object.entries(expectedModels).every(
                    ([species, count]) =>
                        actors.filter((actor) => actor.species === species)
                            .length === count,
                );
            },
            snapshot,
            step: (delta) => {
                if (!flags.current.visible) return snapshot();
                const state = root.getState();
                manual = true;
                try {
                    state.advance(state.clock.elapsedTime + delta, false);
                    flushPostRender(globalThis.performance.now());
                    frameIndex += 1;
                } finally {
                    manual = false;
                }
                return snapshot();
            },
            command: (command) =>
                store.getState().triggerAnimalDebugBehavior(command),
            automaticHiddenAdvances: () => automaticHiddenAdvances,
        };
        window.faunaTrajectoryWitness = witness;
        return () => {
            if (window.faunaTrajectoryWitness === witness)
                delete window.faunaTrajectoryWitness;
            root.setState({ advance: originalAdvance });
        };
    }, [flushPostRender, root, scenario, store]);
    return null;
}
