'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateFarmSlackChannelAction } from '../../../(actions)/farmActions';

type FarmSlackChannelFormProps = {
    farmId: number;
    slackChannelId?: string | null;
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Spremanje…' : 'Spremi kanal'}
        </Button>
    );
}

export function FarmSlackChannelForm({
    farmId,
    slackChannelId,
}: FarmSlackChannelFormProps) {
    const [channelValue, setChannelValue] = useState(slackChannelId ?? '');
    const [state, formAction] = useActionState(
        updateFarmSlackChannelAction,
        null,
    );

    useEffect(() => {
        if (state?.success) {
            setChannelValue((prev) => prev.trim());
        }
    }, [state]);

    return (
        <form action={formAction} className="space-y-2">
            <Stack spacing={2}>
                <Input
                    name="slackChannelId"
                    label="Slack kanal"
                    placeholder="npr. C1234567890"
                    value={channelValue}
                    onChange={(event) => setChannelValue(event.target.value)}
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
