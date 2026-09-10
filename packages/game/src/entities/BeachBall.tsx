import { animated } from '@react-spring/three';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { areBlockInteractionsSuppressed } from '../controls/blockInteractionSuppression';
import { useBlockData } from '../hooks/useBlockData';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import {
    useSceneRenderRequest,
    useSceneTimeInvalidation,
} from '../scene/SceneTime';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useActorGroundingShadow } from './animals/ActorGroundingShadows';
import {
    advanceBeachBallBounce,
    beachBallCollisionRadius,
    createBeachBallBounceEnvironment,
    createBeachBallBounceState,
    getBeachBallSurfaceHeight,
    startBeachBallBounce,
} from './beachBallBounce';
import { HoverOutline } from './helpers/HoverOutline';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type BeachBallNodeName = Extract<
    keyof GLTFResult['nodes'],
    `BeachBall_${string}`
>;
type BeachBallNode = GLTFResult['nodes'][BeachBallNodeName];

type BeachBallVisualBounce = {
    amplitude: number;
    durationSeconds: number;
    elapsedSeconds: number;
};

const beachBallScale = 0.1565;
const beachBallKickSpeed = 2.85;
const beachBallKickSpeedVariance = 0.18;
const beachBallSpinFallbackAngle = Math.PI * 0.765;
const beachBallBounceDurationSeconds = 0.58;
const beachBallGroundLift = 0.008;
const beachBallMinBounceLift = 0.026;
const beachBallMaxBounceLift = 0.16;
// The exported mesh spans Y=0.0025..2.0475. Roll around its scaled center
// instead of the ground-level model origin so rotation cannot bury the ball.
const beachBallVisualCenterY = 1.025 * beachBallScale;

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
            castShadow={false}
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

function createBeachBallVisualBounce(): BeachBallVisualBounce {
    return {
        amplitude: 0,
        durationSeconds: 0,
        elapsedSeconds: 0,
    };
}

function createBeachBallCollisionBounce(speed: number): BeachBallVisualBounce {
    return {
        amplitude: Math.min(
            beachBallMaxBounceLift,
            beachBallMinBounceLift + speed * 0.035,
        ),
        durationSeconds: beachBallBounceDurationSeconds,
        elapsedSeconds: 0,
    };
}

function isBeachBallVisualBounceActive(bounce: BeachBallVisualBounce) {
    return bounce.elapsedSeconds < bounce.durationSeconds;
}

