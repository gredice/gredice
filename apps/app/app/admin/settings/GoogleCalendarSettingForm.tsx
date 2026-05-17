'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Stack } from '@signalco/ui-primitives/Stack';
import { useActionState, useEffect, useState } from 'react';
import { updateGoogleCalendarSettingsAction } from '../../(actions)/googleCalendarSettingsActions';

type GoogleCalendarSettingFormProps = {
    initialClientEmail?: string;
    initialCalendarId?: string;
    hasPrivateKey: boolean;
};

export function GoogleCalendarSettingForm({
    initialClientEmail,
    initialCalendarId,
    hasPrivateKey,
}: GoogleCalendarSettingFormProps) {
    const [clientEmail, setClientEmail] = useState(initialClientEmail ?? '');
    const [calendarId, setCalendarId] = useState(initialCalendarId ?? '');
    const [privateKey, setPrivateKey] = useState('');
    const [state, formAction, isPending] = useActionState(
        updateGoogleCalendarSettingsAction,
        null,
    );

    useEffect(() => {
        if (state?.success) {
            setClientEmail((value) => value.trim());
            setCalendarId((value) => value.trim());
            setPrivateKey('');
        }
    }, [state]);

    return (
        <form action={formAction} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <Input
                    name="clientEmail"
                    label="Google service account"
                    placeholder="calendar-sync@project.iam.gserviceaccount.com"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                    autoComplete="off"
                />
                <Input
                    name="calendarId"
                    label="Google Calendar ID"
                    placeholder="primary"
                    value={calendarId}
                    onChange={(event) => setCalendarId(event.target.value)}
                    autoComplete="off"
                />
            </div>
            <Stack spacing={1}>
                <label
                    htmlFor="google-calendar-private-key"
                    className="text-sm font-medium"
                >
                    Privatni ključ
                </label>
                <textarea
                    id="google-calendar-private-key"
                    name="privateKey"
                    value={privateKey}
                    onChange={(event) => setPrivateKey(event.target.value)}
                    placeholder={
                        hasPrivateKey
                            ? 'Postojeći ključ je spremljen'
                            : '-----BEGIN PRIVATE KEY-----'
                    }
                    rows={5}
                    autoComplete="off"
                    className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-sm text-muted-foreground">
                    {hasPrivateKey
                        ? 'Ostavi prazno za zadržavanje postojećeg ključa.'
                        : 'Ključ se sprema samo za administratorsku sinkronizaciju dostave.'}
                </p>
            </Stack>
            <Button type="submit" disabled={isPending} variant="solid">
                {isPending
                    ? 'Spremanje…'
                    : hasPrivateKey
                      ? 'Spremi Google'
                      : 'Poveži Google'}
            </Button>
            {state && (
                <p
                    className={`text-sm ${
                        state.success ? 'text-green-600' : 'text-red-600'
                    }`}
                >
                    {state.message}
                </p>
            )}
        </form>
    );
}
