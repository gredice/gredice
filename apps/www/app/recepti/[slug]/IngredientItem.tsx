import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import type { Recipe } from '../../../lib/recipes/getRecipesData';

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

    return (
        <Checkbox
            key={ingredient.name}
            className="bg-card"
            checked={checked}
            onCheckedChange={handleIngredientCheckChange}
            label={
                <Typography level="body1">
                    {value} {unit} {ingredient.name}
                    {ingredient.approximateQuantity
                        ? ` (~${(ingredient.approximateQuantity || 0) * portionMultiplier} ${ingredient.approximateQuantityUnit || ''})`
                        : ''}
                </Typography>
            }
        />
    );
}
