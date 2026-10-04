import { Billboard } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { CanvasTexture } from 'three';

export function PumpkinTrailMarker({
    number,
    id,
    x,
    z,
    lit,
    focused,
}: {
    number: number;
    id: string;
    x: number;
    z: number;
    lit: boolean;
    focused: boolean;
}) {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Marker canvas unavailable');
        context.fillStyle = '#fff';
        context.font = 'bold 84px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(String(number), 64, 66);
        return new CanvasTexture(canvas);
    }, [number]);
    useEffect(() => () => texture.dispose(), [texture]);
    return (
        <Billboard
            position={[x - 2, 1.35, z - 2]}
            name={`PumpkinTrailMarker:${id}`}
        >
            <mesh position={[0, 0, -0.005]} renderOrder={9}>
                <circleGeometry args={[focused ? 0.23 : 0.2, 24]} />
                <meshBasicMaterial
                    color={lit ? '#9b4c14' : '#234335'}
                    depthTest={false}
                    depthWrite={false}
                />
            </mesh>
            <mesh renderOrder={10}>
                <planeGeometry args={[0.33, 0.33]} />
                <meshBasicMaterial
                    map={texture}
                    transparent
                    depthTest={false}
                    depthWrite={false}
                />
            </mesh>
        </Billboard>
    );
}
