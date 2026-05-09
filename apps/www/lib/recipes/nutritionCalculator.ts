import { getIngredientById, type NutrientInfo } from './getIngredientsData';
import type { Recipe, RecipeIngredient } from './getRecipesData';

export interface RecipeNutrition extends NutrientInfo {
    /** Ingredients that don't have nutrition data */
    missingNutritionIngredients: string[];
    /** Whether nutrition data is complete */
    isComplete: boolean;
}

/**
 * Calculate nutrition for a single ingredient
 */
export function calculateIngredientNutrition(
    ingredient: RecipeIngredient,
    portionMultiplier: number = 1,
): { nutrition: NutrientInfo | null; ingredientName: string } {
    const dataSourceIngredient = ingredient.isLinked
        ? getIngredientById(ingredient.id)
        : null;

    if (!dataSourceIngredient?.nutrition) {
        return {
            nutrition: null,
            ingredientName: ingredient.name || ingredient.id,
        };
    }

    const actualQuantity = ingredient.quantity * portionMultiplier;
    const quantityIn100g = actualQuantity / 100; // Convert to per 100g base

    return {
        nutrition: {
            calories: Math.round(
                dataSourceIngredient.nutrition.calories * quantityIn100g,
            ),
            protein:
                Math.round(
                    dataSourceIngredient.nutrition.protein *
                        quantityIn100g *
                        10,
                ) / 10,
            carbs:
                Math.round(
                    dataSourceIngredient.nutrition.carbs * quantityIn100g * 10,
                ) / 10,
            fat:
                Math.round(
                    dataSourceIngredient.nutrition.fat * quantityIn100g * 10,
                ) / 10,
            fiber:
                Math.round(
                    dataSourceIngredient.nutrition.fiber * quantityIn100g * 10,
                ) / 10,
            sugar: dataSourceIngredient.nutrition.sugar
                ? Math.round(
                      dataSourceIngredient.nutrition.sugar *
                          quantityIn100g *
                          10,
                  ) / 10
                : undefined,
            sodium: dataSourceIngredient.nutrition.sodium
                ? Math.round(
                      dataSourceIngredient.nutrition.sodium * quantityIn100g,
                  )
                : undefined,
        },
        ingredientName: dataSourceIngredient.name,
    };
}

/**
 * Calculate total nutrition for a recipe
 */
export function calculateRecipeNutrition(
    recipe: Recipe,
    portionMultiplier: number = 1,
): RecipeNutrition {
    const totals: NutrientInfo = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
    };

    const missingNutritionIngredients: string[] = [];

    for (const ingredient of recipe.ingredients) {
        const { nutrition, ingredientName } = calculateIngredientNutrition(
            ingredient,
            portionMultiplier,
        );

        if (!nutrition) {
            missingNutritionIngredients.push(ingredientName);
            continue;
        }

        totals.calories += nutrition.calories;
        totals.protein += nutrition.protein;
        totals.carbs += nutrition.carbs;
        totals.fat += nutrition.fat;
        totals.fiber += nutrition.fiber;

        if (nutrition.sugar !== undefined && totals.sugar !== undefined) {
            totals.sugar += nutrition.sugar;
        } else if (nutrition.sugar === undefined) {
            totals.sugar = undefined;
        }

        if (nutrition.sodium !== undefined && totals.sodium !== undefined) {
            totals.sodium += nutrition.sodium;
        } else if (nutrition.sodium === undefined) {
            totals.sodium = undefined;
        }
    }

    // Round final values
    totals.protein = Math.round(totals.protein * 10) / 10;
    totals.carbs = Math.round(totals.carbs * 10) / 10;
    totals.fat = Math.round(totals.fat * 10) / 10;
    totals.fiber = Math.round(totals.fiber * 10) / 10;
    if (totals.sugar !== undefined) {
        totals.sugar = Math.round(totals.sugar * 10) / 10;
    }

    return {
        ...totals,
        missingNutritionIngredients,
        isComplete: missingNutritionIngredients.length === 0,
    };
}

/**
 * Get display name for an ingredient (either from data source or inline)
 */
export function getIngredientDisplayName(ingredient: RecipeIngredient): string {
    if (ingredient.isLinked) {
        const dataSourceIngredient = getIngredientById(ingredient.id);
        return dataSourceIngredient?.name || ingredient.id;
    }
    return ingredient.name || ingredient.id;
}

/**
 * Get unit information for an ingredient
 */
export function getIngredientUnit(ingredient: RecipeIngredient): {
    unit: string;
    approximateQuantity?: number;
    approximateQuantityUnit?: string;
} {
    if (ingredient.isLinked) {
        const dataSourceIngredient = getIngredientById(ingredient.id);
        return {
            unit: dataSourceIngredient?.unit || 'g',
            approximateQuantity: dataSourceIngredient?.approximateQuantity,
            approximateQuantityUnit:
                dataSourceIngredient?.approximateQuantityUnit,
        };
    }
    return {
        unit: ingredient.unit || 'g',
        approximateQuantity: ingredient.approximateQuantity,
        approximateQuantityUnit: ingredient.approximateQuantityUnit,
    };
}
