import type { EulerOrder } from 'three';
import type { FishingBoatOarSide } from './fishingBoatOars';

const oarStrokeDistance = 0.82;
const oarStrokeAngle = 0.48;

// A mounted boat swings its oars out over the water so the blades sweep fore
// and aft along the hull sides instead of rowing up and down inside the boat.
export const fishingBoatOarDeployYaw = Math.PI / 2;
export const fishingBoatOarDeployTilt = 0.7;
export const fishingBoatOarDeployLift = 0.18;
// The deployed pose swings around the vertical axis first and only then tips
// the blade towards the water, so the roll has to be applied last.
export const fishingBoatOarRotationOrder: EulerOrder = 'ZYX';

export function getFishingBoatOarRotation({
    distance,
    rowingAmount,
}: {
    distance: number;
    rowingAmount: number;
}) {
    const amount = Math.min(Math.max(rowingAmount, 0), 1);
    return (
        Math.sin((distance / oarStrokeDistance) * Math.PI * 2) *
        oarStrokeAngle *
        amount
    );
}

export function getFishingBoatOarPose({
    distance,
    mounted,
    rowingAmount,
    side,
}: {
    distance: number;
    mounted: boolean;
    rowingAmount: number;
    side: FishingBoatOarSide;
}) {
    if (!mounted) {
        return { lift: 0, tilt: 0, yaw: 0 };
    }

    const sideSign = side === 'port' ? 1 : -1;
    return {
        lift: fishingBoatOarDeployLift,
        tilt: sideSign * fishingBoatOarDeployTilt,
        yaw:
            sideSign *
            (fishingBoatOarDeployYaw +
                getFishingBoatOarRotation({ distance, rowingAmount })),
    };
}
