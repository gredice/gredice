import type { PlantLodLevel } from '../../generators/plant/lib/plantLod';
import type { GameQualityProfileTier } from '../../scene/gameQuality';

export const HIGH_GENERATED_PLANT_DETAIL_INSTANCE_BUDGET = 179;

const INCUMBENT_BENEFIT_MULTIPLIER = 1.08;

export function resolveLegacyGeneratedPlantDetailBudget(search?: string) {
    return new URLSearchParams(search).get('foliageBudget') === 'legacy';
}

export function isGeneratedPlantDetailBudgetActive(
    qualityTier: GameQualityProfileTier,
    legacyDetailBudget: boolean,
) {
    return qualityTier === 'high' && !legacyDetailBudget;
}

export type GeneratedPlantDetailBudgetRequest = {
    instanceCount: number;
    isInteracting: boolean;
    isSelected: boolean;
    projectedBenefit: number;
    raisedBedId: number;
    requestedLod: PlantLodLevel;
    wasAdmitted: boolean;
};

export type GeneratedPlantDetailBudgetDecision = {
    detailAdmitted: boolean;
    instanceCount: number;
    raisedBedId: number;
    rankingScore: number | null;
    requestedLod: PlantLodLevel;
    resolvedLod: PlantLodLevel;
};

export type GeneratedPlantDetailBudgetStats = {
    admittedBedCount: number;
    admittedInstanceCount: number;
    demotedBedCount: number;
    evictedBedCount: number;
    instanceBudget: number;
    overflowInstanceCount: number;
    promotedBedCount: number;
    releasedBedCount: number;
    requestedBedCount: number;
    requestedInstanceCount: number;
    retainedBedCount: number;
    usedBudgetInstanceCount: number;
};

export type GeneratedPlantDetailBudgetAllocation = {
    decisions: GeneratedPlantDetailBudgetDecision[];
    stats: GeneratedPlantDetailBudgetStats;
};

type RankedNearRequest = {
    index: number;
    instanceCount: number;
    rankingScore: number;
    request: GeneratedPlantDetailBudgetRequest;
};

function normalizeInstanceCount(instanceCount: number) {
    return Number.isFinite(instanceCount)
        ? Math.max(0, Math.floor(instanceCount))
        : 0;
}

function normalizeProjectedBenefit(projectedBenefit: number) {
    return Number.isFinite(projectedBenefit)
        ? Math.max(0, projectedBenefit)
        : 0;
}

function getRankingScore({
    instanceCount,
    projectedBenefit,
    wasAdmitted,
}: {
    instanceCount: number;
    projectedBenefit: number;
    wasAdmitted: boolean;
}) {
    const benefitPerInstance =
        normalizeProjectedBenefit(projectedBenefit) /
        Math.max(1, instanceCount);

    return (
        benefitPerInstance * (wasAdmitted ? INCUMBENT_BENEFIT_MULTIPLIER : 1)
    );
}

function compareRankedNearRequests(
    first: RankedNearRequest,
    second: RankedNearRequest,
) {
    if (first.request.isSelected !== second.request.isSelected) {
        return first.request.isSelected ? -1 : 1;
    }

    if (first.request.isInteracting !== second.request.isInteracting) {
        return first.request.isInteracting ? -1 : 1;
    }

    if (first.rankingScore !== second.rankingScore) {
        return second.rankingScore - first.rankingScore;
    }

    if (first.request.wasAdmitted !== second.request.wasAdmitted) {
        return first.request.wasAdmitted ? -1 : 1;
    }

    if (first.request.raisedBedId !== second.request.raisedBedId) {
        return first.request.raisedBedId - second.request.raisedBedId;
    }

    return first.index - second.index;
}

export function allocateGeneratedPlantDetailBudget(
    requests: readonly GeneratedPlantDetailBudgetRequest[],
    {
        instanceBudget = HIGH_GENERATED_PLANT_DETAIL_INSTANCE_BUDGET,
    }: {
        instanceBudget?: number;
    } = {},
): GeneratedPlantDetailBudgetAllocation {
    const normalizedInstanceBudget = normalizeInstanceCount(instanceBudget);
    const rankedNearRequests = requests
        .map((request, index): RankedNearRequest | null => {
            if (request.requestedLod !== 'near') {
                return null;
            }

            const instanceCount = normalizeInstanceCount(request.instanceCount);

            return {
                index,
                instanceCount,
                rankingScore: getRankingScore({
                    instanceCount,
                    projectedBenefit: request.projectedBenefit,
                    wasAdmitted: request.wasAdmitted,
                }),
                request,
            };
        })
        .filter((request) => request !== null)
        .sort(compareRankedNearRequests);
    const admittedRequestIndexes = new Set<number>();
    const rankingScoreByRequestIndex = new Map<number, number>();
    let admittedInstanceCount = 0;

    for (const request of rankedNearRequests) {
        rankingScoreByRequestIndex.set(request.index, request.rankingScore);
        const fitsBudget =
            request.instanceCount === 0 ||
            admittedInstanceCount + request.instanceCount <=
                normalizedInstanceBudget;

        if (!request.request.isSelected && !fitsBudget) {
            continue;
        }

        admittedRequestIndexes.add(request.index);
        admittedInstanceCount += request.instanceCount;
    }

    let admittedBedCount = 0;
    let evictedBedCount = 0;
    let promotedBedCount = 0;
    let releasedBedCount = 0;
    let requestedInstanceCount = 0;
    let retainedBedCount = 0;

    const decisions = requests.map(
        (request, index): GeneratedPlantDetailBudgetDecision => {
            const instanceCount = normalizeInstanceCount(request.instanceCount);
            const requestedDetail = request.requestedLod === 'near';
            const detailAdmitted =
                requestedDetail && admittedRequestIndexes.has(index);

            if (requestedDetail) {
                requestedInstanceCount += instanceCount;
                if (detailAdmitted) {
                    admittedBedCount += 1;
                    if (request.wasAdmitted) {
                        retainedBedCount += 1;
                    } else {
                        promotedBedCount += 1;
                    }
                } else if (request.wasAdmitted) {
                    evictedBedCount += 1;
                }
            } else if (request.wasAdmitted) {
                releasedBedCount += 1;
            }

            return {
                detailAdmitted,
                instanceCount,
                raisedBedId: request.raisedBedId,
                rankingScore: rankingScoreByRequestIndex.get(index) ?? null,
                requestedLod: request.requestedLod,
                resolvedLod:
                    requestedDetail && !detailAdmitted
                        ? 'mid'
                        : request.requestedLod,
            };
        },
    );

    return {
        decisions,
        stats: {
            admittedBedCount,
            admittedInstanceCount,
            demotedBedCount: rankedNearRequests.length - admittedBedCount,
            evictedBedCount,
            instanceBudget: normalizedInstanceBudget,
            overflowInstanceCount: Math.max(
                0,
                admittedInstanceCount - normalizedInstanceBudget,
            ),
            promotedBedCount,
            releasedBedCount,
            requestedBedCount: rankedNearRequests.length,
            requestedInstanceCount,
            retainedBedCount,
            usedBudgetInstanceCount: Math.min(
                admittedInstanceCount,
                normalizedInstanceBudget,
            ),
        },
    };
}
