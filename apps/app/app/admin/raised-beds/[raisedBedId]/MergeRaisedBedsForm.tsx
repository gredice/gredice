'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    type MergeRaisedBedsActionState,
    mergeRaisedBedsAction,
} from '../../../(actions)/raisedBedActions';

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Spajanje…' : 'Spoji gredice'}
        </Button>
    );
}

export function MergeRaisedBedsForm({
    targetRaisedBedId,
}: {
    targetRaisedBedId: number;
}) {
    const [sourceRaisedBedId, setSourceRaisedBedId] = useState('');
    const [state, formAction] = useActionState<
        MergeRaisedBedsActionState,
        FormData
    >(mergeRaisedBedsAction, null);

    return (
        <form action={formAction} className="space-y-2">
            <Stack spacing={1}>
                <Input
                    name="sourceRaisedBedId"
                    label="ID gredice za spajanje"
                    type="number"
                    min="1"
                    value={sourceRaisedBedId}
                    onChange={(event) =>
                        setSourceRaisedBedId(event.target.value)
                    }
                    helperText="Unesite ID druge gredice s istom fizičkom oznakom."
                />
                <input
                    type="hidden"
                    name="targetRaisedBedId"
                    value={targetRaisedBedId}
                />
                <SubmitButton />
                {state?.message && (
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
