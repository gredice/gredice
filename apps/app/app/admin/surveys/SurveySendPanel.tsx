'use client';

import { Button } from '@gredice/ui/Button';
import { Checkbox } from '@gredice/ui/Checkbox';
import { Input } from '@gredice/ui/Input';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { type FormEvent, useMemo, useState, useTransition } from 'react';
import {
    previewSurveyAudienceAction,
    type SurveyActionState,
    type SurveyPreviewActionState,
    sendSurveyAction,
} from './actions';

type SurveyOption = {
    activeVersionId: string | null;
    id: string;
    key: string;
    title: string;
};

type TargetUser = {
    accountId: string;
    displayName: string | null;
    id: string;
    userName: string;
};

function makeFormData({
    accountIds,
    email,
    explicitRecipients,
    inApp,
    name,
    survey,
    targetType,
    userIds,
}: {
    accountIds: string;
    email: boolean;
    explicitRecipients: string;
    inApp: boolean;
    name: string;
    survey: SurveyOption;
    targetType: string;
    userIds: string;
}) {
    const formData = new FormData();
    formData.set('surveyId', survey.id);
    formData.set('surveyKey', survey.key);
    if (survey.activeVersionId) {
        formData.set('versionId', survey.activeVersionId);
    }
    formData.set('name', name);
    formData.set('targetType', targetType);
    formData.set('accountIds', accountIds);
    formData.set('userIds', userIds);
    formData.set('explicitRecipients', explicitRecipients);
    formData.set('contextKey', `manual:${survey.key}:${Date.now()}`);
    if (inApp) formData.set('inApp', 'on');
    if (email) formData.set('email', 'on');
    return formData;
}

function PreviewMessage({ state }: { state: SurveyPreviewActionState }) {
    if (!state.message) return null;
    return (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <Typography
                className={state.success ? 'text-green-700' : 'text-red-700'}
            >
                {state.message}
            </Typography>
            {state.preview ? (
                <Typography level="body2" className="text-muted-foreground">
                    Eksplicitno uneseno: {state.preview.explicitRecipientCount},
                    neusklađeno: {state.preview.unmatchedRecipientCount}.
                </Typography>
            ) : null}
        </div>
    );
}

function SendMessage({ state }: { state: SurveyActionState }) {
    if (!state.message) return null;
    return (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <Typography
                className={state.success ? 'text-green-700' : 'text-red-700'}
            >
                {state.message}
            </Typography>
        </div>
    );
}

export function SurveySendPanel({
    survey,
    targetUsers,
}: {
    survey: SurveyOption;
    targetUsers: TargetUser[];
}) {
    const [targetType, setTargetType] = useState<
        'accounts' | 'users' | 'explicit'
    >('explicit');
    const [accountIds, setAccountIds] = useState('');
    const [userIds, setUserIds] = useState('');
    const [explicitRecipients, setExplicitRecipients] = useState('');
    const [name, setName] = useState(`${survey.title} - ručno slanje`);
    const [inApp, setInApp] = useState(true);
    const [email, setEmail] = useState(false);
    const [previewState, setPreviewState] = useState<SurveyPreviewActionState>(
        {},
    );
    const [sendState, setSendState] = useState<SurveyActionState>({});
    const [pending, startTransition] = useTransition();

    const sampleRecipients = useMemo(
        () =>
            targetUsers
                .slice(0, 8)
                .map((user) => {
                    const label = user.displayName || user.userName || user.id;
                    return `${label} (${user.accountId} / ${user.id})`;
                })
                .join('\n'),
        [targetUsers],
    );

    function currentFormData() {
        return makeFormData({
            accountIds,
            email,
            explicitRecipients,
            inApp,
            name,
            survey,
            targetType,
            userIds,
        });
    }

    function handlePreview() {
        startTransition(async () => {
            setPreviewState(
                await previewSurveyAudienceAction({}, currentFormData()),
            );
        });
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        startTransition(async () => {
            setSendState(await sendSurveyAction({}, currentFormData()));
        });
    }

    return (
        <form className="space-y-4" onSubmit={handleSubmit}>
            <Stack spacing={1}>
                <Typography level="h6">Slanje ankete</Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Odaberi korisnike ili račune, provjeri publiku, zatim stvori
                    dodjele i pošalji kanale.
                </Typography>
            </Stack>

            <div className="grid gap-3 md:grid-cols-2">
                <Input
                    fullWidth
                    label="Naziv slanja"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                <label className="space-y-1">
                    <span className="block text-sm font-medium text-foreground">
                        Ciljanje
                    </span>
                    <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                        value={targetType}
                        onChange={(event) =>
                            setTargetType(
                                event.target.value === 'accounts' ||
                                    event.target.value === 'users'
                                    ? event.target.value
                                    : 'explicit',
                            )
                        }
                    >
                        <option value="explicit">
                            Račun + korisnik po retku
                        </option>
                        <option value="accounts">Računi</option>
                        <option value="users">Korisnici</option>
                    </select>
                </label>
            </div>

            {targetType === 'accounts' || targetType === 'users' ? (
                <Input
                    fullWidth
                    label="ID računa"
                    helperText="Odvoji ID-jeve zarezom, razmakom ili novim redom."
                    value={accountIds}
                    onChange={(event) => setAccountIds(event.target.value)}
                />
            ) : null}

            {targetType === 'users' ? (
                <Input
                    fullWidth
                    label="ID korisnika"
                    helperText="Ako su računi uneseni, korisnik mora biti član barem jednog od njih."
                    value={userIds}
                    onChange={(event) => setUserIds(event.target.value)}
                />
            ) : null}

            {targetType === 'explicit' ? (
                <label className="space-y-1">
                    <span className="block text-sm font-medium text-foreground">
                        Primatelji
                    </span>
                    <textarea
                        className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                        placeholder="accountId userId"
                        value={explicitRecipients}
                        onChange={(event) =>
                            setExplicitRecipients(event.target.value)
                        }
                    />
                    <Typography level="body3" className="text-muted-foreground">
                        Jedan redak po primatelju. User ID može ostati prazan za
                        slanje svim korisnicima računa.
                    </Typography>
                </label>
            ) : null}

            {sampleRecipients ? (
                <details className="rounded-md border bg-muted/30 p-3 text-sm">
                    <summary className="cursor-pointer font-medium">
                        Primjeri postojećih korisnika
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">
                        {sampleRecipients}
                    </pre>
                </details>
            ) : null}

            <div className="flex flex-wrap gap-4">
                <Checkbox
                    checked={inApp}
                    label="In-app obavijest"
                    onCheckedChange={(checked) => setInApp(checked === true)}
                />
                <Checkbox
                    checked={email}
                    label="Email"
                    onCheckedChange={(checked) => setEmail(checked === true)}
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outlined"
                    disabled={pending || !survey.activeVersionId}
                    onClick={handlePreview}
                >
                    Pregledaj publiku
                </Button>
                <Button
                    type="submit"
                    disabled={pending || !survey.activeVersionId}
                >
                    Pošalji anketu
                </Button>
            </div>

            {!survey.activeVersionId ? (
                <Typography level="body2" className="text-red-700">
                    Anketa mora imati objavljenu verziju prije slanja.
                </Typography>
            ) : null}
            <PreviewMessage state={previewState} />
            <SendMessage state={sendState} />
        </form>
    );
}
