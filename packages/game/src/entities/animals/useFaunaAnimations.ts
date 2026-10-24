import { useLayoutEffect, useMemo, useRef } from 'react';
import type { AnimationAction, AnimationClip, Object3D } from 'three';
import {
    type ActorAnimationRig,
    createActorAnimationRig,
} from './actorAnimationRig';
import { useFaunaAnimationFrame } from './FaunaRuntimeProvider';

/** Retained clip actions with the same `actions[name]` access used by Drei. */
export function useFaunaAnimations(
    clips: readonly AnimationClip[],
    root: Object3D,
) {
    const rig = useRef<ActorAnimationRig | null>(null);
    const lazyActions = useRef(new Map<string, AnimationAction>());
    const actions = useMemo(() => {
        const result: Record<string, AnimationAction | null> = {};
        for (const clip of clips) {
            Object.defineProperty(result, clip.name, {
                enumerable: true,
                get: () => {
                    const current = rig.current;
                    if (!current || current.mixer.getRoot() !== root)
                        return null;
                    const existing = lazyActions.current.get(clip.name);
                    if (existing) return existing;
                    const action = current.mixer.clipAction(clip);
                    lazyActions.current.set(clip.name, action);
                    return action;
                },
            });
        }
        return result;
    }, [clips, root]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: clip replacements require fresh bindings; disposed actions cannot replay.
    useLayoutEffect(() => {
        // Preserve Drei's lazy binding allocation: only requested clips own
        // actions. Disposing/replaying a mount creates fresh bindings.
        const current = createActorAnimationRig(root, []);
        rig.current = current;
        return () => {
            rig.current = null;
            lazyActions.current.clear();
            current.dispose();
        };
    }, [clips, root]);
    useFaunaAnimationFrame((_, delta) => rig.current?.mixer.update(delta));
    return { actions, clips, names: clips.map((clip) => clip.name) };
}
