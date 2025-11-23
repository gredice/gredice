'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateFarmSnowAccumulationAction } from '../../../(actions)/farmActions';

type FarmSnowAccumulationFormProps = {
    farmId: number;
    snowAccumulation: number;
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Spremanje…' : 'Spremi'}
        </Button>
    );
}

export function FarmSnowAccumulationForm({
    farmId,
    snowAccumulation,
}: FarmSnowAccumulationFormProps) {
    const [accumulation, setAccumulation] = useState(
        snowAccumulation.toString(),
    );
    const [state, formAction] = useActionState(
        updateFarmSnowAccumulationAction,
        null,
    );

    useEffect(() => {
        if (state?.success) {
            setAccumulation((prev) => prev.trim());
        }
    }, [state]);

    return (
        <form action={formAction} className="space-y-2">
            <Stack spacing={1}>
                <Input
                    name="snowAccumulation"
                    label="Snijeg (cm)"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    value={accumulation}
                    onChange={(event) => setAccumulation(event.target.value)}
                    helperText="Unesite visinu snijega u centimetrima."
                />
                <input type="hidden" name="farmId" value={farmId} />
                <SubmitButton />
                {state && (
                    <p
                        className={`text-sm ${
                            state.success ? 'text-green-600' : 'text-red-600'
                        }`}
                    >
                        {state.message}
                    </p>
                )}
            </Stack>
        </form>
    );
}
