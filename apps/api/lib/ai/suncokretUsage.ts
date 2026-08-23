export type SuncokretUsagePeriod = {
    usedPercent: number;
    remainingPercent: number;
};

function clampPercent(value: number) {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.min(100, Math.max(0, value));
}

export function suncokretUsagePeriod({
    limit,
    reserved,
    used,
}: {
    limit: number;
    reserved: number;
    used: number;
}): SuncokretUsagePeriod {
    const usedPercent =
        limit > 0 ? clampPercent(((used + reserved) / limit) * 100) : 0;

    return {
        usedPercent,
        remainingPercent: 100 - usedPercent,
    };
}

export function buildSuncokretUsageStatus({
    dailyLimit,
    dailyReserved,
    dailyUsed,
    outputUsageUnitsPerToken,
    weeklyLimit,
    weeklyReserved,
    weeklyUsed,
}: {
    dailyLimit: number;
    dailyReserved: number;
    dailyUsed: number;
    outputUsageUnitsPerToken: number;
    weeklyLimit: number;
    weeklyReserved: number;
    weeklyUsed: number;
}) {
    return {
        day: suncokretUsagePeriod({
            limit: dailyLimit,
            reserved: dailyReserved,
            used: dailyUsed,
        }),
        week: suncokretUsagePeriod({
            limit: weeklyLimit,
            reserved: weeklyReserved,
            used: weeklyUsed,
        }),
        liveOutputPercentPerToken: {
            day:
                dailyLimit > 0
                    ? (outputUsageUnitsPerToken / dailyLimit) * 100
                    : 0,
            week:
                weeklyLimit > 0
                    ? (outputUsageUnitsPerToken / weeklyLimit) * 100
                    : 0,
        },
    };
}
