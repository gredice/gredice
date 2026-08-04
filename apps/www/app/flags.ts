import { booleanFlagOptions } from '@gredice/js/featureFlags';
import { flag } from 'flags/next';

function isDevelopmentEnvironment() {
    return process.env.NODE_ENV === 'development';
}

export const proceduralPlantsFlag = flag<boolean>({
    key: 'proceduralPlants',
    description: 'Enable procedural plant content rendering.',
    decide: () => false,
    options: booleanFlagOptions,
});

export const blockGeometryMergingFlag = flag<boolean>({
    key: 'blockGeometryMerging',
    description: 'Enable merged geometry chunks for stable terrain blocks.',
    decide: () => true,
    options: booleanFlagOptions,
});

export const recipesFlag = flag<boolean>({
    key: 'recipes',
    description: 'Enable recipes pages and recipe detail routes.',
    decide: () => isDevelopmentEnvironment(),
    options: booleanFlagOptions,
});
