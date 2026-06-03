import { Image as DreiImage } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import {
    useClaimSunflowerDrop,
    useSunflowerDrop,
} from '../hooks/useSunflowerDrop';
import {
    AnimateFlyToItem,
    useAnimateFlyToSunflowersHud,
} from '../indicators/AnimateFlyTo';
import { ParticleType, useParticles } from '../particles/ParticleSystem';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { useStackHeight } from '../utils/getStackHeight';
import { SunflowerHeadModel } from './Sunflower';

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

type SunflowerDropPlacement = {
    block: Block;
    stack: Stack;
};

export type SunflowerDropFlyOrigin = { x: number; y: number };

function hashString(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) % 100_000;
    }
    return hash / 100_000;
}

function findSunflowerDropPlacement(
    stacks: Stack[],
    sourceBlockId: string,
): SunflowerDropPlacement | null {
    for (const stack of stacks) {
        const block = stack.blocks.find(
            (candidate) => candidate.id === sourceBlockId,
        );
        if (block) {
            return { block, stack };
        }
    }

    return null;
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
    const stackHeight = useStackHeight(placement.stack, placement.block);
    const drop = useMemo(() => {
        const hash = hashString(spawn.spawnId);
        const angle = hash * Math.PI * 2;
        const radius = 0.34 + hashString(`${spawn.spawnId}:radius`) * 0.14;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        return {
            particlePosition: new Vector3(
                placement.stack.position.x + x,
                stackHeight + 0.12,
                placement.stack.position.z + z,
            ),
            position: [
                placement.stack.position.x + x,
                stackHeight + 0.085,
                placement.stack.position.z + z,
            ] satisfies [number, number, number],
            rotation: [-Math.PI / 2, 0, angle + Math.PI * 0.15] satisfies [
                number,
                number,
                number,
            ],
        };
    }, [
        placement.stack.position.x,
        placement.stack.position.z,
        spawn.spawnId,
        stackHeight,
    ]);

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
                spawnParticles(ParticleType.Leaf, drop.particlePosition, 12);
                onClaimed(origin);
            },
            onError: onRejected,
        });
    }

    return (
        <group>
            <SunflowerHeadModel
                onClick={handleClick}
                position={drop.position}
                rotation={drop.rotation}
                scale={0.34}
            />
            <DreiImage
                url="https://cdn.gredice.com/sunflower-large.svg"
                transparent
                position={[
                    drop.position[0],
                    drop.position[1] + 0.18,
                    drop.position[2],
                ]}
                scale={0.18}
                raycast={() => null}
            />
        </group>
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
    const sunflowerDrop = useSunflowerDrop(
        garden?.id,
        enabled && Boolean(garden) && !garden?.isSandbox,
    );
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
