import { Line } from '@react-three/drei';
import { forwardRef, useMemo } from 'react';
import type { Group } from 'three';
import { DoubleSide } from 'three';

export type AnimalDebugPathPoint = [x: number, y: number, z: number];

export const AnimalTargetDebugMarker = forwardRef<
    Group,
    {
        color: string;
    }
>(({ color }, ref) => (
    <group ref={ref} visible={false} raycast={() => undefined}>
        <mesh position={[0, 0.08, 0]} renderOrder={1000}>
            <sphereGeometry args={[0.045, 12, 8]} />
            <meshBasicMaterial
                color={color}
                depthTest={false}
                depthWrite={false}
                opacity={0.9}
                transparent
            />
        </mesh>
        <mesh position={[0, 0.11, 0]} renderOrder={1000}>
            <cylinderGeometry args={[0.01, 0.01, 0.22, 6]} />
            <meshBasicMaterial
                color={color}
                depthTest={false}
                depthWrite={false}
                opacity={0.7}
                transparent
            />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={1000}>
            <ringGeometry args={[0.13, 0.16, 32]} />
            <meshBasicMaterial
                color={color}
                depthTest={false}
                depthWrite={false}
                opacity={0.75}
                side={DoubleSide}
                transparent
            />
        </mesh>
    </group>
));

AnimalTargetDebugMarker.displayName = 'AnimalTargetDebugMarker';

export function AnimalPathDebugIndicator({
    color,
    points,
    visible,
}: {
    color: string;
    points: AnimalDebugPathPoint[];
    visible: boolean;
}) {
    const linePoints = useMemo<AnimalDebugPathPoint[]>(
        () => points.map((point) => [point[0], point[1] + 0.035, point[2]]),
        [points],
    );

    if (!visible || linePoints.length < 2) {
        return null;
    }

    return (
        <group raycast={() => undefined}>
            <Line
                color={color}
                depthTest={false}
                lineWidth={1.8}
                opacity={0.86}
                points={linePoints}
                renderOrder={1000}
                transparent
            />
            {linePoints.map((point, index) => (
                <mesh
                    key={`${point[0]}:${point[1]}:${point[2]}`}
                    position={point}
                    renderOrder={1001}
                >
                    <sphereGeometry
                        args={[index === 0 ? 0.035 : 0.027, 10, 8]}
                    />
                    <meshBasicMaterial
                        color={color}
                        depthTest={false}
                        depthWrite={false}
                        opacity={index === 0 ? 0.95 : 0.78}
                        transparent
                    />
                </mesh>
            ))}
        </group>
    );
}
