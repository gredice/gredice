'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateSlackNotificationChannelAction } from '../../../(actions)/notificationSettingsActions';
import { SettingsFormMessage } from '../../settings/_components/SettingsFormMessage';

type SlackChannelSettingKey =
    | 'slack.delivery.channel'
    | 'slack.new_users.channel'
    | 'slack.shopping.channel';

type SlackChannelSettingFormProps = {
    settingKey: SlackChannelSettingKey;
    initialChannelId?: string | null;
    title: string;
    description: string;
    label: string;
};

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" disabled={pending} className="shrink-0">
            {pending ? 'Spremanje…' : 'Spremi kanal'}
        </Button>
    );
}

/**
 * One row of the Slack channels setting card: what the notification is about
 * on the left, its channel field and save button on the right.
 */
export function SlackChannelSettingForm({
    settingKey,
    initialChannelId,
    title,
    description,
    label,
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
        <form
            action={formAction}
            className="grid gap-x-6 gap-y-3 p-4 @2xl/settings:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
        >
            <div className="min-w-0 space-y-1">
                <h4 className="text-sm font-medium">{title}</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="min-w-0">
                <div className="flex items-end gap-2">
                    <Input
                        // The three channel forms share one page, so each
                        // field needs its own id for its label.
                        id={`slack-channel-${settingKey}`}
                        name="slackChannelId"
                        label={label}
                        placeholder="npr. C1234567890"
                        value={channelValue}
                        onChange={(event) =>
                            setChannelValue(event.target.value)
                        }
                        autoComplete="off"
                        fullWidth
                    />
                    <SubmitButton />
                </div>
                <input type="hidden" name="settingKey" value={settingKey} />
                <SettingsFormMessage
                    state={state}
                    className={state ? 'mt-2' : undefined}
                />
            </div>
        </form>
    );
}
