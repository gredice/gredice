import { addAfterEffect, useFrame, useStore } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { getSceneRootRuntime } from './sceneRootRuntime';

export function useSceneAfterFrame(callback: () => void, enabled = true) {
    const store = useStore();
    const runtime = getSceneRootRuntime(store);
    const pending = useRef<number | null>(null);
    // A positive-priority renderer may intentionally skip drawing. Running
    // useFrame alone is not proof that this root submitted a scene pass.
    useFrame(({ gl }) => {
        pending.current = enabled ? gl.info.render.frame : null;
    }, Number.NEGATIVE_INFINITY);
    useEffect(() => {
        if (!enabled) return;
        const afterFrame = () => {
            const beforeFrame = pending.current;
            pending.current = null;
            if (
                beforeFrame === null ||
                store.getState().gl.info.render.frame <= beforeFrame
            )
                return;
            callback();
        };
        const unsubscribe = runtime.subscribeAfterFrame(afterFrame);
        // Also supports standalone R3F consumers of HoverOutlineEffect. The
        // own-root useFrame gate is consumed once by either rendering path.
        const removeGlobalEffect = addAfterEffect(afterFrame);
        return () => {
            pending.current = null;
            unsubscribe();
            removeGlobalEffect();
        };
    }, [callback, enabled, runtime, store]);
}
