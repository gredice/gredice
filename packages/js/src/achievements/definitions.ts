import {
    type AchievementArtworkKey,
    type AchievementVisualGrade,
    getAchievementPresentation,
} from './presentation';

export type AchievementCategory =
    | 'registration'
    | 'planting'
    | 'watering'
    | 'harvest'
    | 'community_editing'
    | 'garden_diversity'
    | 'seed_to_table'
    | 'seasonal';

export type AchievementStatus = 'pending' | 'approved' | 'denied';

export interface AchievementDefinition {
    key: string;
    category: AchievementCategory;
    familyKey: AchievementCategory;
    level: number;
    visualGrade: AchievementVisualGrade;
    artworkKey: AchievementArtworkKey;
    threshold?: number;
    rewardSunflowers: number;
    title: string;
    description: string;
    autoApprove?: boolean;
    sortOrder: number;
}

// TODO: Balance the rewards
const plantingThresholds: Array<[threshold: number, reward: number]> = [
    [1, 100],
    [10, 250],
    [20, 400],
    [50, 750],
    [100, 1_200],
    [150, 2_000],
    [200, 5_000],
    [300, 10_000],
    [500, 50_000],
];

// TODO: Balance the rewards
const wateringThresholds: Array<[threshold: number, reward: number]> = [
    [1, 50],
    [10, 150],
    [20, 300],
    [50, 600],
    [100, 900],
    [150, 1_200],
    [200, 2_000],
    [300, 5_000],
    [500, 10_000],
];

// TODO: Balance the rewards
const harvestThresholds: Array<[threshold: number, reward: number]> = [
    [1, 150],
    [10, 300],
    [20, 600],
    [50, 1_200],
    [100, 2_000],
    [150, 3_000],
    [200, 5_000],
    [300, 10_000],
    [500, 50_000],
];

// TODO: Balance the rewards
const communityEditingThresholds: Array<[threshold: number, reward: number]> = [
    [1, 100],
    [5, 250],
    [10, 500],
    [25, 1_000],
    [50, 2_000],
    [100, 5_000],
];

// TODO: Balance the rewards
const gardenDiversityThresholds: Array<[threshold: number, reward: number]> = [
    [3, 150],
    [5, 300],
    [10, 600],
    [15, 1_200],
    [20, 2_500],
];

// TODO: Balance the rewards
const seedToTableThresholds: Array<[threshold: number, reward: number]> = [
    [1, 200],
    [5, 500],
    [10, 1_000],
    [25, 2_500],
    [50, 8_000],
];

const seasonalAwards: Array<{
    key: string;
    title: string;
    description: string;
    rewardSunflowers: number;
}> = [
    {
        key: 'season_2026_spring',
        title: 'Proljeće 2026',
        description:
            'Ostvari potvrđenu sadnju ili berbu od sjemena do stola u proljeće 2026. (1. ožujka – 31. svibnja).',
        rewardSunflowers: 1_000,
    },
    {
        key: 'season_2026_summer',
        title: 'Ljeto 2026',
        description:
            'Ostvari potvrđenu sadnju ili berbu od sjemena do stola u ljeto 2026. (1. lipnja – 31. kolovoza).',
        rewardSunflowers: 1_000,
    },
    {
        key: 'season_2026_autumn',
        title: 'Jesen 2026',
        description:
            'Ostvari potvrđenu sadnju ili berbu od sjemena do stola u jesen 2026. (1. rujna – 30. studenoga).',
        rewardSunflowers: 1_000,
    },
];

function plantingTitle(threshold: number) {
    if (threshold === 1) {
        return 'Prvo sjeme';
    }
    return ` ${threshold} biljaka`;
}

function wateringTitle(threshold: number) {
    if (threshold === 1) {
        return 'Prvo zalijevanje';
    }
    return `${threshold} zalijevanja`;
}

function harvestTitle(threshold: number) {
    if (threshold === 1) {
        return 'Prva berba';
    }
    return `${threshold} berbi`;
}

function communityEditingTitle(threshold: number) {
    switch (threshold) {
        case 1:
            return 'Prvi doprinos';
        case 5:
            return 'Pouzdani urednik';
        case 10:
            return 'Čuvar sadržaja';
        case 25:
            return 'Znalac zajednice';
        case 50:
            return 'Majstor sadržaja';
        default:
            return `${threshold} prihvaćenih izmjena`;
    }
}

