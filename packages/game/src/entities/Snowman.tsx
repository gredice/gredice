import { animated } from '../scene/sceneSpring';
import { seasonalRoles } from '../scene/seasonalRoles';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

const { holidayRed, inkViolet, snow } = seasonalRoles;
// Albedo of the reachable carrot orange (on screen #ef8429); the brighter
// carrot role cannot be reached under neutral tone mapping.
const carrotColor = '#965320';
const carrotRoughness = 0.4;

// Positions are relative to the model origin, which sits 1.139 above the
// stack. The head centre is at -0.089 with radius 0.17. The face points -Z,
// toward the default camera, like the scarecrow's face.
const headCenterY = -0.089;
const eyePositions = [
    [-0.062, headCenterY + 0.045, -0.148],
    [0.062, headCenterY + 0.045, -0.148],
] as const;
const buttonPositions = [
    [0, -0.4, -0.222],
    [0, -0.5, -0.218],
] as const;
// A chunky scarf ring where the head meets the middle snowball.
const scarfY = -0.235;

export function Snowman({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('Snowman');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1.139)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Snowman.geometry}
                scale={0.36}
            >
                <meshStandardMaterial
                    color={snow.albedo}
                    roughness={snow.roughness}
                    metalness={0}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                position={[0, scarfY, 0]}
                rotation={[Math.PI / 2, 0, 0]}
            >
                <torusGeometry args={[0.125, 0.045, 10, 28]} />
                <meshStandardMaterial
                    color={holidayRed.albedo}
                    roughness={holidayRed.roughness}
                    metalness={0}
                />
            </mesh>
            <mesh
                castShadow
                position={[0, headCenterY - 0.01, -0.225]}
                rotation={[-Math.PI / 2, 0, 0]}
            >
                <coneGeometry args={[0.045, 0.17, 12]} />
                <meshStandardMaterial
                    color={carrotColor}
                    roughness={carrotRoughness}
                    metalness={0}
                />
            </mesh>
            {[...eyePositions, ...buttonPositions].map((position) => (
                <mesh key={position.join(':')} position={[...position]}>
                    <sphereGeometry args={[0.026, 12, 8]} />
                    <meshStandardMaterial
                        color={inkViolet.albedo}
                        roughness={inkViolet.roughness}
                        metalness={0}
                    />
                </mesh>
            ))}
        </animated.group>
    );
}
