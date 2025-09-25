export type AchievementCategory = 'registration' | 'plants';

export type AchievementStatus = 'pending' | 'approved' | 'denied';

export interface AchievementDefinition {
    key: string;
    category: AchievementCategory;
    threshold?: number;
    rewardSunflowers: number;
    title: string;
    description: string;
    autoApprove?: boolean;
    sortOrder: number;
}

const plantingThresholds: Array<[threshold: number, reward: number]> = [
    [1, 100],
    [10, 250],
    [20, 400],
    [50, 750],
    [100, 1_200],
    [200, 2_000],
];

const wateringThresholds: Array<[threshold: number, reward: number]> = [
    [1, 50],
    [10, 150],
    [20, 300],
    [50, 600],
    [100, 900],
    [200, 1_500],
];

const harvestThresholds: Array<[threshold: number, reward: number]> = [
    [1, 150],
    [10, 300],
    [20, 600],
    [50, 1_200],
    [100, 2_000],
    [200, 3_500],
];

function plantingTitle(threshold: number) {
    if (threshold === 1) {
        return 'Prvo sjeme';
    }
    return `Posađeno ${threshold} biljaka`;
}

function wateringTitle(threshold: number) {
    if (threshold === 1) {
        return 'Prvo zalijevanje';
    }
    return `Zalijevanje ${threshold} puta`;
}

function harvestTitle(threshold: number) {
    if (threshold === 1) {
        return 'Prva berba';
    }
    return `Ubrane ${threshold} berbe`;
}

export const achievementDefinitions: AchievementDefinition[] = [
    {
        key: 'registration',
        category: 'registration',
        rewardSunflowers: 1_000,
        title: 'Dobrodošlica u Gredice',
        description:
            'Registriraj račun i započni svoj vrt uz 1 000 suncokreta dobrodošlice.',
        autoApprove: true,
        sortOrder: 0,
    },
    ...plantingThresholds.map(([threshold, reward], index) => ({
        key: `planting_${threshold}`,
        category: 'plants' as const,
        threshold,
        rewardSunflowers: reward,
        title: plantingTitle(threshold),
        description: `Posadi ${threshold} biljaka u svojim gredicama.`,
        sortOrder: 100 + index,
    })),
    ...wateringThresholds.map(([threshold, reward], index) => ({
        key: `watering_${threshold}`,
        category: 'plants' as const,
        threshold,
        rewardSunflowers: reward,
        title: wateringTitle(threshold),
        description: `Zalij biljke ${threshold} puta.`,
        sortOrder: 200 + index,
    })),
    ...harvestThresholds.map(([threshold, reward], index) => ({
        key: `harvest_${threshold}`,
        category: 'plants' as const,
        threshold,
        rewardSunflowers: reward,
        title: harvestTitle(threshold),
        description: `Uberi biljke ${threshold} puta.`,
        sortOrder: 300 + index,
    })),
];

const definitionsByKey = new Map(
    achievementDefinitions.map((definition) => [definition.key, definition]),
);

export function getAchievementDefinitions() {
    return achievementDefinitions.slice();
}

export function getAchievementDefinition(key: string) {
    return definitionsByKey.get(key);
}
