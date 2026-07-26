const statisticsPeriodQueryKeys = new Set(['period', 'from', 'to']);

export function preservedStatisticsPeriodEntries(search: string) {
    return Array.from(new URLSearchParams(search).entries()).filter(
        ([key]) => !statisticsPeriodQueryKeys.has(key),
    );
}
