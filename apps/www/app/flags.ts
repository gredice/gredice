import { flag } from 'flags/next';

function isDevelopmentEnvironment() {
    return process.env.NODE_ENV === 'development';
}

export const lSystemPlantsFlag = flag<boolean>({
    key: 'lSystemPlants',
    description: 'Enable L-System plants content rendering.',
    decide: () => false,
    options: [
        { label: 'Off', value: false },
        { label: 'On', value: true },
    ],
});

export const recipesFlag = flag<boolean>({
    key: 'recipes',
    description: 'Enable recipes pages and recipe detail routes.',
    decide: () => isDevelopmentEnvironment(),
    options: [
        { label: 'Off', value: false },
        { label: 'On', value: true },
    ],
});
