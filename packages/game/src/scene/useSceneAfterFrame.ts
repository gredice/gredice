import { addAfterEffect, useFrame, useStore } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { getSceneRootRuntime } from './sceneRootRuntime';

export function useSceneAfterFrame(callback: () => void, enabled = true) {
    const runtime = getSceneRootRuntime(useStore());
    const pending = useRef(false);
    useFrame(() => {
        pending.current = enabled;
    });
    useEffect(() => {
        if (!enabled) return;
        const afterFrame = () => {
            if (!pending.current) return;
            pending.current = false;
            callback();
        };
        const unsubscribe = runtime.subscribeAfterFrame(afterFrame);
        // Also supports standalone R3F consumers of HoverOutlineEffect. The
        // own-root useFrame gate is consumed once by either rendering path.
        const removeGlobalEffect = addAfterEffect(afterFrame);
        return () => {
            pending.current = false;
            unsubscribe();
            removeGlobalEffect();
        };
    }, [callback, enabled, runtime]);
}
