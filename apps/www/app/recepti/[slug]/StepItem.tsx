'use client';

import { Down } from '@signalco/ui-icons';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Collapse } from '@signalco/ui-primitives/Collapse';
import { DotIndicator } from '@signalco/ui-primitives/DotIndicator';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { Markdown } from '../../../components/shared/Markdown';
import type { Recipe, RecipeStep } from '../../../lib/recipes/getRecipesData';
import { getIngredientDisplayName, getIngredientUnit } from '../../../lib/recipes/nutritionCalculator';
import { StepTimer } from './StepTimer';
import { unitDisplayMap } from './unitDisplayMap';
import { useTimer } from './useTimer';
import { cx } from '@signalco/ui-primitives/cx';

export function StepItem({
    index,
    recipe,
    portionMultiplier,
    step,
    durationScale,
}: {
    index: number;
    recipe: Recipe;
    portionMultiplier: number;
    step: RecipeStep;
    durationScale: number;
}) {
    const [checked, setChecked] = useState(false);
    const [expanded, setExpanded] = useState<boolean | null>(null);
    const {
        timers,
        createTimer,
        startTimer,
        pauseTimer,
        resetTimer,
        removeTimer,
        getTimerByStepId,
    } = useTimer<string>();

    function handleCheckedChange(newChecked: boolean) {
        if (newChecked) {
            if (expanded === null) {
                setExpanded(false);
            }
            pauseTimer(step.shortDescription);
        }

        setChecked(newChecked);
    }

    return (
        <Stack spacing={1} className="grow">
            <Row>
                <Row spacing={2} justifyContent="space-between" className='grow'>
                    <Row spacing={1}>
                        <div className="shrink-0 size-7">
                            <DotIndicator
                                color={checked ? 'success' : 'warning'}
                                size={28}
                                content={<span>{`${index + 1}`}</span>}
                            />
                        </div>
                        <Checkbox
                            label={
                                <Typography level="body1" className={cx(checked && 'line-through')}>
                                    {step.shortDescription}
                                </Typography>
                            }
                            className="bg-card"
                            checked={checked}
                            onCheckedChange={handleCheckedChange}
                        />
                    </Row>
                    {step.timeMinutes && (
                        <StepTimer
                            stepId={step.shortDescription}
                            duration={step.timeMinutes * durationScale}
                            disabled={!step.timer}
                            onTimerCreate={createTimer}
                            onTimerStart={startTimer}
                            onTimerPause={pauseTimer}
                            onTimerReset={resetTimer}
                            onTimerRemove={removeTimer}
                            timer={getTimerByStepId(step.shortDescription)}
                        />
                    )}
                </Row>
                {(step.description ||
                    (step.ingredientsUsed?.length ?? 0) > 0) &&
                    expanded !== null && (
                        <IconButton
                            title={expanded ? 'Sakrij opis' : 'Prikaži opis'}
                            variant="plain"
                            size="sm"
                            onClick={() => setExpanded((prev) => !prev)}
                        >
                            <Down className={expanded ? 'rotate-180' : ''} />
                        </IconButton>
                    )}
            </Row>
            {(step.description || (step.ingredientsUsed?.length ?? 0) > 0) && (
                <Collapse appear={expanded ?? true}>
                    <div className="pl-4 border-l ml-3.5">
                        <Stack>
                            {(step.ingredientsUsed?.length ?? 0) > 0 && (
                                <Stack>
                                    {step.ingredientsUsed?.map((ingredient) => {
                                        const ingredientData =
                                            recipe.ingredients.find(
                                                (ing) =>
                                                    ing.id === ingredient.id,
                                            );
                                        if (!ingredientData) return null;
                                        
                                        const ingredientInfo = getIngredientUnit(ingredientData);
                                        const ingredientName = getIngredientDisplayName(ingredientData);
                                        
                                        const quantity =
                                            (ingredientData?.quantity ?? 0) *
                                            (ingredient.quantityMultiplier ??
                                                1) *
                                            portionMultiplier;
                                        const approximateQuantity =
                                            (ingredientInfo.approximateQuantity ||
                                                0) *
                                            (ingredient.quantityMultiplier ??
                                                1) *
                                            portionMultiplier;
                                        return (
                                            <ListItem
                                                key={ingredient.id}
                                                label={
                                                    <Typography level="body2">
                                                        • {quantity}{' '}
                                                        {unitDisplayMap[
                                                            ingredientInfo.unit
                                                        ] ??
                                                            ingredientInfo.unit}{' '}
                                                        {ingredientName}
                                                        {ingredientInfo.approximateQuantity
                                                            ? ` (~${approximateQuantity} ${
                                                                  unitDisplayMap[
                                                                      ingredientInfo.approximateQuantityUnit ||
                                                                          ''
                                                                  ] ??
                                                                  ingredientInfo.approximateQuantityUnit
                                                              })`
                                                            : ''}
                                                    </Typography>
                                                }
                                            />
                                        );
                                    })}
                                </Stack>
                            )}
                            {step.description && (
                                <Markdown>{step.description}</Markdown>
                            )}
                        </Stack>
                    </div>
                </Collapse>
            )}
        </Stack>
    );
}
