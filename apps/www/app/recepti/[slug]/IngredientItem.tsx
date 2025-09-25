import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { cx } from '@signalco/ui-primitives/cx';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import type { RecipeIngredient } from '../../../lib/recipes/getRecipesData';
import {
    getIngredientDisplayName,
    getIngredientUnit,
} from '../../../lib/recipes/nutritionCalculator';
import { unitDisplayMap } from './unitDisplayMap';

export function IngredientItem({
    ingredient,
    portionMultiplier,
}: {
    ingredient: RecipeIngredient;
    portionMultiplier: number;
}) {
    const [checked, setChecked] = useState(false);

    const ingredientInfo = getIngredientUnit(ingredient);
    const ingredientName = getIngredientDisplayName(ingredient);

    const { unit, value } = {
        unit: ingredientInfo.unit,
        value: ingredient.quantity * portionMultiplier,
    };

    function handleIngredientCheckChange(checked: boolean) {
        setChecked(checked);
    }

    const unitDisplay = unitDisplayMap[unit] ?? unit;
    const approximateQuantityUnitDisplay =
        unitDisplayMap[ingredientInfo.approximateQuantityUnit || ''] ??
        ingredientInfo.approximateQuantityUnit;

    return (
        <Checkbox
            key={ingredientName}
            className="bg-card"
            checked={checked}
            onCheckedChange={handleIngredientCheckChange}
            label={
                <Typography
                    level="body1"
                    className={cx(checked && 'line-through')}
                >
                    {value} {unitDisplay} {ingredientName}
                    {ingredientInfo.approximateQuantity
                        ? ` (~${(ingredientInfo.approximateQuantity || 0) * portionMultiplier} ${approximateQuantityUnitDisplay})`
                        : ''}
                </Typography>
            }
        />
    );
}
