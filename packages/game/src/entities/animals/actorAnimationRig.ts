import {
    type AnimationAction,
    type AnimationClip,
    AnimationMixer,
    type Object3D,
} from 'three';

export type ActorAnimationRig = {
    mixer: AnimationMixer;
    actions: ReadonlyMap<string, AnimationAction>;
    dispose: () => void;
};

/**
 * Creates a mixer and its clip actions as one disposable unit. After `dispose`
 * the actions must be dropped with the mixer: `uncacheRoot` leaves their
 * bindings with stale cache indices, so replaying them throws inside
 * `AnimationMixer`.
 */
export function createActorAnimationRig(
    root: Object3D,
    clips: readonly AnimationClip[],
): ActorAnimationRig {
    const mixer = new AnimationMixer(root);
    const actions = new Map(
        clips.map((clip) => [clip.name, mixer.clipAction(clip)]),
    );

    return {
        mixer,
        actions,
        dispose: () => {
            mixer.stopAllAction();
            mixer.uncacheRoot(root);
        },
    };
}
