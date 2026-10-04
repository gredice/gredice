import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { areBlockInteractionsSuppressed } from './blockInteractionSuppression';
import { resolveInstancedDeferredSelectionClick } from './instancedBlockInteractionCore';

const defaultDelayMs = 340;

export function useDeferredSingleClick(
    callback: () => void,
    delayMs = defaultDelayMs,
) {
    const callbackRef = useRef(callback);
    const timeoutRef = useRef<number | null>(null);

    callbackRef.current = callback;

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();

        if (timeoutRef.current) {
            window.clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (event.nativeEvent.detail > 1 || areBlockInteractionsSuppressed()) {
            return;
        }

        timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            if (!areBlockInteractionsSuppressed()) {
                callbackRef.current();
            }
        }, delayMs);
    };
}

type DeferredSingleClickTargetLookup = {
    has: (targetKey: string) => boolean;
};

export function useDeferredSingleClickByTarget(
    callback: (targetKey: string) => void,
    validTargets: DeferredSingleClickTargetLookup,
    delayMs = defaultDelayMs,
) {
    const callbackRef = useRef(callback);
    const timeoutByTargetKeyRef = useRef(new Map<string, number>());
    const validTargetsRef = useRef(validTargets);

    callbackRef.current = callback;
    validTargetsRef.current = validTargets;

    useEffect(() => {
        const timeoutByTargetKey = timeoutByTargetKeyRef.current;
        for (const [targetKey, timeout] of timeoutByTargetKey) {
            if (validTargets.has(targetKey)) {
                continue;
            }

            window.clearTimeout(timeout);
            timeoutByTargetKey.delete(targetKey);
        }
    }, [validTargets]);

    useEffect(() => {
        const timeoutByTargetKey = timeoutByTargetKeyRef.current;
        return () => {
            for (const timeout of timeoutByTargetKey.values()) {
                window.clearTimeout(timeout);
            }
            timeoutByTargetKey.clear();
        };
    }, []);

    return (targetKey: string, event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();

        const timeoutByTargetKey = timeoutByTargetKeyRef.current;
        const suppressed = areBlockInteractionsSuppressed();
        const action = resolveInstancedDeferredSelectionClick({
            clickCount: event.nativeEvent.detail,
            pendingTargetKeys: new Set(timeoutByTargetKey.keys()),
            suppressed,
            targetKey,
        });

        if (action.cancelPendingTarget) {
            const timeout = timeoutByTargetKey.get(targetKey);
            if (timeout !== undefined) {
                window.clearTimeout(timeout);
            }
            timeoutByTargetKey.delete(targetKey);
        }

        if (!action.shouldSchedule) {
            return;
        }

        const timeout = window.setTimeout(() => {
            timeoutByTargetKey.delete(targetKey);
            if (
                !areBlockInteractionsSuppressed() &&
                validTargetsRef.current.has(targetKey)
            ) {
                callbackRef.current(targetKey);
            }
        }, delayMs);
        timeoutByTargetKey.set(targetKey, timeout);
    };
}
