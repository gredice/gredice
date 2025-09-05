import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { cx } from '@signalco/ui-primitives/cx';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import type { Recipe } from '../../../lib/recipes/getRecipesData';
import { unitDisplayMap } from './unitDisplayMap';

export function IngredientItem({
    ingredient,
    portionMultiplier,
}: {
    ingredient: Recipe['ingredients'][number];
    portionMultiplier: number;
}) {
    const [checked, setChecked] = useState(false);
    const { unit, value } = {
        unit: ingredient.unit,
        value: ingredient.quantity * portionMultiplier,
    };

    function handleIngredientCheckChange(checked: boolean) {
        setChecked(checked);
    }

    const unitDisplay = unitDisplayMap[unit] ?? unit;
    const approximateQuantityUnitDisplay =
        unitDisplayMap[ingredient.approximateQuantityUnit || ''] ??
        ingredient.approximateQuantityUnit;

    return (
        <Checkbox
            key={ingredient.name}
            className="bg-card"
            checked={checked}
            onCheckedChange={handleIngredientCheckChange}
            label={
                <Typography
                    level="body1"
                    className={cx(checked && 'line-through')}
                >
                    {value} {unitDisplay} {ingredient.name}
                    {ingredient.approximateQuantity
                        ? ` (~${(ingredient.approximateQuantity || 0) * portionMultiplier} ${approximateQuantityUnitDisplay})`
                        : ''}
                </Typography>
            }
        />
    );
}
