import { invalidate, useFrame, useStore, useThree } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { HoverOutline } from '../../../packages/game/src/entities/helpers/HoverOutline';
import { getSceneRootRuntime } from '../../../packages/game/src/scene/sceneRootRuntime';
import {
    animated,
    useSpring,
} from '../../../packages/game/src/scene/sceneSpring';
import { useSceneAfterFrame } from '../../../packages/game/src/scene/useSceneAfterFrame';
import type { SceneRootWitness } from './sceneRootIsolationState';

export function SceneRootIsolationProbe({
    id,
    goal = 0,
    pulse = false,
}: {
    id: 'a' | 'b';
    goal?: number;
    pulse?: boolean;
}) {
    const store = useStore();
    const gl = useThree((state) => state.gl);
    const counters = useRef({
        frames: 0,
        gpuPasses: 0,
        postFrames: 0,
        springAdvances: 0,
        springChanges: 0,
        springRests: 0,
        deltas: [] as number[],
    });
    const [{ x }, api] = useSpring(() => ({
        from: { x: 0 },
        to: pulse ? [{ x: 1 }, { x: 0 }] : undefined,
        loop: pulse,
        config: { duration: 1000 },
        onChange: () => {
            counters.current.springChanges += 1;
        },
        onRest: () => {
            counters.current.springRests += 1;
        },
    }));
    const { y } = useSpring({
        initial: { y: goal },
        y: goal,
        config: { duration: 1000 },
    });
    useFrame((_state, delta) => {
        counters.current.frames += 1;
        counters.current.deltas.push(delta);
    });
    useSceneAfterFrame(
        useCallback(() => {
            counters.current.postFrames += 1;
        }, []),
    );

    useLayoutEffect(() => {
        const render = gl.render;
        gl.render = (...args) => {
            counters.current.gpuPasses += 1;
            render.apply(gl, args);
        };
        const advance = x.advance;
        x.advance = (delta) => {
            counters.current.springAdvances += 1;
            advance.call(x, delta);
        };
        const witness: SceneRootWitness = {
            snapshot: () => ({
                ...counters.current,
                deltas: [...counters.current.deltas],
                value: x.get(),
                declarativeValue: y.get(),
            }),
            invalidate: () => store.getState().invalidate(),
            configure: () => {
                const state = store.getState();
                state.setSize(256, 256, 0, 0);
                state.setDpr(1);
                state.setFrameloop('demand');
                store.setState({
                    performance: { ...state.performance, current: 0.75 },
                });
            },
            animate: (loop = false) => {
                void api.start({
                    from: { x: 0 },
                    to: loop ? [{ x: 1 }, { x: 0 }] : { x: 1 },
                    loop,
                    reset: true,
                });
            },
            visible: () => getSceneRootRuntime(store).isVisible(),
        };
        window.sceneRootWitness ??= { invalidateAll: invalidate };
        window.sceneRootWitness[id] = witness;
        return () => {
            gl.render = render;
            x.advance = advance;
            delete window.sceneRootWitness?.[id];
        };
    }, [api, gl, id, store, x, y]);

    return (
        <HoverOutline hovered color="#ffffff" opacity={1} thickness={3}>
            <animated.mesh position-x={x} position-y={y}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#45ad69" />
            </animated.mesh>
        </HoverOutline>
    );
}
