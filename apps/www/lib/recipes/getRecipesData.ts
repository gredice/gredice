import { unstable_cache } from 'next/cache';

export interface RecipeStep {
    shortDescription: string;
    description?: string;
    timeMinutes?: number;
    timer?: boolean;
    portionDurationScale?: number;
    ingredientsUsed?: { id: string; quantityMultiplier?: number }[];
}

export interface RecipeIngredient {
    id: string;
    quantity: number;
    /** When linking to ingredient data source, these fields are optional */
    name?: string;
    unit?: 'pcs' | 'g' | 'ml' | 'tsp' | 'tbsp';
    approximateQuantity?: number;
    approximateQuantityUnit?: 'pcs' | 'g' | 'ml' | 'tsp' | 'tbsp';
    /** Set to true if ingredient is from data source and has nutrition info */
    isLinked?: boolean;
}

export interface Recipe {
    id: string;
    slug: string;
    title: string;
    description: string;
    portions: number;
    ingredients: RecipeIngredient[];
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
            {
                id: 'rajcica',
                quantity: 300,
                isLinked: true,
            },
            {
                id: 'mozzarella',
                quantity: 100,
                isLinked: true,
            },
            {
                id: 'svjezi-bosiljak',
                quantity: 10,
                isLinked: true,
            },
            {
                id: 'maslinovo-ulje',
                quantity: 15,
                isLinked: true,
            },
        ],
        steps: [
            {
                shortDescription: 'Nareži rajčice i mozzarellu',
                description:
                    'Nareži rajčice i mozzarellu na tanke ploške iste debljine.\n\nPloške slaži na tanjur naizmjenično.',
                timeMinutes: 5,
                ingredientsUsed: [{ id: 'rajcica' }, { id: 'mozzarella' }],
            },
            {
                shortDescription: 'Dodaj bosiljak i maslinovo ulje',
                description:
                    'Dodaj svježi bosiljak i maslinovo ulje preko narezanih rajčica i mozzarelle.',
                timeMinutes: 3,
                ingredientsUsed: [
                    { id: 'svjezi-bosiljak' },
                    { id: 'maslinovo-ulje' },
                ],
            },
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
            {
                id: 'mrkva',
                quantity: 4,
                isLinked: true,
            },
            {
                id: 'med',
                quantity: 30,
                isLinked: true,
            },
            {
                id: 'timijan',
                name: 'Timijan',
                quantity: 5,
                unit: 'g',
                isLinked: false,
            },
        ],
        steps: [
            {
                shortDescription: 'Očisti i nareži mrkvu.',
                timeMinutes: 5,
                ingredientsUsed: [{ id: 'mrkva' }],
            },
            {
                shortDescription: 'Pomiješaj s medom i timijanom',
                timeMinutes: 1,
                ingredientsUsed: [{ id: 'med' }, { id: 'timijan' }],
            },
            {
                shortDescription: 'Peci na 200°C oko 25 minuta',
                timeMinutes: 25,
                timer: true,
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
            {
                id: 'krastavac',
                quantity: 1,
                isLinked: true,
            },
            {
                id: 'jogurt',
                quantity: 100,
                isLinked: true,
            },
            {
                id: 'kopar',
                name: 'Kopar',
                quantity: 5,
                unit: 'g',
                isLinked: false,
            },
        ],
        steps: [
            {
                shortDescription: 'Nareži krastavac',
                timeMinutes: 5,
                ingredientsUsed: [{ id: 'krastavac' }],
            },
            {
                shortDescription: 'Pomiješaj s jogurtom i koprom',
                timeMinutes: 2,
                ingredientsUsed: [{ id: 'jogurt' }, { id: 'kopar' }],
            },
        ],
    },
];

export const getRecipesData = unstable_cache(
    async () => recipes,
    ['recipesData'],
    { revalidate: 60 * 60, tags: ['recipesData'] },
);
