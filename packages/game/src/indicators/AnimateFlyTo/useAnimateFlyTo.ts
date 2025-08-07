import { useState, useCallback, useRef } from "react"
import { useSprings, config } from "@react-spring/web"

export type AnimationOptions = {
    duration?: number
    bounceScale?: number
    shrinkScale?: number
}

export function useAnimateFlyTo(targetX: number, targetY: number, options: AnimationOptions = {}) {
    const { duration = 800, bounceScale = 1.3, shrinkScale = 0.3 } = options

    const [animations, setAnimations] = useState<number[]>([]);
    const elementRef = useRef<HTMLDivElement | null>(null)

    const [springs, api] = useSprings(animations.length, () => {
        if (!elementRef.current) {
            console.warn("Element reference is not set for animation");
            return {
                from: { x: 0, y: 0, scale: 1, opacity: 1 },
                to: { x: 0, y: 0, scale: 1, opacity: 0 }
            };
        }

        const rect = elementRef.current.getBoundingClientRect();

        return {
            from: {
                x: rect.left,
                y: rect.top,
                scale: 1,
                opacity: 1
            },
            to: async (next) => {
                await next({
                    x: rect.left,
                    y: rect.top - 10,
                    scale: bounceScale,
                    config: { ...config.wobbly, duration: duration * 0.2 },
                });
                await next({
                    x: targetX,
                    y: targetY,
                    scale: 1,
                    config: { ...config.gentle, duration: duration * 0.7 },
                });
                await next({
                    scale: shrinkScale,
                    opacity: 0,
                    config: { ...config.slow, duration: duration * 0.1 },
                });
            },
        };
    });

    const run = useCallback(async () => {
        setAnimations(prev => [...prev, Date.now()]);
    }, []);

    const reset = useCallback(() => {
        api.stop()
        setAnimations([])
    }, [api])

    return {
        run,
        reset,
        isAnimating: animations.length > 0,
        props: {
            ref: elementRef,
            animations,
            springs,
        },
    }
}
