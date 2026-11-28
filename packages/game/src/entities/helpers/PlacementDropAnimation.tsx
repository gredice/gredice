import {
    type PropsWithChildren,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
} from 'react';
import { type Group, Vector3 } from 'three';
import {
    resolveBlockParticleType,
    useParticles,
} from '../../particles/ParticleSystem';
import { IdleBreathingGroup } from '../../scene/IdleBreathingMotion';
import { getIdleBreathingEntity } from '../../scene/idleBreathing';
import type { Block } from '../../types/Block';
import {
    type BlockPlacementDropAnimation,
    getBlockPlacementDropAnimationByRenderId,
    getBlockPlacementDropAnimationForBlockId,
    useGameState,
} from '../../useGameState';
import {
    BounceTransformGroup,
    getBounceStartPose,
    playBounceMotion,
    useBounceSpring,
} from './BounceGroup';
import { type BouncePivot, bounceMotions } from './bounceMotion';
import { suppressPlacementShadowCasters } from './placementShadowCasters';

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
    const markVisualStarted = useGameState(
        (state) => state.markBlockPlacementDropVisualStarted,
    );
    const markVisualComplete = useGameState(
        (state) => state.markBlockPlacementDropVisualComplete,
    );
    const placementRootRef = useRef<Group | null>(null);
    // The render id is new for every bounce, so a block that stays mounted
    // replays each tap, pickup and landing; a per-block sequence restarts
    // once the previous entry clears.
    const startedRenderId = useRef<number | null>(null);
    const motion = bounceMotions[animation?.kind ?? 'drop'];
    // The block squashes toward the point it stands on, not the scene origin.
    const [positionX, positionY, positionZ] = position;
    const landing = useMemo(
        () => toVector3(particlePosition),
        [particlePosition],
    );
    const pivot = useMemo(
        (): BouncePivot => [
            landing.x - positionX,
            landing.y - positionY,
            landing.z - positionZ,
        ],
        [landing, positionX, positionY, positionZ],
    );
    const { driver, values } = useBounceSpring(
        pivot,
        animation && !prefersReducedMotion()
            ? getBounceStartPose(motion)
            : undefined,
    );
    // Living entities breathe about the same point they squash toward.
    const breathing = getIdleBreathingEntity(block.name);
    const animationRenderId = animation?.renderId;
    const visualStarted = animation?.visualStarted === true;

    useLayoutEffect(() => {
        if (animationRenderId !== undefined && !visualStarted) {
            markVisualStarted(animationRenderId);
        }
    }, [animationRenderId, markVisualStarted, visualStarted]);

    useLayoutEffect(() => {
        const root = placementRootRef.current;
        if (!visualStarted || animationRenderId === undefined || !root) {
            return;
        }

        return suppressPlacementShadowCasters(root);
    }, [animationRenderId, visualStarted]);

    useEffect(() => {
        if (
            !animation?.visualStarted ||
            startedRenderId.current === animation.renderId
        ) {
            return;
        }

        const animationRenderId = animation.renderId;
        startedRenderId.current = animationRenderId;
        const spawnLandingParticles = () => {
            if (!markParticlesSpawned(animationRenderId)) {
                return;
            }

            spawn(
                resolveBlockParticleType(block.name),
                toVector3(particlePosition),
                8,
            );
        };
        const finish = () => {
            if (motion.particles) spawnLandingParticles();
            markVisualComplete(animationRenderId);
        };

        if (prefersReducedMotion()) {
            driver.set([0, 0]);
            finish();
            return;
        }

        const isCurrent = () => startedRenderId.current === animationRenderId;
        void playBounceMotion({
            driver,
            isCurrent,
            motion,
            onImpact: motion.particles ? spawnLandingParticles : undefined,
        }).then((completed) => {
            if (completed) markVisualComplete(animationRenderId);
        });
    }, [
        animation,
        block.name,
        driver,
        markVisualComplete,
        markParticlesSpawned,
        motion,
        particlePosition,
        spawn,
    ]);

    useEffect(
        () => () => {
            // Stops a sequence that is still awaiting a spring after unmount.
            startedRenderId.current = null;
        },
        [],
    );

    return (
        <group
            ref={placementRootRef}
            name={`Animation:PlacementDrop:${block.name}:${block.id}`}
            position={position}
        >
            <BounceTransformGroup
                name={`Animation:PlacementDropOffset:${block.name}:${block.id}`}
                values={values}
            >
                {breathing ? (
                    <IdleBreathingGroup
                        parts={breathing.parts}
                        pivot={pivot}
                        role={breathing.role}
                    >
                        {children}
                    </IdleBreathingGroup>
                ) : (
                    children
                )}
            </BounceTransformGroup>
        </group>
    );
}

export function QueuedPlacementDropAnimation({
    animationRenderId,
    block,
    children,
    particlePosition,
    position,
}: PropsWithChildren<{
    animationRenderId?: number;
    block: Block;
    particlePosition: Vector3 | [number, number, number];
    position?: [number, number, number];
}>) {
    const animation = useGameState((state) =>
        animationRenderId === undefined
            ? getBlockPlacementDropAnimationForBlockId(
                  state.blockPlacementDropAnimations,
                  block.id,
              )
            : getBlockPlacementDropAnimationByRenderId(
                  state.blockPlacementDropAnimations,
                  animationRenderId,
              ),
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
