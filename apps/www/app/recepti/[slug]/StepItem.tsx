'use client';

import { Down } from '@signalco/ui-icons';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Chip } from '@signalco/ui-primitives/Chip';
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
import { StepTimer } from './StepTimer';
import { unitDisplayMap } from './unitDisplayMap';
import { useTimer } from './useTimer';

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
        <Row alignItems="start" spacing={1}>
            <DotIndicator
                color={checked ? 'success' : 'warning'}
                size={28}
                content={<span>{`${index + 1}`}</span>}
            />
            <Stack spacing={1}>
                <Row spacing={1} justifyContent="space-between">
                    <Row spacing={2}>
                        <Checkbox
                            label={
                                <Typography level="body1">
                                    {step.shortDescription}
                                </Typography>
                            }
                            className="bg-card"
                            checked={checked}
                            onCheckedChange={handleCheckedChange}
                        />
                        <Chip>
                            {step.timeMinutes
                                ? `~${step.timeMinutes * durationScale} min`
                                : 'Nema vremena'}
                        </Chip>
                    </Row>
                    {step.timer && step.timeMinutes && (
                        <StepTimer
                            stepId={step.shortDescription}
                            duration={step.timeMinutes * durationScale}
                            onTimerCreate={createTimer}
                            onTimerStart={startTimer}
                            onTimerPause={pauseTimer}
                            onTimerReset={resetTimer}
                            onTimerRemove={removeTimer}
                            timer={getTimerByStepId(step.shortDescription)}
                        />
                    )}
                    {step.description && expanded !== null && (
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
                {(step.description ||
                    (step.ingredientsUsed?.length ?? 0) > 0) && (
                    <Collapse appear={expanded ?? true}>
                        <div className="pl-4 border-l ml-2">
                            <Stack>
                                {(step.ingredientsUsed?.length ?? 0) > 0 && (
                                    <Stack>
                                        {step.ingredientsUsed?.map(
                                            (ingredient) => {
                                                const ingredientData =
                                                    recipe.ingredients.find(
                                                        (ing) =>
                                                            ing.id ===
                                                            ingredient.id,
                                                    );
                                                return (
                                                    <ListItem
                                                        key={ingredient.id}
                                                        label={
                                                            <Typography level="body2">
                                                                •{' '}
                                                                {(ingredientData?.quantity ??
                                                                    0) *
                                                                    portionMultiplier}{' '}
                                                                {unitDisplayMap[
                                                                    ingredientData?.unit ||
                                                                        ''
                                                                ] ??
                                                                    ingredientData?.unit}{' '}
                                                                {ingredientData?.name ||
                                                                    ingredient.id}
                                                                {ingredientData?.approximateQuantity
                                                                    ? ` (~${
                                                                          (ingredientData?.approximateQuantity ||
                                                                              0) *
                                                                          portionMultiplier
                                                                      } ${
                                                                          unitDisplayMap[
                                                                              ingredientData?.approximateQuantityUnit ||
                                                                                  ''
                                                                          ] ??
                                                                          ingredientData?.approximateQuantityUnit
                                                                      })`
                                                                    : ''}
                                                            </Typography>
                                                        }
                                                    />
                                                );
                                            },
                                        )}
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
        </Row>
    );
}
