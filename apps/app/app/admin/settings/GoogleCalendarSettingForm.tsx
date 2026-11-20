'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { useActionState, useEffect, useState } from 'react';
import { updateGoogleCalendarSettingsAction } from '../../(actions)/googleCalendarSettingsActions';
import { SettingsCardBody } from './_components/SettingsCardBody';
import { SettingsCardFooter } from './_components/SettingsCardFooter';
import { SettingsFormMessage } from './_components/SettingsFormMessage';

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
        <form action={formAction}>
            <SettingsCardBody>
                <div className="grid min-w-0 grid-cols-1 gap-4 @xl/settings:grid-cols-2">
                    <Input
                        name="clientEmail"
                        label="Google service account"
                        placeholder="calendar-sync@project.iam.gserviceaccount.com"
                        value={clientEmail}
                        onChange={(event) => setClientEmail(event.target.value)}
                        autoComplete="off"
                        fullWidth
                    />
                    <Input
                        name="calendarId"
                        label="Google Calendar ID"
                        placeholder="primary"
                        value={calendarId}
                        onChange={(event) => setCalendarId(event.target.value)}
                        autoComplete="off"
                        fullWidth
                    />
                </div>
                <div className="space-y-1">
                    <label
                        htmlFor="google-calendar-private-key"
                        className="block text-sm font-medium text-foreground"
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
                        aria-describedby="google-calendar-private-key-help"
                        className="block min-h-32 w-full rounded-md border border-input bg-field px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <p
                        id="google-calendar-private-key-help"
                        className="text-xs text-muted-foreground"
                    >
                        {hasPrivateKey
                            ? 'Ostavi prazno za zadržavanje postojećeg ključa.'
                            : 'Ključ se sprema samo za administratorsku sinkronizaciju dostave.'}
                    </p>
                </div>
            </SettingsCardBody>
            <SettingsCardFooter>
                <SettingsFormMessage state={state} />
                <Button type="submit" disabled={isPending} variant="solid">
                    {isPending
                        ? 'Spremanje…'
                        : hasPrivateKey
                          ? 'Spremi Google'
                          : 'Poveži Google'}
                </Button>
            </SettingsCardFooter>
        </form>
    );
}
