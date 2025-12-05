import { unstable_cache } from 'next/cache';

export interface NutrientInfo {
    /** Calories per 100g */
    calories: number;
    /** Protein in grams per 100g */
    protein: number;
    /** Total carbohydrates in grams per 100g */
    carbs: number;
    /** Total fat in grams per 100g */
    fat: number;
    /** Fiber in grams per 100g */
    fiber: number;
    /** Sugar in grams per 100g */
    sugar?: number;
    /** Sodium in milligrams per 100g */
    sodium?: number;
}

export interface IngredientDataSource {
    id: string;
    name: string;
    unit: 'pcs' | 'g' | 'ml' | 'tsp' | 'tbsp';
    approximateQuantity?: number;
    approximateQuantityUnit?: 'pcs' | 'g' | 'ml' | 'tsp' | 'tbsp';
    /** Nutrition information per 100g or 100ml */
    nutrition: NutrientInfo;
}

const ingredientsDataSource: IngredientDataSource[] = [
    {
        id: 'rajcica',
        name: 'Rajčica',
        unit: 'g',
        approximateQuantity: 2,
        approximateQuantityUnit: 'pcs',
        nutrition: {
            calories: 18,
            protein: 0.9,
            carbs: 3.9,
            fat: 0.2,
            fiber: 1.2,
            sugar: 2.6,
            sodium: 5,
        },
    },
    {
        id: 'mozzarella',
        name: 'Mozzarella',
        unit: 'g',
        nutrition: {
            calories: 280,
            protein: 28,
            carbs: 3.1,
            fat: 17,
            fiber: 0,
            sugar: 1.2,
            sodium: 373,
        },
    },
    {
        id: 'svjezi-bosiljak',
        name: 'Svjež bosiljak',
        unit: 'g',
        nutrition: {
            calories: 23,
            protein: 3.2,
            carbs: 2.6,
            fat: 0.6,
            fiber: 1.6,
            sugar: 0.3,
            sodium: 4,
        },
    },
    {
        id: 'maslinovo-ulje',
        name: 'Maslinovo ulje',
        unit: 'ml',
        approximateQuantity: 1,
        approximateQuantityUnit: 'tbsp',
        nutrition: {
            calories: 884,
            protein: 0,
            carbs: 0,
            fat: 100,
            fiber: 0,
            sugar: 0,
            sodium: 2,
        },
    },
    {
        id: 'mrkva',
        name: 'Mrkva',
        unit: 'pcs',
        approximateQuantity: 500,
        approximateQuantityUnit: 'g',
        nutrition: {
            calories: 41,
            protein: 0.9,
            carbs: 9.6,
            fat: 0.2,
            fiber: 2.8,
            sugar: 4.7,
            sodium: 69,
        },
    },
    {
        id: 'med',
        name: 'Med',
        unit: 'g',
        approximateQuantity: 2,
        approximateQuantityUnit: 'tbsp',
        nutrition: {
            calories: 304,
            protein: 0.3,
            carbs: 82.4,
            fat: 0,
            fiber: 0.2,
            sugar: 82.1,
            sodium: 4,
        },
    },
    {
        id: 'krastavac',
        name: 'Krastavac',
        unit: 'pcs',
        approximateQuantity: 200,
        approximateQuantityUnit: 'g',
        nutrition: {
            calories: 16,
            protein: 0.7,
            carbs: 4.0,
            fat: 0.1,
            fiber: 0.5,
            sugar: 1.7,
            sodium: 2,
        },
    },
    {
        id: 'jogurt',
        name: 'Jogurt',
        unit: 'g',
        nutrition: {
            calories: 59,
            protein: 10,
            carbs: 3.6,
            fat: 0.4,
            fiber: 0,
            sugar: 3.2,
            sodium: 36,
        },
    },
];

export const getIngredientsData = unstable_cache(
    async () => ingredientsDataSource,
    ['ingredientsData'],
    { revalidate: 60 * 60, tags: ['ingredientsData'] },
);

export function getIngredientById(
    id: string,
): IngredientDataSource | undefined {
    return ingredientsDataSource.find((ingredient) => ingredient.id === id);
}
