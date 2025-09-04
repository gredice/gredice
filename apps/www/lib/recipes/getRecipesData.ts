import { unstable_cache } from 'next/cache';

export interface RecipeStep {
    description: string;
    timeMinutes?: number;
}

export interface Recipe {
    id: string;
    slug: string;
    title: string;
    description: string;
    portions: number;
    ingredients: {
        name: string;
        quantity: number;
        unit: string;
    }[];
    steps: RecipeStep[];
    plants: string[]; // names of plants used
}

const recipes: Recipe[] = [
    {
        id: 'caprese-salata',
        slug: 'caprese-salata',
        title: 'Caprese salata',
        description: 'Osvježavajuća salata od rajčica i bosiljka.',
        portions: 2,
        plants: ['Rajčica', 'Bosiljak'],
        ingredients: [
            { name: 'Rajčica', quantity: 2, unit: 'pcs' },
            { name: 'Mozzarella', quantity: 100, unit: 'g' },
            { name: 'Svjež bosiljak', quantity: 10, unit: 'g' },
            { name: 'Maslinovo ulje', quantity: 15, unit: 'ml' },
        ],
        steps: [
            { description: 'Nareži rajčice i mozzarellu.', timeMinutes: 5 },
            { description: 'Dodaj bosiljak i maslinovo ulje.', timeMinutes: 3 },
        ],
    },
    {
        id: 'pecena-mrkva',
        slug: 'pecena-mrkva',
        title: 'Pečena mrkva s medom',
        description: 'Slatka pečena mrkva s medom i timijanom.',
        portions: 4,
        plants: ['Mrkva'],
        ingredients: [
            { name: 'Mrkva', quantity: 500, unit: 'g' },
            { name: 'Med', quantity: 30, unit: 'g' },
            { name: 'Timijan', quantity: 5, unit: 'g' },
        ],
        steps: [
            { description: 'Očisti i nareži mrkvu.', timeMinutes: 10 },
            {
                description: 'Pomiješaj s medom i timijanom te peci.',
                timeMinutes: 25,
            },
        ],
    },
    {
        id: 'salata-od-krastavaca',
        slug: 'salata-od-krastavaca',
        title: 'Salata od krastavaca',
        description: 'Jednostavna salata od svježih krastavaca.',
        portions: 2,
        plants: ['Krastavac'],
        ingredients: [
            { name: 'Krastavac', quantity: 1, unit: 'pcs' },
            { name: 'Jogurt', quantity: 100, unit: 'g' },
            { name: 'Kopar', quantity: 5, unit: 'g' },
        ],
        steps: [
            { description: 'Nareži krastavac.', timeMinutes: 5 },
            { description: 'Pomiješaj s jogurtom i koprom.', timeMinutes: 2 },
        ],
    },
];

export const getRecipesData = unstable_cache(
    async () => recipes,
    ['recipesData'],
    { revalidate: 60 * 60, tags: ['recipesData'] },
);
