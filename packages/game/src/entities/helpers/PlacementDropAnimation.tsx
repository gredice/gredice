import { animated, useSpring } from '@react-spring/three';
import { type PropsWithChildren, useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import {
    resolveBlockParticleType,
    useParticles,
} from '../../particles/ParticleSystem';
import type { Block } from '../../types/Block';
import {
    type BlockPlacementDropAnimation,
    useGameState,
} from '../../useGameState';

const placementDropLift = 0.1;
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia(reducedMotionQuery).matches
    );
}

function toVector3(position: Vector3 | [number, number, number]) {
    return Array.isArray(position)
        ? new Vector3(position[0], position[1], position[2])
        : position.clone();
}

export function PlacementDropAnimation({
    animation,
    block,
    children,
    particlePosition,
    position = [0, 0, 0],
}: PropsWithChildren<{
    animation: BlockPlacementDropAnimation | null | undefined;
    block: Block;
    particlePosition: Vector3 | [number, number, number];
    position?: [number, number, number];
}>) {
    const { spawn } = useParticles();
    const markParticlesSpawned = useGameState(
        (state) => state.markBlockPlacementDropParticlesSpawned,
    );
    const completeAnimation = useGameState(
        (state) => state.completeBlockPlacementDropAnimation,
    );
    const startedSequence = useRef<number | null>(null);
    const [{ dropOffsetY }, api] = useSpring(() => ({
        dropOffsetY:
            animation && !prefersReducedMotion() ? placementDropLift : 0,
        config: {
            mass: 0.1,
            tension: 200,
            friction: 10,
        },
    }));

    useEffect(() => {
        if (!animation || startedSequence.current === animation.sequence) {
            return;
        }

        startedSequence.current = animation.sequence;
        const spawnLandingParticles = () => {
            if (!markParticlesSpawned(block.id)) {
                return;
            }

            spawn(
                resolveBlockParticleType(block.name),
                toVector3(particlePosition),
                8,
            );
        };
        const finish = () => {
            spawnLandingParticles();
            completeAnimation(block.id);
        };

        if (prefersReducedMotion()) {
            api.set({ dropOffsetY: 0 });
            finish();
            return;
        }

        api.set({ dropOffsetY: placementDropLift });
        void api.start({
            dropOffsetY: 0,
            onRest: finish,
        });
    }, [
        animation,
        api,
        block.id,
        block.name,
        completeAnimation,
        markParticlesSpawned,
        particlePosition,
        spawn,
    ]);

    return (
        <group
            name={`Animation:PlacementDrop:${block.name}:${block.id}`}
            position={position}
        >
            <animated.group
                name={`Animation:PlacementDropOffset:${block.name}:${block.id}`}
                position-y={dropOffsetY}
            >
                {children}
            </animated.group>
        </group>
    );
}

export function QueuedPlacementDropAnimation({
    block,
    children,
    particlePosition,
    position,
}: PropsWithChildren<{
    block: Block;
    particlePosition: Vector3 | [number, number, number];
    position?: [number, number, number];
}>) {
    const animation = useGameState(
        (state) => state.blockPlacementDropAnimations[block.id] ?? null,
    );

    return (
        <PlacementDropAnimation
            animation={animation}
            block={block}
            particlePosition={particlePosition}
            position={position}
        >
            {children}
        </PlacementDropAnimation>
    );
}