function advanceBeachBallVisualBounce(
    bounce: BeachBallVisualBounce,
    deltaSeconds: number,
) {
    if (!isBeachBallVisualBounceActive(bounce)) {
        return 0;
    }

    bounce.elapsedSeconds = Math.min(
        bounce.durationSeconds,
        bounce.elapsedSeconds + deltaSeconds,
    );

    const progress = bounce.elapsedSeconds / bounce.durationSeconds;
    const decay = (1 - progress) ** 1.35;
    return Math.sin(progress * Math.PI) * bounce.amplitude * decay;
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
    const rollingGroupRef = useRef<Group>(null);
    const bounceStateRef = useRef(createBeachBallBounceState());
    const visualBounceRef = useRef(createBeachBallVisualBounce());
    const clickCountRef = useRef(0);
    const lastAvatarKickSequenceRef = useRef(0);
    const lastPresenceUpdateRef = useRef(Number.NEGATIVE_INFINITY);
    const motionActiveRef = useRef(false);
    const [hovered, setHovered] = useState(false);
    const [motionActive, setMotionActive] = useState(false);
    const avatarKickRequest = useGameState(
        (state) => state.gardenAvatarBeachBallKickRequest,
    );
    const setAnimalPresenceEntry = useGameState(
        (state) => state.setAnimalPresenceEntry,
    );
    const removeAnimalPresenceEntry = useGameState(
        (state) => state.removeAnimalPresenceEntry,
    );
    const requestRender = useSceneRenderRequest();
    useSceneTimeInvalidation('beach-ball-motion', motionActive);
    const activateMotion = useCallback(() => {
        motionActiveRef.current = true;
        setMotionActive(true);
        requestRender('beach-ball-motion-started', 2);
    }, [requestRender]);
    const updateGroundingShadow = useActorGroundingShadow({
        id: `beach-ball:${block.id}`,
        primaryCasterCount: 0,
        species: 'beachBall',
    });
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
        visualBounceRef.current = createBeachBallVisualBounce();
        motionActiveRef.current = false;
        setMotionActive(false);

        const motionGroup = motionGroupRef.current;
        const rollingGroup = rollingGroupRef.current;
        if (!motionGroup || !rollingGroup) {
            return;
        }

        motionGroup.position.set(0, 0, 0);
        rollingGroup.rotation.set(0, 0, 0);
    }, [block.id, stack.position.x, stack.position.z]);

    useEffect(() => {
        if (
            !avatarKickRequest ||
            avatarKickRequest.targetId !== block.id ||
            avatarKickRequest.sequence === lastAvatarKickSequenceRef.current
        ) {
            return;
        }

        lastAvatarKickSequenceRef.current = avatarKickRequest.sequence;
        bounceStateRef.current = startBeachBallBounce({
            direction: avatarKickRequest.direction,
            speed: beachBallKickSpeed,
            state: bounceStateRef.current,
        });
        activateMotion();
    }, [activateMotion, avatarKickRequest, block.id]);

    useEffect(
        () => () => removeAnimalPresenceEntry(`beach-ball:${block.id}`),
        [block.id, removeAnimalPresenceEntry],
    );

    useFrame(({ clock }, deltaSeconds) => {
        const motionGroup = motionGroupRef.current;
        const rollingGroup = rollingGroupRef.current;
        if (!motionGroup || !rollingGroup) {
            return;
        }

        const currentState = bounceStateRef.current;
        const visualBounce = visualBounceRef.current;

        if (clock.elapsedTime - lastPresenceUpdateRef.current >= 0.2) {
            lastPresenceUpdateRef.current = clock.elapsedTime;
            setAnimalPresenceEntry({
                behavior: currentState.active ? 'rolling' : 'idle',
                id: `beach-ball:${block.id}`,
                position: {
                    x: stack.position.x + currentState.offsetX,
                    y: position.y + motionGroup.position.y,
                    z: stack.position.z + currentState.offsetZ,
                },
                species: 'BeachBall',
                updatedAt: clock.elapsedTime,
            });
        }

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
            updateGroundingShadow?.({
                actorY: surfaceHeight + bounceY,
                receiverY: surfaceHeight,
                visible: motionGroup.visible,
                x: stack.position.x + state.offsetX,
                yaw: 0,
                z: stack.position.z + state.offsetZ,
            });
        };

        if (!currentState.active) {
            const bounceY = advanceBeachBallVisualBounce(
                visualBounce,
                deltaSeconds,
            );
            setMotionPosition(currentState, bounceY);
            if (
                motionActiveRef.current &&
                !isBeachBallVisualBounceActive(visualBounce)
            ) {
                motionActiveRef.current = false;
                setMotionActive(false);
            }
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
        if (nextState.collisionCount > currentState.collisionCount) {
            visualBounceRef.current = createBeachBallCollisionBounce(speed);
        }
        const bounceY = advanceBeachBallVisualBounce(
            visualBounceRef.current,
            deltaSeconds,
        );
        const movementX = nextState.offsetX - previousOffsetX;
        const movementZ = nextState.offsetZ - previousOffsetZ;

        setMotionPosition(nextState, bounceY);
        rollingGroup.rotation.x += movementZ / beachBallCollisionRadius;
        rollingGroup.rotation.z -= movementX / beachBallCollisionRadius;
        if (
            motionActiveRef.current &&
            !nextState.active &&
            !isBeachBallVisualBounceActive(visualBounceRef.current)
        ) {
            motionActiveRef.current = false;
            setMotionActive(false);
        }
    });

    function handlePointerUp(event: ThreeEvent<PointerEvent>) {
        if (event.button !== 0) {
            return;
        }

        // Pickup starts in the parent on pointer down. Keep pointer up from
        // also turning a beach-ball tap into the parent's rotate gesture.
        event.stopPropagation();
    }

    function handleClick(event: ThreeEvent<MouseEvent>) {
        event.stopPropagation();

        if (areBlockInteractionsSuppressed()) {
            return;
        }

        const currentState = bounceStateRef.current;
        if (
            currentState.active ||
            isBeachBallVisualBounceActive(visualBounceRef.current)
        ) {
            return;
        }

        clickCountRef.current += 1;
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

        bounceStateRef.current = startBeachBallBounce({
            direction: { x: directionX, z: directionZ },
            speed,
            state: currentState,
        });
        activateMotion();
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
            <group position={position}>
                {/* biome-ignore lint/a11y/noStaticElementInteractions: Three.js group uses raycast picking for the clickable beach ball. */}
                <group
                    ref={motionGroupRef}
                    onClick={handleClick}
                    onPointerEnter={handlePointerEnter}
                    onPointerLeave={handlePointerLeave}
                    onPointerUp={handlePointerUp}
                >
                    <group
                        ref={rollingGroupRef}
                        position={[0, beachBallVisualCenterY, 0]}
                    >
                        <animated.group
                            rotation={
                                animatedRotation as unknown as [
                                    number,
                                    number,
                                    number,
                                ]
                            }
                        >
                            <group
                                position={[0, -beachBallVisualCenterY, 0]}
                                scale={beachBallScale}
                            >
                                {beachBallNodeNames.map((nodeName) => (
                                    <BeachBallPart
                                        key={nodeName}
                                        node={nodes[nodeName]}
                                    />
                                ))}
                            </group>
                        </animated.group>
                    </group>
                </group>
            </group>
        </HoverOutline>
    );
}
