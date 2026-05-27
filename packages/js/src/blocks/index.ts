export const nightOnlyBlockNames = ['FireflyJar'] as const;

export function isNightOnlyBlockName(blockName: string) {
    return nightOnlyBlockNames.some(
        (nightOnlyBlockName) => nightOnlyBlockName === blockName,
    );
}

export function isNightTimeOfDay(timeOfDay: number) {
    return timeOfDay <= 0.2 || timeOfDay >= 0.8;
}
