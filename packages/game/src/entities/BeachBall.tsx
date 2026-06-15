import { animated } from '@react-spring/three';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    advanceBeachBallBounce,
    beachBallCollisionRadius,
    createBeachBallBounceEnvironment,
    createBeachBallBounceState,
    getBeachBallSurfaceHeight,
} from './beachBallBounce';
import { HoverOutline } from './helpers/HoverOutline';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type BeachBallNodeName = Extract<
    keyof GLTFResult['nodes'],
    `BeachBall_${string}`
>;
type BeachBallNode = GLTFResult['nodes'][BeachBallNodeName];

const beachBallScale = 0.1565;
const beachBallKickSpeed = 2.85;
const beachBallKickSpeedVariance = 0.18;
const beachBallSpinFallbackAngle = Math.PI * 0.765;
const beachBallBounceFrequency = Math.PI * 5.8;
const beachBallGroundLift = 0.008;
const beachBallMaxBounceLift = 0.16;

const beachBallNodeNames = [
    'BeachBall_Cap',
    'BeachBall_ContactPatch',
    'BeachBall_PanelCoral01',
    'BeachBall_PanelCoral02',
    'BeachBall_PanelTeal01',
    'BeachBall_PanelTeal02',
    'BeachBall_PanelWhite01',
    'BeachBall_PanelWhite02',
    'BeachBall_PanelWhite03',
    'BeachBall_PanelYellow01',
] satisfies BeachBallNodeName[];

function BeachBallPart({ node }: { node: BeachBallNode }) {
    return (
        <mesh
            castShadow
            receiveShadow
            geometry={node.geometry}
            material={node.material}
            position={node.position}
            rotation={node.rotation}
            scale={node.scale}
        >
            <SnowOverlay
                geometry={node.geometry}
                maxThickness={0.012}
                slopeExponent={3.4}
                noiseScale={3.7}
                coverageMultiplier={0.26}
            />
            <RainWetOverlay
                geometry={node.geometry}
                topSurfaceBias={2.8}
                glossiness={0.66}
            />
        </mesh>
    );
}

function fallbackKickDirection(blockId: string, clickCount: number) {
    const angle =
        blockId.length * 0.53 + clickCount * beachBallSpinFallbackAngle;

    return {
        x: Math.cos(angle),
        z: Math.sin(angle),
    };
}

export function BeachBall({
    stack,
    block,
    stacks,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BeachBall');
    const { data: blockData } = useBlockData();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const position = stack.position
        .clone()
        .setY(currentStackHeight + beachBallGroundLift);
    const motionGroupRef = useRef<Group>(null);
    const bounceStateRef = useRef(createBeachBallBounceState());
    const clickCountRef = useRef(0);
    const [hovered, setHovered] = useState(false);
    const bounceEnvironment = useMemo(
        () =>
            createBeachBallBounceEnvironment({
                blockData,
                movingBlockId: block.id,
                stacks,
            }),
        [block.id, blockData, stacks],
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: reset visual offset when this rendered beach ball moves to another block cell.
    useEffect(() => {
        bounceStateRef.current = createBeachBallBounceState();

        const motionGroup = motionGroupRef.current;
        if (!motionGroup) {
            return;
        }

        motionGroup.position.set(0, 0, 0);
        motionGroup.rotation.set(0, 0, 0);
    }, [block.id, stack.position.x, stack.position.z]);

    useFrame((_, deltaSeconds) => {
        const motionGroup = motionGroupRef.current;
        if (!motionGroup) {
            return;
        }

        const currentState = bounceStateRef.current;

        const setMotionPosition = (state: typeof currentState, bounceY = 0) => {
            const surfaceHeight = getBeachBallSurfaceHeight(bounceEnvironment, {
                fallbackHeight: currentStackHeight,
                worldX: stack.position.x + state.offsetX,
                worldZ: stack.position.z + state.offsetZ,
            });

            motionGroup.position.set(
                state.offsetX,
                surfaceHeight - currentStackHeight + bounceY,
                state.offsetZ,
            );
        };

        if (!currentState.active) {
            setMotionPosition(currentState);
            return;
        }

        const previousOffsetX = currentState.offsetX;
        const previousOffsetZ = currentState.offsetZ;
        const nextState = advanceBeachBallBounce(
            currentState,
            bounceEnvironment,
            {
                baseX: stack.position.x,
                baseZ: stack.position.z,
                deltaSeconds,
            },
        );
        bounceStateRef.current = nextState;

        const speed = Math.hypot(nextState.velocityX, nextState.velocityZ);
        const bounceLift = Math.min(
            beachBallMaxBounceLift,
            0.032 + speed * 0.035,
        );
        const bounceY = nextState.active
            ? Math.abs(
                  Math.sin(nextState.elapsedSeconds * beachBallBounceFrequency),
              ) * bounceLift
            : 0;
        const movementX = nextState.offsetX - previousOffsetX;
        const movementZ = nextState.offsetZ - previousOffsetZ;

        setMotionPosition(nextState, bounceY);
        motionGroup.rotation.x += movementZ / beachBallCollisionRadius;
        motionGroup.rotation.z -= movementX / beachBallCollisionRadius;
    });

    function handlePointerDown(event: ThreeEvent<PointerEvent>) {
        if (event.button !== 0) {
            return;
        }

        event.stopPropagation();
    }

    function handleClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();
        clickCountRef.current += 1;

        const currentState = bounceStateRef.current;
        const centerX = stack.position.x + currentState.offsetX;
        const centerZ = stack.position.z + currentState.offsetZ;
        let directionX = centerX - event.point.x;
        let directionZ = centerZ - event.point.z;
        const directionLength = Math.hypot(directionX, directionZ);

        if (directionLength > 0.05) {
            directionX /= directionLength;
            directionZ /= directionLength;
        } else {
            const fallback = fallbackKickDirection(
                block.id,
                clickCountRef.current,
            );
            directionX = fallback.x;
            directionZ = fallback.z;
        }

        const speed =
            beachBallKickSpeed +
            (clickCountRef.current % 3) * beachBallKickSpeedVariance;

        bounceStateRef.current = {
            active: true,
            elapsedSeconds: 0,
            offsetX: currentState.offsetX,
            offsetZ: currentState.offsetZ,
            velocityX: directionX * speed + currentState.velocityX * 0.15,
            velocityZ: directionZ * speed + currentState.velocityZ * 0.15,
        };
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
            <animated.group
                position={position}
                rotation={
                    animatedRotation as unknown as [number, number, number]
                }
            >
                {/* biome-ignore lint/a11y/noStaticElementInteractions: Three.js group uses raycast picking for the clickable beach ball. */}
                <group
                    ref={motionGroupRef}
                    onClick={handleClick}
                    onPointerDown={handlePointerDown}
                    onPointerEnter={handlePointerEnter}
                    onPointerLeave={handlePointerLeave}
                >
                    <group scale={beachBallScale}>
                        {beachBallNodeNames.map((nodeName) => (
                            <BeachBallPart
                                key={nodeName}
                                node={nodes[nodeName]}
                            />
                        ))}
                    </group>
                </group>
            </animated.group>
        </HoverOutline>
    );
}
