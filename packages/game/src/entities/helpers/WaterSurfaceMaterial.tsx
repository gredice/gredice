import { MeshDistortMaterial } from '@react-three/drei';
import { Color, DoubleSide, LinearSRGBColorSpace } from 'three';
import { usePrefersReducedMotion } from '../../scene/IdleBreathingMotion';
import {
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';
import {
    litWaterSurfaceAlbedo,
    litWaterSurfaceRoughness,
} from '../../scene/waterColorState';
import {
    isTimeDrivenMaterialAnimationActive,
    resolveTimeDrivenMaterialSpeed,
    timeDrivenMaterialAnimationOwner,
} from './timeDrivenMaterialAnimation';

/**
 * Lit water in small props (bucket, well, watering can). Scene light does
 * the time of day and weather, so the albedo is fixed: the water role with
 * wet roughness and no metalness.
 */
export const litWaterSurfaceMaterialProps = {
    color: new Color().setRGB(
        litWaterSurfaceAlbedo[0],
        litWaterSurfaceAlbedo[1],
        litWaterSurfaceAlbedo[2],
        LinearSRGBColorSpace,
    ),
    depthWrite: false,
    metalness: 0,
    opacity: 0.9,
    roughness: litWaterSurfaceRoughness,
    side: DoubleSide,
    transparent: true,
};

/**
 * Whether prop water ripples: on the ambient cadence, still in fixed-time
 * captures and for viewers who ask for reduced motion.
 */
export function isWaterSurfaceAnimationActive({
    fixedTimeSeconds,
    reducedMotion,
}: {
    fixedTimeSeconds: number | undefined;
    reducedMotion: boolean;
}) {
    return (
        isTimeDrivenMaterialAnimationActive(fixedTimeSeconds) && !reducedMotion
    );
}

export function WaterSurfaceMaterial() {
    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const reducedMotion = usePrefersReducedMotion();
    const materialAnimationActive = isWaterSurfaceAnimationActive({
        fixedTimeSeconds,
        reducedMotion,
    });
    useSceneTimeInvalidation(
        timeDrivenMaterialAnimationOwner,
        materialAnimationActive,
    );

    return (
        <MeshDistortMaterial
            {...litWaterSurfaceMaterialProps}
            distort={0.14}
            speed={resolveTimeDrivenMaterialSpeed(1.4, materialAnimationActive)}
        />
    );
}
