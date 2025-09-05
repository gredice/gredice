'use client';

import { Share } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Container } from '@signalco/ui-primitives/Container';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import type { Recipe } from '../../../lib/recipes/getRecipesData';
import { IngredientItem } from './IngredientItem';
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
        }
    }

    return (
        <Stack spacing={4} className="py-8">
            <Row spacing={2} className="justify-end">
                <WakeLock />
                {!!navigator.share && (
                    <Button
                        variant="plain"
                        onClick={shareRecipe}
                        startDecorator={<Share className="size-4 shrink-0" />}
                    >
                        Podijeli
                    </Button>
                )}
            </Row>
            <Stack spacing={2}>
                <Typography level="h2" component="h1">
                    {recipe.title}
                </Typography>
                <Typography level="body1">{recipe.description}</Typography>
            </Stack>
            <Input
                label="Broj porcija"
                type="number"
                value={portions}
                min={1}
                className="w-20 bg-card"
                onChange={(e) => setPortions(Number(e.target.value) || 1)}
            />
            <div className="grid gap-8 md:grid-cols-[1fr_3fr]">
                <Stack spacing={2}>
                    <Row justifyContent="space-between">
                        <Typography level="h4" component="h2">
                            Namirnice
                        </Typography>
                        <Chip
                            color={
                                checkedIngredients.length ===
                                recipe.ingredients.length
                                    ? 'success'
                                    : 'neutral'
                            }
                        >
                            {checkedIngredients.length} /{' '}
                            {recipe.ingredients.length}
                        </Chip>
                    </Row>
                    {recipe.ingredients.map((ingredient) => (
                        <IngredientItem
                            key={ingredient.name}
                            ingredient={ingredient}
                            portionMultiplier={multiplier}
                        />
                    ))}
                </Stack>
                <Stack spacing={2}>
                    <Row justifyContent="space-between">
                        <Typography level="h4" component="h2">
                            Koraci
                        </Typography>
                        <Chip
                            color={
                                checkedSteps.length === recipe.steps.length
                                    ? 'success'
                                    : 'neutral'
                            }
                        >
                            {checkedSteps.length} / {recipe.steps.length}
                        </Chip>
                    </Row>
                    {recipe.steps.map((step, stepIndex) => (
                        <StepItem
                            key={step.shortDescription}
                            index={stepIndex}
                            step={step}
                            durationScale={1}
                        />
                    ))}
                </Stack>
            </div>
        </Stack>
    );
}
