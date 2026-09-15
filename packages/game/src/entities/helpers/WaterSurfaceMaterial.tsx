import { MeshDistortMaterial } from '@react-three/drei';
import { DoubleSide } from 'three';
import { useGameState } from '../../useGameState';
import {
    resolveTimeDrivenMaterialSpeed,
    useTimeDrivenMaterialAnimation,
} from './timeDrivenMaterialAnimation';

export function WaterSurfaceMaterial() {
    const waterColor = useGameState((state) => state.waterColors.shallow);
    const materialAnimationActive = useTimeDrivenMaterialAnimation();

    return (
        <MeshDistortMaterial
            color={waterColor}
            depthWrite={false}
            distort={0.14}
            metalness={0.6}
            opacity={0.58}
            roughness={0.24}
            side={DoubleSide}
            speed={resolveTimeDrivenMaterialSpeed(1.4, materialAnimationActive)}
            transparent
        />
    );
}
