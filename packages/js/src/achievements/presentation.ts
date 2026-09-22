import type { AchievementCategory } from './definitions';

export type AchievementVisualGrade =
    | 'first_steps'
    | 'growing'
    | 'experienced'
    | 'mastery'
    | 'legendary';

const presentation = {
    registration: {
        familyKey: 'registration',
        level: 1,
        visualGrade: 'first_steps',
    },
    planting_1: { familyKey: 'planting', level: 1, visualGrade: 'first_steps' },
    planting_10: {
        familyKey: 'planting',
        level: 2,
        visualGrade: 'first_steps',
    },
    planting_20: { familyKey: 'planting', level: 3, visualGrade: 'growing' },
    planting_50: { familyKey: 'planting', level: 4, visualGrade: 'growing' },
    planting_100: {
        familyKey: 'planting',
        level: 5,
        visualGrade: 'experienced',
    },
    planting_150: {
        familyKey: 'planting',
        level: 6,
        visualGrade: 'experienced',
    },
    planting_200: { familyKey: 'planting', level: 7, visualGrade: 'mastery' },
    planting_300: { familyKey: 'planting', level: 8, visualGrade: 'mastery' },
    planting_500: { familyKey: 'planting', level: 9, visualGrade: 'legendary' },
    watering_1: { familyKey: 'watering', level: 1, visualGrade: 'first_steps' },
    watering_10: {
        familyKey: 'watering',
        level: 2,
        visualGrade: 'first_steps',
    },
    watering_20: { familyKey: 'watering', level: 3, visualGrade: 'growing' },
    watering_50: { familyKey: 'watering', level: 4, visualGrade: 'growing' },
    watering_100: {
        familyKey: 'watering',
        level: 5,
        visualGrade: 'experienced',
    },
    watering_150: {
        familyKey: 'watering',
        level: 6,
        visualGrade: 'experienced',
    },
    watering_200: { familyKey: 'watering', level: 7, visualGrade: 'mastery' },
    watering_300: { familyKey: 'watering', level: 8, visualGrade: 'mastery' },
    watering_500: { familyKey: 'watering', level: 9, visualGrade: 'legendary' },
    harvest_1: { familyKey: 'harvest', level: 1, visualGrade: 'first_steps' },
    harvest_10: { familyKey: 'harvest', level: 2, visualGrade: 'first_steps' },
    harvest_20: { familyKey: 'harvest', level: 3, visualGrade: 'growing' },
    harvest_50: { familyKey: 'harvest', level: 4, visualGrade: 'growing' },
    harvest_100: { familyKey: 'harvest', level: 5, visualGrade: 'experienced' },
    harvest_150: { familyKey: 'harvest', level: 6, visualGrade: 'experienced' },
    harvest_200: { familyKey: 'harvest', level: 7, visualGrade: 'mastery' },
    harvest_300: { familyKey: 'harvest', level: 8, visualGrade: 'mastery' },
    harvest_500: { familyKey: 'harvest', level: 9, visualGrade: 'legendary' },
    community_edit_1: {
        familyKey: 'community_editing',
        level: 1,
        visualGrade: 'first_steps',
    },
    community_edit_5: {
        familyKey: 'community_editing',
        level: 2,
        visualGrade: 'growing',
    },
    community_edit_10: {
        familyKey: 'community_editing',
        level: 3,
        visualGrade: 'experienced',
    },
    community_edit_25: {
        familyKey: 'community_editing',
        level: 4,
        visualGrade: 'mastery',
    },
    community_edit_50: {
        familyKey: 'community_editing',
        level: 5,
        visualGrade: 'mastery',
    },
    community_edit_100: {
        familyKey: 'community_editing',
        level: 6,
        visualGrade: 'legendary',
    },
    garden_diversity_3: {
        familyKey: 'garden_diversity',
        level: 1,
        visualGrade: 'first_steps',
    },
    garden_diversity_5: {
        familyKey: 'garden_diversity',
        level: 2,
        visualGrade: 'growing',
    },
    garden_diversity_10: {
        familyKey: 'garden_diversity',
        level: 3,
        visualGrade: 'experienced',
    },
    garden_diversity_15: {
        familyKey: 'garden_diversity',
        level: 4,
        visualGrade: 'mastery',
    },
    garden_diversity_20: {
        familyKey: 'garden_diversity',
        level: 5,
        visualGrade: 'legendary',
    },
    seed_to_table_1: {
        familyKey: 'seed_to_table',
        level: 1,
        visualGrade: 'first_steps',
    },
    seed_to_table_5: {
        familyKey: 'seed_to_table',
        level: 2,
        visualGrade: 'growing',
    },
    seed_to_table_10: {
        familyKey: 'seed_to_table',
        level: 3,
        visualGrade: 'experienced',
    },
    seed_to_table_25: {
        familyKey: 'seed_to_table',
        level: 4,
        visualGrade: 'mastery',
    },
    seed_to_table_50: {
        familyKey: 'seed_to_table',
        level: 5,
        visualGrade: 'legendary',
    },
    watering_750: {
        familyKey: 'watering',
        level: 10,
        visualGrade: 'legendary',
    },
    watering_1000: {
        familyKey: 'watering',
        level: 11,
        visualGrade: 'legendary',
    },
    watering_1500: {
        familyKey: 'watering',
        level: 12,
        visualGrade: 'legendary',
    },
    watering_2000: {
        familyKey: 'watering',
        level: 13,
        visualGrade: 'legendary',
    },
    community_edit_150: {
        familyKey: 'community_editing',
        level: 7,
        visualGrade: 'legendary',
    },
    community_edit_200: {
        familyKey: 'community_editing',
        level: 8,
        visualGrade: 'legendary',
    },
    community_edit_300: {
        familyKey: 'community_editing',
        level: 9,
        visualGrade: 'legendary',
    },
    community_edit_500: {
        familyKey: 'community_editing',
        level: 10,
        visualGrade: 'legendary',
    },
    community_edit_750: {
        familyKey: 'community_editing',
        level: 11,
        visualGrade: 'legendary',
    },
    community_edit_1000: {
        familyKey: 'community_editing',
        level: 12,
        visualGrade: 'legendary',
    },
    community_edit_1500: {
        familyKey: 'community_editing',
        level: 13,
        visualGrade: 'legendary',
    },
    garden_diversity_25: {
        familyKey: 'garden_diversity',
        level: 6,
        visualGrade: 'legendary',
    },
    garden_diversity_30: {
        familyKey: 'garden_diversity',
        level: 7,
        visualGrade: 'legendary',
    },
    garden_diversity_35: {
        familyKey: 'garden_diversity',
        level: 8,
        visualGrade: 'legendary',
    },
    garden_diversity_40: {
        familyKey: 'garden_diversity',
        level: 9,
        visualGrade: 'legendary',
    },
    garden_diversity_45: {
        familyKey: 'garden_diversity',
        level: 10,
        visualGrade: 'legendary',
    },
    seed_to_table_75: {
        familyKey: 'seed_to_table',
        level: 6,
        visualGrade: 'legendary',
    },
    seed_to_table_100: {
        familyKey: 'seed_to_table',
        level: 7,
        visualGrade: 'legendary',
    },
    seed_to_table_150: {
        familyKey: 'seed_to_table',
        level: 8,
        visualGrade: 'legendary',
    },
    seed_to_table_200: {
        familyKey: 'seed_to_table',
        level: 9,
        visualGrade: 'legendary',
    },
    seed_to_table_300: {
        familyKey: 'seed_to_table',
        level: 10,
        visualGrade: 'legendary',
    },
    season_2026_spring: {
        familyKey: 'seasonal',
        level: 1,
        visualGrade: 'first_steps',
    },
    season_2026_summer: {
        familyKey: 'seasonal',
        level: 2,
        visualGrade: 'growing',
    },
    season_2026_autumn: {
        familyKey: 'seasonal',
        level: 3,
        visualGrade: 'experienced',
    },
} satisfies Record<
    string,
    {
        familyKey: AchievementCategory;
        level: number;
        visualGrade: AchievementVisualGrade;
    }
>;

export type AchievementArtworkKey = keyof typeof presentation;

function isArtworkKey(key: string): key is AchievementArtworkKey {
    return Object.hasOwn(presentation, key);
}

export function getAchievementPresentation(key: string) {
    if (!isArtworkKey(key)) return undefined;
    return { ...presentation[key], artworkKey: key };
}

const levelNumerals = [
    'I',
    'II',
    'III',
    'IV',
    'V',
    'VI',
    'VII',
    'VIII',
    'IX',
    'X',
    'XI',
    'XII',
    'XIII',
];
export function formatAchievementLevel(level: number) {
    return levelNumerals[level - 1] ?? String(level);
}
