import {
    type AppliedOperationVisualInput,
    type OperationVisualDefinitionInput,
    type OperationVisualReward,
    resolveOperationVisualRewardKind,
    resolveOperationVisualRewards,
} from '../../operationVisualRewards';

type ResolveRaisedBedMulchVisualRewardsInput = {
    appliedOperations: AppliedOperationVisualInput[];
    operations: OperationVisualDefinitionInput[];
    raisedBedId: number;
};

export type RaisedBedMulchVisualBlockInput = {
    id: number;
    information: {
        name: string;
    };
};

export type RaisedBedMulchVisual = {
    blockId: number;
    blockName: string;
    application: string;
};

function normalizeText(value: string | null | undefined) {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function textIncludesAny(text: string, keywords: string[]) {
    return keywords.some((keyword) => text.includes(keyword));
}

function getMulchKeywords(blockName: string) {
    switch (blockName) {
        case 'MulchHey':
            return ['slama', 'slamom', 'sijeno', 'hay', 'straw', 'hey'];
        case 'MulchCoconut':
            return ['kokos', 'kokosova', 'kokosove', 'coconut'];
        case 'MulchWood':
            return ['drvo', 'drveta', 'drvena', 'wood', 'kora'];
        default:
            return [];
    }
}

export function isBedMulchApplication(application: string | null | undefined) {
    return application === 'raisedBedFull' || application === 'raisedBed1m';
}

export function isFieldMulchApplication(
    application: string | null | undefined,
) {
    return application === 'plant';
}

function activeMulchRewards(
    {
        appliedOperations,
        operations,
        raisedBedId,
    }: ResolveRaisedBedMulchVisualRewardsInput,
    isTargetApplication: (application: string | null | undefined) => boolean,
) {
    const targetOperations = operations.filter((operation) =>
        isTargetApplication(operation.attributes?.application),
    );
    const targetOperationIds = new Set(
        targetOperations.map((operation) => operation.id),
    );

    return resolveOperationVisualRewards({
        appliedOperations: appliedOperations
            .filter((operation) => targetOperationIds.has(operation.entityId))
            .map((operation) => ({
                ...operation,
                raisedBedId: operation.raisedBedId ?? raisedBedId,
            })),
        operations: targetOperations,
    }).filter((reward) => reward.family === 'mulch' && reward.active);
}

export function resolveActiveRaisedBedMulchReward(
    input: ResolveRaisedBedMulchVisualRewardsInput,
) {
    return (
        activeMulchRewards(input, isBedMulchApplication).find(
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

    for (const reward of activeMulchRewards(input, isFieldMulchApplication)) {
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

export function resolveMulchVisualByOperationId(
    operations: OperationVisualDefinitionInput[] | null | undefined,
    blocks: RaisedBedMulchVisualBlockInput[] | null | undefined,
) {
    const visuals = new Map<number, RaisedBedMulchVisual>();
    const mulchBlocks =
        blocks?.filter((block) => block.information.name.startsWith('Mulch')) ??
        [];
    const fallbackMulchBlock =
        mulchBlocks.find((block) => block.information.name === 'MulchHey') ??
        mulchBlocks[0];

    for (const operation of operations ?? []) {
        if (resolveOperationVisualRewardKind(operation) !== 'mulch') {
            continue;
        }

        const application = operation.attributes?.application ?? null;
        if (
            !isBedMulchApplication(application) &&
            !isFieldMulchApplication(application)
        ) {
            continue;
        }

        const operationText = normalizeText(
            [
                operation.information?.name,
                operation.information?.label,
                operation.information?.shortDescription,
                operation.information?.description,
                operation.image?.cover?.url,
            ].join(' '),
        );

        const imageUrl = operation.image?.cover?.url ?? '';
        const matchedBlock =
            mulchBlocks.find((block) =>
                imageUrl.includes(block.information.name),
            ) ??
            mulchBlocks.find((block) =>
                textIncludesAny(
                    operationText,
                    getMulchKeywords(block.information.name),
                ),
            ) ??
            fallbackMulchBlock;

        if (!matchedBlock || !application) {
            continue;
        }

        visuals.set(operation.id, {
            blockId: matchedBlock.id,
            blockName: matchedBlock.information.name,
            application,
        });
    }

    return visuals;
}
