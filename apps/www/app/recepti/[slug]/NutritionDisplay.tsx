'use client';

import { Alert } from '@signalco/ui/Alert';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Tabs, TabsList, TabsTrigger } from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import type { Recipe } from '../../../lib/recipes/getRecipesData';
import { calculateRecipeNutrition } from '../../../lib/recipes/nutritionCalculator';

interface NutritionDisplayProps {
    recipe: Recipe;
    portionMultiplier: number;
}

export function NutritionDisplay({
    recipe,
    portionMultiplier,
}: NutritionDisplayProps) {
    const [showPerPortion, setShowPerPortion] = useState(true);

    const totalNutrition = calculateRecipeNutrition(recipe, portionMultiplier);
    const perPortionNutrition = calculateRecipeNutrition(
        recipe,
        portionMultiplier / recipe.portions,
    );

    const displayNutrition = showPerPortion
        ? perPortionNutrition
        : totalNutrition;

    return (
        <Stack spacing={2}>
            <Tabs defaultValue="perPortion" className="self-center">
                <TabsList>
                    <TabsTrigger
                        value="perPortion"
                        onClick={() => setShowPerPortion(true)}
                    >
                        Po porciji
                    </TabsTrigger>
                    <TabsTrigger
                        value="total"
                        onClick={() => setShowPerPortion(false)}
                    >
                        Ukupno
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {!displayNutrition.isComplete && (
                <Alert color="warning">
                    <Stack spacing={1}>
                        <Typography level="body2" semiBold>
                            Podaci o nutrijentima nisu potpuni
                        </Typography>
                        <Typography level="body2">
                            Sljedeći sastojci nemaju dostupne podatke o
                            nutrijentima:{' '}
                            {displayNutrition.missingNutritionIngredients.join(
                                ', ',
                            )}
                        </Typography>
                    </Stack>
                </Alert>
            )}

            <Card>
                <CardContent noHeader>
                    <Stack spacing={2}>
                        <NutrientRow
                            label="Kalorije"
                            value={displayNutrition.calories}
                            unit="kcal"
                        />
                        <NutrientRow
                            label="Proteini"
                            value={displayNutrition.protein}
                            unit="g"
                        />
                        <NutrientRow
                            label="Ugljikohidrati"
                            value={displayNutrition.carbs}
                            unit="g"
                        />
                        <NutrientRow
                            label="Masti"
                            value={displayNutrition.fat}
                            unit="g"
                        />
                        <NutrientRow
                            label="Vlakna"
                            value={displayNutrition.fiber}
                            unit="g"
                        />
                        {displayNutrition.sugar !== undefined && (
                            <NutrientRow
                                label="Šećeri"
                                value={displayNutrition.sugar}
                                unit="g"
                            />
                        )}
                        {displayNutrition.sodium !== undefined && (
                            <NutrientRow
                                label="Natrij"
                                value={displayNutrition.sodium}
                                unit="mg"
                            />
                        )}
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}

function NutrientRow({
    label,
    value,
    unit,
}: {
    label: string;
    value: number;
    unit: string;
}) {
    return (
        <Row className="justify-between">
            <Typography level="body2">{label}</Typography>
            <Typography level="body2" semiBold>
                {value} {unit}
            </Typography>
        </Row>
    );
}
