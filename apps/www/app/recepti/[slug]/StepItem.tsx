'use client';

import { ArrowDown, Down } from '@signalco/ui-icons';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Collapse } from '@signalco/ui-primitives/Collapse';
import { DotIndicator } from '@signalco/ui-primitives/DotIndicator';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { Markdown } from '../../../components/shared/Markdown';
import type { RecipeStep } from '../../../lib/recipes/getRecipesData';
import { StepTimer } from './StepTimer';
import { useTimer } from './useTimer';

export function StepItem({
    index,
    step,
    durationScale,
}: {
    index: number;
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
                    {step.description && checked && (
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
                {step.description && (
                    <Collapse appear={expanded ?? true}>
                        <div className="pl-4 border-l ml-2">
                            <Markdown>{step.description}</Markdown>
                        </div>
                    </Collapse>
                )}
            </Stack>
        </Row>
    );
}
