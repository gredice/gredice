import { animated, useSpring } from '@react-spring/three';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import {
    useClaimSunflowerDrop,
    useSunflowerDrop,
} from '../hooks/useSunflowerDrop';
import {
    AnimateFlyToItem,
    useAnimateFlyToSunflowersHud,
} from '../indicators/AnimateFlyTo';
import { ParticleType, useParticles } from '../particles/ParticleSystem';
import type { Stack } from '../types/Stack';
import { useStackHeight } from '../utils/getStackHeight';
import { HoverOutline } from './helpers/HoverOutline';
import { SunflowerHeadModel } from './Sunflower';
import {
    findSunflowerDropPlacement,
    getSunflowerDropPosition,
    type SunflowerDropPlacement,
} from './sunflowerDropRewardCore';

type SunflowerDropGarden = {
    id: number;
    isSandbox: boolean;
    stacks: Stack[];
};

type SunflowerDropSpawn = {
    amount: number;
    expiresAt: string;
    gardenId: number;
    rewardDate: string;
    sourceBlockId: string;
    spawnId: string;
};

export type SunflowerDropFlyOrigin = { x: number; y: number };

const sunflowerDropLandingHeight = 0.9;
const sunflowerDropBounceLift = 0.04;
const sunflowerDropBounceSpeed = 2.1;
const sunflowerDropBounceScale = 0.025;
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
    return (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia(reducedMotionQuery).matches
    );
}

export function SunflowerDropFlyAnimation({
    onDone,
    origin,
}: {
    onDone: () => void;
    origin: SunflowerDropFlyOrigin;
}) {
    const { props, run } = useAnimateFlyToSunflowersHud({ duration: 850 });

    useEffect(() => {
        run();
        const timeout = window.setTimeout(onDone, 950);
        return () => window.clearTimeout(timeout);
    }, [onDone, run]);

    return (
        <div
            className="pointer-events-none fixed z-[1000]"
            style={{ left: origin.x, top: origin.y }}
        >
            <AnimateFlyToItem {...props}>
                <Image
                    src="https://cdn.gredice.com/sunflower-large.svg"
                    alt=""
                    aria-hidden
                    width={32}
                    height={32}
                    className="size-8"
                />
            </AnimateFlyToItem>
        </div>
    );
}

function SunflowerDropAtPlacement({
    onClaimed,
    onRejected,
    placement,
    spawn,
}: {
    onClaimed: (origin: SunflowerDropFlyOrigin) => void;
    onRejected: () => void;
    placement: SunflowerDropPlacement;
    spawn: SunflowerDropSpawn;
}) {
    const claimSunflowerDrop = useClaimSunflowerDrop();
    const { spawn: spawnParticles } = useParticles();
    const reduceMotion = useMemo(prefersReducedMotion, []);
    const rewardRef = useRef<Group>(null);
    const [hovered, setHovered] = useState(false);
    const [hasLanded, setHasLanded] = useState(reduceMotion);
    const stackHeight = useStackHeight(placement.stack, placement.block);
    const drop = useMemo(() => {
        return getSunflowerDropPosition({
            placement,
            spawnId: spawn.spawnId,
            stackHeight,
        });
    }, [placement, spawn.spawnId, stackHeight]);
    const [{ dropOffsetY }, landingApi] = useSpring(() => ({
        config: {
            mass: 0.15,
            tension: 170,
            friction: 13,
        },
        dropOffsetY: reduceMotion ? 0 : sunflowerDropLandingHeight,
    }));

    useEffect(() => {
        let active = true;
        setHasLanded(reduceMotion);

        if (reduceMotion) {
            landingApi.set({ dropOffsetY: 0 });
            return () => {
                active = false;
            };
        }

        landingApi.set({ dropOffsetY: sunflowerDropLandingHeight });
        void landingApi.start({
            dropOffsetY: 0,
            onRest: () => {
                if (active) {
                    setHasLanded(true);
                }
            },
        });

        return () => {
            active = false;
            landingApi.stop();
        };
    }, [landingApi, reduceMotion]);

    useFrame(({ clock }) => {
        const reward = rewardRef.current;
        if (!reward) {
            return;
        }

        if (reduceMotion || !hasLanded) {
            reward.position.y = 0;
            reward.scale.setScalar(1);
            return;
        }

        const bounce =
            ((Math.sin(
                clock.elapsedTime * sunflowerDropBounceSpeed + drop.phase,
            ) +
                1) /
                2) *
            sunflowerDropBounceLift;
        reward.position.y = bounce;
        reward.scale.setScalar(
            1 + (bounce / sunflowerDropBounceLift) * sunflowerDropBounceScale,
        );
    });

    function handleClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        if (claimSunflowerDrop.isPending) {
            return;
        }

        const origin = {
            x: event.nativeEvent.clientX,
            y: event.nativeEvent.clientY,
        };

        claimSunflowerDrop.mutate(spawn.spawnId, {
            onSuccess: () => {
                setHovered(false);
                spawnParticles(ParticleType.Leaf, drop.particlePosition, 8);
                onClaimed(origin);
            },
            onError: onRejected,
        });
    }

    function handlePointerEnter(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        setHovered(true);
    }

    function handlePointerLeave(event: ThreeEvent<PointerEvent>) {
        event.stopPropagation();
        setHovered(false);
    }

    return (
        <HoverOutline color="white" hovered={hovered} thickness={7}>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: Three.js group uses raycast picking for the collectible model. */}
            <group
                onClick={handleClick}
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
            >
                <animated.group position-y={dropOffsetY}>
                    <group
                        position={drop.position}
                        rotation={drop.rotation}
                        scale={0.34}
                    >
                        <group ref={rewardRef}>
                            <SunflowerHeadModel />
                        </group>
                    </group>
                </animated.group>
            </group>
        </HoverOutline>
    );
}

export function SunflowerDropReward({
    enabled,
    garden,
    onClaimed,
}: {
    enabled: boolean;
    garden: SunflowerDropGarden | null | undefined;
    onClaimed?: (origin: SunflowerDropFlyOrigin) => void;
}) {
    const [claimedSpawnId, setClaimedSpawnId] = useState<string | null>(null);
    const sunflowerDropEnabled =
        enabled && Boolean(garden) && !garden?.isSandbox;
    const sunflowerDrop = useSunflowerDrop(garden?.id, sunflowerDropEnabled);
    const spawn = sunflowerDrop.data?.spawn ?? null;

    useEffect(() => {
        if (claimedSpawnId && spawn?.spawnId !== claimedSpawnId) {
            setClaimedSpawnId(null);
        }
    }, [claimedSpawnId, spawn?.spawnId]);

    const placement =
        garden && spawn
            ? findSunflowerDropPlacement(garden.stacks, spawn.sourceBlockId)
            : null;

    return (
        <>
            {spawn && placement && claimedSpawnId !== spawn.spawnId && (
                <SunflowerDropAtPlacement
                    key={spawn.spawnId}
                    onRejected={() => {
                        void sunflowerDrop.refetch();
                    }}
                    placement={placement}
                    spawn={spawn}
                    onClaimed={(origin) => {
                        setClaimedSpawnId(spawn.spawnId);
                        onClaimed?.(origin);
                    }}
                />
            )}
        </>
    );
}
