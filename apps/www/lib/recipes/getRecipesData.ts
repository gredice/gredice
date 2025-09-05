import { unstable_cache } from 'next/cache';

export interface RecipeStep {
    shortDescription: string;
    description?: string;
    timeMinutes?: number;
    timer?: boolean;
    portionDurationScale?: number;
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
        unit: 'pcs' | 'g' | 'ml' | 'tsp' | 'tbsp';
        approximateQuantity?: number;
        approximateQuantityUnit?: 'g' | 'ml' | 'tsp' | 'tbsp';
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
            {
                name: 'Rajčica',
                quantity: 2,
                unit: 'pcs',
                approximateQuantity: 150,
                approximateQuantityUnit: 'g',
            },
            { name: 'Mozzarella', quantity: 100, unit: 'g' },
            { name: 'Svjež bosiljak', quantity: 10, unit: 'g' },
            {
                name: 'Maslinovo ulje',
                quantity: 15,
                unit: 'ml',
                approximateQuantity: 1,
                approximateQuantityUnit: 'tbsp',
            },
        ],
        steps: [
            {
                shortDescription: 'Nareži rajčice i mozzarellu',
                description:
                    'Nareži rajčice i mozzarellu na tanke ploške iste debljine.\n\nPloške slaži na tanjur naizmjenično.',
                timeMinutes: 5,
            },
            {
                shortDescription: 'Dodaj bosiljak i maslinovo ulje',
                description:
                    'Dodaj svježi bosiljak i maslinovo ulje preko narezanih rajčica i mozzarelle.',
                timeMinutes: 3,
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
                name: 'Mrkva',
                quantity: 4,
                unit: 'pcs',
                approximateQuantity: 500,
                approximateQuantityUnit: 'g',
            },
            {
                name: 'Med',
                quantity: 30,
                unit: 'g',
                approximateQuantity: 2,
                approximateQuantityUnit: 'tbsp',
            },
            { name: 'Timijan', quantity: 5, unit: 'g' },
        ],
        steps: [
            { shortDescription: 'Očisti i nareži mrkvu.', timeMinutes: 5 },
            {
                shortDescription: 'Pomiješaj s medom i timijanom',
                timeMinutes: 1,
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
                name: 'Krastavac',
                quantity: 1,
                unit: 'pcs',
                approximateQuantity: 200,
                approximateQuantityUnit: 'g',
            },
            { name: 'Jogurt', quantity: 100, unit: 'g' },
            { name: 'Kopar', quantity: 5, unit: 'g' },
        ],
        steps: [
            { shortDescription: 'Nareži krastavac', timeMinutes: 5 },
            {
                shortDescription: 'Pomiješaj s jogurtom i koprom',
                timeMinutes: 2,
            },
        ],
    },
];

export const getRecipesData = unstable_cache(
    async () => recipes,
    ['recipesData'],
    { revalidate: 60 * 60, tags: ['recipesData'] },
);
