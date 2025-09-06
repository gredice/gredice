'use client';

import { Share } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { Progress } from '../../../../../packages/game/src/controls/components/Progress';
import type { Recipe } from '../../../lib/recipes/getRecipesData';
import { IngredientItem } from './IngredientItem';
import { NutritionDisplay } from './NutritionDisplay';
import { PortionPicker } from './PortionPicker';
import { StepItem } from './StepItem';
import { WakeLock } from './WakeLock';

// TODO: Confirm portion change if any of the ingredients or steps are checked (so user doesn't change portion by accident mid cooking)

export function RecipeView({ recipe }: { recipe: Recipe }) {
    const [portions, setPortions] = useState(recipe.portions);
    const multiplier = portions / recipe.portions;

    // TODO: Use store for state
    const checkedIngredients: string[] = [];
    const checkedSteps: string[] = [];

    async function shareRecipe() {
        try {
            await navigator.share?.({
                title: recipe.title,
                text: recipe.description,
                url: window.location.href,
            });
        } catch {
            // ignore
            // TODO: Implement fallback for sharing eg. copy to clipboard
        }
    }

    const numberOfIngredients = recipe.ingredients.length;
    const totalTime = recipe.steps.reduce(
        (sum, step) => sum + (step.timeMinutes || 0),
        0,
    );

    return (
        <Stack spacing={4} className="py-8">
            <Row spacing={2} className="justify-end">
                <WakeLock />
                <Button
                    variant="plain"
                    onClick={shareRecipe}
                    startDecorator={<Share className="size-4 shrink-0" />}
                >
                    Podijeli
                </Button>
            </Row>
            <Stack spacing={2}>
                <Typography level="h2" component="h1">
                    {recipe.title}
                </Typography>
                <Typography level="body1">{recipe.description}</Typography>
            </Stack>
            <PortionPicker value={portions} onChange={setPortions} />
            <div className="grid gap-8 md:grid-cols-[1fr_2fr_1fr]">
                <Stack spacing={2}>
                    <Stack alignItems="center">
                        <Typography level="h4">
                            {numberOfIngredients}
                        </Typography>
                        <Typography level="body1">
                            {numberOfIngredients === 1
                                ? 'Sastojak'
                                : 'Sastojaka'}
                        </Typography>
                    </Stack>
                    <div className="relative">
                        <Progress
                            value={
                                (checkedIngredients.length /
                                    recipe.ingredients.length) *
                                100
                            }
                            className="border"
                        />
                        <Typography className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-semibold text-sm">
                            {checkedIngredients.length} /{' '}
                            {recipe.ingredients.length}
                        </Typography>
                    </div>
                    {recipe.ingredients.map((ingredient) => (
                        <IngredientItem
                            key={ingredient.name}
                            ingredient={ingredient}
                            portionMultiplier={multiplier}
                        />
                    ))}
                </Stack>
                <Stack spacing={2}>
                    <Stack alignItems="center">
                        <Typography level="h4" component="h2">
                            {totalTime} min
                        </Typography>
                        <Typography level="body1">Priprema</Typography>
                    </Stack>
                    <div className="relative">
                        <Progress
                            value={
                                (checkedSteps.length / recipe.steps.length) *
                                100
                            }
                            className="border"
                        />
                        <Typography className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-semibold text-sm">
                            {checkedSteps.length} / {recipe.steps.length}
                        </Typography>
                    </div>
                    {recipe.steps.map((step, stepIndex) => (
                        <StepItem
                            key={step.shortDescription}
                            index={stepIndex}
                            recipe={recipe}
                            portionMultiplier={multiplier}
                            step={step}
                            durationScale={1}
                        />
                    ))}
                </Stack>
                <Stack spacing={2}>
                    <Stack alignItems="center">
                        <Typography level="h4" component="h2">
                            Nutrijenti
                        </Typography>
                        <Typography level="body1">Po porciji / Ukupno</Typography>
                    </Stack>
                    <NutritionDisplay recipe={recipe} portionMultiplier={multiplier} />
                </Stack>
            </div>
        </Stack>
    );
}
