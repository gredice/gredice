import { useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo } from 'react';
import type { Object3D } from 'three';
import { useGameState } from '../../useGameState';
import { configureFaunaActorCulling } from './faunaActorCulling';
import { acquireRigidFaunaBatches } from './rigidFaunaBatches';

/**
 * Enables conservative renderer culling for one actor model and returns a
 * per-frame check. Call it once per frame before pose work: it returns false
 * while the actor was not rendered, so pose updates can sleep while the
 * actor's behavior and movement keep advancing on absolute scene time.
 */
export function useFaunaActorCulling(
    root: Object3D,
    {
        rigidSource,
        rigidParents,
    }: {
        rigidSource?: Object3D;
        rigidParents?: readonly string[];
    } = {},
) {
    const faunaWorld = useGameState((state) => state.faunaWorld);
    const clock = useThree((state) => state.clock);
    const culling = useMemo(() => configureFaunaActorCulling(root), [root]);
    useLayoutEffect(() => {
        if (!rigidSource || !rigidParents) return;
        return acquireRigidFaunaBatches(
            root,
            rigidSource,
            rigidParents,
            culling.markRendered,
        ).release;
    }, [culling, rigidParents, rigidSource, root]);

    return useCallback(() => {
        const rendered = culling.consumeRendered();
        faunaWorld.recordActorPose(rendered, clock.elapsedTime);
        return rendered;
    }, [clock, culling, faunaWorld]);
}
