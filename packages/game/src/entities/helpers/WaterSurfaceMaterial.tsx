import { MeshDistortMaterial } from '@react-three/drei';
import { DoubleSide } from 'three';
import { useGameState } from '../../useGameState';

export function WaterSurfaceMaterial() {
    const waterColor = useGameState((state) => state.waterColors.shallow);

    return (
        <MeshDistortMaterial
            color={waterColor}
            depthWrite={false}
            distort={0.14}
            metalness={0.6}
            opacity={0.58}
            roughness={0.24}
            side={DoubleSide}
            speed={1.4}
            transparent
        />
    );
}
