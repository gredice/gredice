import {
    type AppliedOperationVisualInput,
    type OperationVisualDefinitionInput,
    type OperationVisualReward,
    resolveOperationVisualRewards,
} from '../../operationVisualRewards';

type ResolveRaisedBedMulchVisualRewardsInput = {
    appliedOperations: AppliedOperationVisualInput[];
    operations: OperationVisualDefinitionInput[];
    raisedBedId: number;
};

function activeMulchRewards({
    appliedOperations,
    operations,
}: ResolveRaisedBedMulchVisualRewardsInput) {
    return resolveOperationVisualRewards({
        appliedOperations,
        operations,
    }).filter((reward) => reward.family === 'mulch' && reward.active);
}

export function resolveActiveRaisedBedMulchReward(
    input: ResolveRaisedBedMulchVisualRewardsInput,
) {
    return (
        activeMulchRewards(input).find(
            (reward) =>
                reward.scope === 'raisedBed' &&
                reward.raisedBedId === input.raisedBedId,
        ) ?? null
    );
}

export function resolveActiveFieldMulchRewardsByFieldId(
    input: ResolveRaisedBedMulchVisualRewardsInput,
) {
    const rewardsByFieldId = new Map<number, OperationVisualReward>();

    for (const reward of activeMulchRewards(input)) {
        if (
            reward.scope !== 'field' ||
            reward.raisedBedId !== input.raisedBedId ||
            reward.raisedBedFieldId == null
        ) {
            continue;
        }

        rewardsByFieldId.set(reward.raisedBedFieldId, reward);
    }

    return rewardsByFieldId;
}