function gardenDiversityTitle(threshold: number) {
    switch (threshold) {
        case 3:
            return 'Tri kulture';
        case 5:
            return 'Mali povrtnjak';
        case 10:
            return 'Raznolik vrt';
        case 15:
            return 'Botanička zbirka';
        default:
            return 'Živi vrt';
    }
}

function seedToTableTitle(threshold: number) {
    switch (threshold) {
        case 1:
            return 'Od sjemena do stola';
        case 5:
            return 'Pet punih ciklusa';
        case 10:
            return 'Vrt na stolu';
        case 25:
            return 'Sezonski stol';
        default:
            return 'Majstor uzgoja';
    }
}

const baseDefinitions: Omit<
    AchievementDefinition,
    'familyKey' | 'level' | 'visualGrade' | 'artworkKey'
>[] = [
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
        category: 'planting' as const,
        threshold,
        rewardSunflowers: reward,
        title: plantingTitle(threshold),
        description: `Posadi ${threshold} biljaka u svojim gredicama.`,
        sortOrder: 100 + index,
    })),
    ...wateringThresholds.map(([threshold, reward], index) => ({
        key: `watering_${threshold}`,
        category: 'watering' as const,
        threshold,
        rewardSunflowers: reward,
        title: wateringTitle(threshold),
        description: `Zalij biljke ${threshold} puta.`,
        sortOrder: 200 + index,
    })),
    ...harvestThresholds.map(([threshold, reward], index) => ({
        key: `harvest_${threshold}`,
        category: 'harvest' as const,
        threshold,
        rewardSunflowers: reward,
        title: harvestTitle(threshold),
        description: `Uberi biljke ${threshold} puta.`,
        sortOrder: 300 + index,
    })),
    ...communityEditingThresholds.map(([threshold, reward], index) => ({
        key: `community_edit_${threshold}`,
        category: 'community_editing' as const,
        threshold,
        rewardSunflowers: reward,
        title: communityEditingTitle(threshold),
        description:
            threshold === 1
                ? 'Neka tvoj prvi prijedlog izmjene sadržaja bude prihvaćen.'
                : `Neka ${threshold} tvojih prijedloga izmjene sadržaja bude prihvaćeno.`,
        sortOrder: 400 + index,
    })),
    ...gardenDiversityThresholds.map(([threshold, reward], index) => ({
        key: `garden_diversity_${threshold}`,
        category: 'garden_diversity' as const,
        threshold,
        rewardSunflowers: reward,
        title: gardenDiversityTitle(threshold),
        description: `Posadi ${threshold} ${threshold === 3 ? 'različite vrste' : 'različitih vrsta'} biljaka u svojim gredicama.`,
        sortOrder: 500 + index,
    })),
    ...seedToTableThresholds.map(([threshold, reward], index) => ({
        key: `seed_to_table_${threshold}`,
        category: 'seed_to_table' as const,
        threshold,
        rewardSunflowers: reward,
        title: seedToTableTitle(threshold),
        description:
            threshold === 1
                ? 'Dovedi jednu sadnju od sjetve do berbe.'
                : `Dovedi ${threshold} sadnji od sjetve do berbe.`,
        sortOrder: 600 + index,
    })),
    ...seasonalAwards.map((award, index) => ({
        key: award.key,
        category: 'seasonal' as const,
        rewardSunflowers: award.rewardSunflowers,
        title: award.title,
        description: award.description,
        sortOrder: 700 + index,
    })),
];

export const achievementDefinitions: AchievementDefinition[] =
    baseDefinitions.map((definition) => {
        const presentation = getAchievementPresentation(definition.key);
        if (!presentation)
            throw new Error(
                `Missing achievement presentation: ${definition.key}`,
            );
        return { ...definition, ...presentation };
    });

const definitionsByKey = new Map(
    achievementDefinitions.map((definition) => [definition.key, definition]),
);

export function getAchievementDefinitions() {
    return achievementDefinitions.slice();
}

export function getAchievementDefinition(key: string) {
    return definitionsByKey.get(key);
}
