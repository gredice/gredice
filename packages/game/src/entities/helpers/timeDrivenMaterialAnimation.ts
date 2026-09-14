import {
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
} from '../../scene/SceneTime';

export const timeDrivenMaterialAnimationOwner = 'time-driven-materials';

export function isTimeDrivenMaterialAnimationActive(
    fixedTimeSeconds: number | undefined,
) {
    return fixedTimeSeconds === undefined;
}

export function resolveTimeDrivenMaterialSpeed(
    speed: number,
    animationActive: boolean,
) {
    return animationActive ? speed : 0;
}

/**
 * Keeps Drei's clock-driven distort and wobble materials on the semantic
 * ambient cadence. Drei reads the R3F clock directly, so fixed-time scenes
 * also pin their speed to zero to keep externally requested frames stable.
 */
export function useTimeDrivenMaterialAnimation() {
    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const animationActive =
        isTimeDrivenMaterialAnimationActive(fixedTimeSeconds);
    useSceneTimeInvalidation(timeDrivenMaterialAnimationOwner, animationActive);
    return animationActive;
}
