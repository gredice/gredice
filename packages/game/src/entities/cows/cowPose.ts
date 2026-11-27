import {
    idleBreathingAmplitudes,
    idleBreathingScale,
    idleBreathingWave,
} from '../../scene/idleBreathing';
import type { CowBehavior } from './cowBehavior';

export function getCowPoseTargets({
    behavior,
    breathAmplitude = idleBreathingAmplitudes.animal,
    breathSeed = 0,
    moving,
    now,
    trot,
    walkPhase,
}: {
    behavior: CowBehavior;
    /** Peak body stretch; zero for reduced motion and fixed-time captures. */
    breathAmplitude?: number;
    /** Phase seed of this cow's idle breathing (`idleBreathingSeed`). */
    breathSeed?: number;
    moving: boolean;
    now: number;
    trot: boolean;
    walkPhase: number;
}) {
    const grazing = behavior === 'graze' && !moving ? 1 : 0;
    const chewing = behavior === 'chew-cud' && !moving ? 1 : 0;
    // Idle breathing (GAME_ART.md, "Motion"): the shared volume-preserving
    // stretch, about one breath every four seconds in this cow's own phase.
    const breath = idleBreathingScale(
        breathAmplitude,
        idleBreathingWave(now, breathSeed),
    );
    const gaitAmount = moving ? (trot ? 0.52 : 0.34) : 0;
    const diagonalStep = Math.sin(walkPhase) * gaitAmount;
    const heavyBob = moving
        ? Math.max(0, Math.sin(walkPhase * 2)) * (trot ? 0.045 : 0.022)
        : 0;
    const cud = chewing ? Math.sin(now * 4.2) * 0.095 : 0;
    const tailPulse = Math.sin(now * 1.8) ** 5;

    return {
        bodyPositionY: heavyBob,
        bodyScaleX: breath.side,
        bodyScaleY: breath.up,
        bodyScaleZ: breath.side,
        earRotationZ: Math.sin(now * 3.1) * 0.12,
        headRotationX:
            grazing * -0.62 +
            (behavior === 'idle' ? Math.sin(now * 0.72) * 0.035 : 0),
        headRotationZ:
            behavior === 'observe-avatar'
                ? Math.sin(now * 1.1) * 0.04
                : Math.sin(now * 0.55) * 0.055,
        jawRotationY: cud,
        legRotations: [
            diagonalStep,
            -diagonalStep,
            -diagonalStep,
            diagonalStep,
        ],
        neckRotationX: grazing * -0.5,
        tailBaseRotationY: tailPulse * 0.56,
        tailTipRotationY: tailPulse * 0.72,
    };
}
