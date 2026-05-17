'use client';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Tabs } from '@signalco/ui-primitives/Tabs';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState, useState, useTransition } from 'react';
import {
    cancelCampaignAction,
    createCampaignAction,
    enqueueCampaignAction,
    previewAudienceAction,
    sendTestNotificationAction,
} from './actions';

const initState: {
    success?: boolean;
    error?: string;
    campaign?: { id: string; status: string } | null;
} = {};

export function NotificationComposerClient() {
    const [state, formAction, pending] = useActionState(
        createCampaignAction,
        initState,
    );
    const [audience, setAudience] = useState<number | null>(null);
    const [isPending, startTransition] = useTransition();

    return (
        <Stack spacing={2}>
            {/* content */}
            <Card className="p-4">
                <Typography level="h5">Notification composer</Typography>
                <form action={formAction} className="space-y-3 mt-2">
                    <Input name="name" label="Campaign name" required />
                    <Input name="header" label="Title" required />
                    <Input name="content" label="Body" required />
                    <Input
                        name="category"
                        label="Category"
                        defaultValue="admin_campaigns"
                        required
                    />
                    <Input
                        name="eventType"
                        label="Event type"
                        defaultValue="admin_bulk_message"
                        required
                    />
                    <Input name="linkUrl" label="Link URL" type="url" />
                    <Input name="imageUrl" label="Image URL" type="url" />
                    <Input name="iconUrl" label="Icon URL" type="url" />
                    <Input name="actionLabel" label="Action label" />
                    <Input name="actionUrl" label="Action URL" type="url" />
                    <Input
                        name="scheduledAt"
                        label="Schedule"
                        type="datetime-local"
                    />
                    <Stack horizontal>
                        <Checkbox name="inApp" label="In-app" defaultChecked />
                        <Checkbox name="push" label="Push" />
                        <Checkbox name="email" label="Email" />
                        <Checkbox name="digest" label="Digest" />
                    </Stack>
                    <Stack horizontal>
                        <Button
                            type="button"
                            onClick={() =>
                                startTransition(async () =>
                                    setAudience(
                                        (await previewAudienceAction()).preview
                                            .totalRecipients,
                                    ),
                                )
                            }
                            disabled={isPending}
                        >
                            Estimate audience
                        </Button>
                        <Button type="submit" disabled={pending}>
                            Save draft
                        </Button>
                    </Stack>
                </form>
                {audience !== null && (
                    <Typography>Estimated audience size: {audience}</Typography>
                )}
                {state.error && (
                    <Typography className="text-red-600">
                        {state.error}
                    </Typography>
                )}
                {state.campaign && (
                    <Stack spacing={1}>
                        <Typography>
                            Campaign {state.campaign.id} (
                            {state.campaign.status})
                        </Typography>
                        <Stack horizontal>
                            <Button
                                onClick={() =>
                                    startTransition(
                                        async () =>
                                            state.campaign &&
                                            (await enqueueCampaignAction(
                                                state.campaign.id,
                                            )),
                                    )
                                }
                            >
                                Enqueue
                            </Button>
                            <Button
                                onClick={() =>
                                    startTransition(
                                        async () =>
                                            state.campaign &&
                                            (await cancelCampaignAction(
                                                state.campaign.id,
                                            )),
                                    )
                                }
                            >
                                Cancel
                            </Button>
                        </Stack>
                    </Stack>
                )}
            </Card>
            <Card className="p-4">
                <Typography level="h6">Preview</Typography>
                <Tabs
                    items={[
                        { id: 'in-app', label: 'In-app' },
                        { id: 'push', label: 'Push' },
                        { id: 'email', label: 'Email' },
                    ]}
                >
                    <Typography>
                        Payload preview shown with browser fallback behavior for
                        rich push fields.
                    </Typography>
                </Tabs>
            </Card>
            <Card className="p-4">
                <Typography level="h6">Test send</Typography>
                <form action={sendTestNotificationAction} className="space-y-2">
                    <Input name="header" label="Test title" required />
                    <Input name="content" label="Test body" required />
                    <Input name="linkUrl" label="Test link URL" />
                    <Button type="submit">Send test to current admin</Button>
                </form>
            </Card>
        </Stack>
    );
}
