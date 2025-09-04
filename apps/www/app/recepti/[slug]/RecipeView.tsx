'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useEffect, useState } from 'react';
import type { Recipe, RecipeStep } from '../../../lib/recipes/getRecipesData';

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function StepItem({ step }: { step: RecipeStep }) {
    const [checked, setChecked] = useState(false);
    const [remaining, setRemaining] = useState<number | null>(null);

    useEffect(() => {
        if (remaining === null || remaining <= 0) {
            return;
        }
        const interval = setInterval(() => {
            setRemaining((r) => (r ? r - 1 : null));
        }, 1000);
        if (remaining === 0) {
            setChecked(true);
        }
        return () => clearInterval(interval);
    }, [remaining]);

    useEffect(() => {
        if (remaining === 0) {
            setChecked(true);
        }
    }, [remaining]);

    const start = () => {
        if (step.timeMinutes) {
            setRemaining(step.timeMinutes * 60);
        }
    };

    return (
        <Stack spacing={1} className="border-b pb-2">
            <Row spacing={2} className="items-center">
                <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => setChecked(Boolean(v))}
                />
                <Typography level="body1">{step.description}</Typography>
            </Row>
            {step.timeMinutes && (
                <Row spacing={2} className="items-center pl-6">
                    <Button
                        onClick={start}
                        disabled={remaining !== null && remaining > 0}
                    >
                        Kreni ({step.timeMinutes} min)
                    </Button>
                    {remaining !== null && remaining > 0 && (
                        <Typography level="body2" secondary>
                            {formatTime(remaining)}
                        </Typography>
                    )}
                </Row>
            )}
        </Stack>
    );
}

type WakeLockType = { release: () => Promise<void> } | null;
interface NavigatorWithWakeLock extends Navigator {
    wakeLock?: {
        request: (type: string) => Promise<WakeLockType>;
    };
}

export function RecipeView({ recipe }: { recipe: Recipe }) {
    const [portions, setPortions] = useState(recipe.portions);
    const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>(
        'metric',
    );
    const [wakeLock, setWakeLock] = useState<WakeLockType>(null);

    const multiplier = portions / recipe.portions;

    const requestWakeLock = async () => {
        try {
            const lock = await (
                navigator as NavigatorWithWakeLock
            ).wakeLock?.request('screen');
            setWakeLock(lock ?? null);
            lock?.addEventListener('release', () => setWakeLock(null));
        } catch {
            // ignore
        }
    };

    const releaseWakeLock = async () => {
        try {
            await wakeLock?.release();
        } catch {
            // ignore
        }
        setWakeLock(null);
    };

    const toggleWakeLock = () => {
        if (wakeLock) {
            releaseWakeLock();
        } else {
            requestWakeLock();
        }
    };

    const convertUnit = (unit: string, value: number) => {
        if (unitSystem === 'metric') {
            return { unit, value };
        }
        switch (unit) {
            case 'g':
                return { unit: 'oz', value: +(value * 0.035274).toFixed(2) };
            case 'ml':
                return { unit: 'fl oz', value: +(value * 0.033814).toFixed(2) };
            default:
                return { unit, value };
        }
    };

    const shareRecipe = async () => {
        try {
            await navigator.share?.({
                title: recipe.title,
                text: recipe.description,
                url: window.location.href,
            });
        } catch {
            // ignore
        }
    };

    return (
        <Stack spacing={4} className="py-8">
            <Row spacing={2} className="justify-end">
                <Button onClick={toggleWakeLock}>
                    {wakeLock
                        ? 'Dopusti gašenje zaslona'
                        : 'Drži zaslon budnim'}
                </Button>
                <Button onClick={shareRecipe} disabled={!navigator.share}>
                    Podijeli
                </Button>
            </Row>
            <Stack spacing={2}>
                <Typography level="h2" component="h1">
                    {recipe.title}
                </Typography>
                <Typography level="body1">{recipe.description}</Typography>
            </Stack>
            <Row spacing={2} className="items-center">
                <label htmlFor="portion-input">Porcije:</label>
                <Input
                    id="portion-input"
                    type="number"
                    value={portions}
                    min={1}
                    className="w-20"
                    onChange={(e) => setPortions(Number(e.target.value) || 1)}
                />
                <Button
                    variant="outline"
                    onClick={() =>
                        setUnitSystem(
                            unitSystem === 'metric' ? 'imperial' : 'metric',
                        )
                    }
                >
                    {unitSystem === 'metric' ? 'Imperial' : 'Metric'}
                </Button>
            </Row>
            <div className="grid gap-8 md:grid-cols-2">
                <Stack spacing={2}>
                    <Typography level="h3" component="h2">
                        Namirnice
                    </Typography>
                    {recipe.ingredients.map((ing) => {
                        const { unit, value } = convertUnit(
                            ing.unit,
                            ing.quantity * multiplier,
                        );
                        return (
                            <Row
                                key={ing.name}
                                spacing={2}
                                className="items-center"
                            >
                                <Checkbox />
                                <Typography level="body1">
                                    {value} {unit} {ing.name}
                                </Typography>
                            </Row>
                        );
                    })}
                </Stack>
                <Stack spacing={2}>
                    <Typography level="h3" component="h2">
                        Koraci
                    </Typography>
                    {recipe.steps.map((step) => (
                        <StepItem key={step.description} step={step} />
                    ))}
                </Stack>
            </div>
        </Stack>
    );
}
