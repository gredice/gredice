import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { areBlockInteractionsSuppressed } from './blockInteractionSuppression';

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
