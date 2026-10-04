import type { OperationVisualReward } from '../../operationVisualRewards';

export const WATERING_REWARD_VISIBLE_MS = 72 * 60 * 60 * 1000;

export function isWateringRewardVisible(
    reward: OperationVisualReward,
    currentTime: Date,
) {
    if (!reward.active || reward.kind !== 'watering') {
        return false;
    }

    const currentTimeMs = currentTime.getTime();
    const ageMs = currentTimeMs - reward.timestampMs;

    return (
        Number.isFinite(currentTimeMs) &&
        Number.isFinite(reward.timestampMs) &&
        ageMs >= 0 &&
        ageMs <= WATERING_REWARD_VISIBLE_MS
    );
}
