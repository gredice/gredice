'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateSlackNotificationChannelAction } from '../../../(actions)/notificationSettingsActions';

type SlackChannelSettingKey =
    | 'slack.delivery.channel'
    | 'slack.new_users.channel'
    | 'slack.shopping.channel';

type SlackChannelSettingFormProps = {
    settingKey: SlackChannelSettingKey;
    initialChannelId?: string | null;
    label: string;
    helperText?: string;
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Spremanje…' : 'Spremi kanal'}
        </Button>
    );
}

export function SlackChannelSettingForm({
    settingKey,
    initialChannelId,
    label,
    helperText,
}: SlackChannelSettingFormProps) {
    const [channelValue, setChannelValue] = useState(initialChannelId ?? '');
    const [state, formAction] = useActionState(
        updateSlackNotificationChannelAction,
        null,
    );

    useEffect(() => {
        if (state?.success) {
            setChannelValue((prev) => prev.trim());
        }
    }, [state]);

    return (
        <form action={formAction} className="space-y-2">
            <Stack spacing={1}>
                <Input
                    name="slackChannelId"
                    label={label}
                    placeholder="npr. C1234567890"
                    value={channelValue}
                    onChange={(event) => setChannelValue(event.target.value)}
                    helperText={
                        helperText ??
                        'Unesi ID Slack kanala na koji šaljemo obavijesti.'
                    }
                />
                <input type="hidden" name="settingKey" value={settingKey} />
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
