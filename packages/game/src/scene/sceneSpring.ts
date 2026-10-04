import { createHost } from '@react-spring/animated';
import {
    type Controller,
    Globals,
    type PickAnimated,
    type SpringRef,
    SpringValue,
    type SpringValues,
    type UseSpringProps,
    useSprings,
} from '@react-spring/core';
import { addFluidObserver, raf } from '@react-spring/shared';
import type { WithAnimated } from '@react-spring/three';
import { applyProps, useStore } from '@react-three/fiber';
import {
    type DependencyList,
    useContext,
    useLayoutEffect,
    useRef,
} from 'react';
import * as THREE from 'three';
import { SceneSpringAnimationContext } from './SceneSpringContext';
import { getSceneRootRuntime, type SceneRootRuntime } from './sceneRootRuntime';

// Importing the upstream Three adapter installs a global invalidator and frame
// effect. Reuse its host and types without importing those runtime side effects.
const primitives = ['primitive'].concat(
    Object.keys(THREE)
        .filter((key) => /^[A-Z]/.test(key))
        .map((key) => key[0]?.toLowerCase() + key.slice(1)),
);
export const animated = createHost(primitives, {
    applyAnimatedValues: applyProps,
}).animated as WithAnimated;

export class SceneSpringValue<T> extends SpringValue<T> {
    constructor(
        value: T,
        private readonly runtime: SceneRootRuntime,
        private readonly shouldAnimate: () => boolean,
    ) {
        super();
        this.set(value);
    }

    protected override _resume() {
        if (this.shouldAnimate() && !Globals.skipAnimation)
            this.runtime.startAnimation(this);
        else this.finish();
    }

    override advance(deltaMs: number) {
        // Flush animated host writes on the frame that owns this spring, before
        // submitting the scene. DOM springs retain their normal global RAF.
        raf.sync(() => super.advance(deltaMs));
    }
}

const controllers = new WeakSet<Controller>();
type SceneSpringProps = UseSpringProps &
    (
        | { from: Record<string, unknown>; initial?: Record<string, unknown> }
        | { initial: Record<string, unknown>; from?: Record<string, unknown> }
    );

export function useSpring<Props extends SceneSpringProps>(
    props: Props,
): SpringValues<PickAnimated<Omit<Props, 'initial'>>>;
export function useSpring<Props extends SceneSpringProps>(
    props: () => Props,
    deps?: DependencyList,
): [
    SpringValues<PickAnimated<Omit<Props, 'initial'>>>,
    SpringRef<PickAnimated<Omit<Props, 'initial'>>>,
];
export function useSpring(
    props: SceneSpringProps | (() => SceneSpringProps),
    deps?: DependencyList,
): unknown {
    const runtime = getSceneRootRuntime(useStore());
    const animate = useContext(SceneSpringAnimationContext);
    const animateRef = useRef(animate);
    animateRef.current = animate;
    const mounted = useRef(true);
    const imperative = typeof props === 'function';
    const [[values], api] = useSprings(
        1,
        (_index, controller) => {
            const { initial, ...update } =
                typeof props === 'function' ? props() : props;
            if (!controllers.has(controller)) {
                controllers.add(controller);
                const observe = controller.eventObserved.bind(controller);
                controller.eventObserved = (event) => {
                    if (!mounted.current) return;
                    runtime.queueAnimationEvent(() => {
                        if (mounted.current) raf.sync(() => observe(event));
                    });
                };
            }
            for (const [key, value] of Object.entries(
                initial ?? update.from ?? {},
            )) {
                if (!controller.springs[key]) {
                    const spring = new SceneSpringValue(
                        value,
                        runtime,
                        () => animateRef.current,
                    );
                    spring.key = key;
                    controller.springs[key] = spring;
                    addFluidObserver(spring, controller);
                }
            }
            return animate
                ? update
                : { ...update, loop: false, immediate: true };
        },
        imperative ? (deps ?? []) : [props],
    );
    useLayoutEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            for (const controller of api.current) {
                for (const spring of Object.values(controller.springs)) {
                    runtime.removeAnimation(spring);
                }
            }
        };
    }, [api, runtime]);
    return imperative ? [values, api] : values;
}
