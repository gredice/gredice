'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { sendNewsNotificationAction } from '../../(actions)/newsNotificationsActions';

type TargetMode = 'all' | 'selected';

type AccountOption = {
    id: string;
    label: string;
    description?: string;
};

type NewsNotificationFormProps = {
    accounts: AccountOption[];
};

export function NewsNotificationForm({ accounts }: NewsNotificationFormProps) {
    const [state, formAction, pending] = useActionState(
        sendNewsNotificationAction,
        null,
    );
    const [target, setTarget] = useState<TargetMode>('all');
    const [newsType, setNewsType] = useState('new-operation');
    const [content, setContent] = useState('');

    useEffect(() => {
        if (state?.success) {
            setContent('');
            setTarget('all');
            setNewsType('new-operation');
        }
    }, [state?.success]);

    const newsTypeOptions = useMemo(
        () => [
            {
                value: 'new-operation',
                label: 'Nova radnja',
            },
        ],
        [],
    );

    const targetOptions = useMemo(
        () => [
            { value: 'all', label: 'Svi korisnički računi' },
            { value: 'selected', label: 'Odabrani računi' },
        ],
        [],
    );

    return (
        <form action={formAction} className="space-y-4">
            <Stack spacing={2}>
                <Stack spacing={1}>
                    <Typography level="body-sm" semiBold>
                        Odredište
                    </Typography>
                    <SelectItems
                        value={target}
                        onValueChange={(value) =>
                            setTarget(value as TargetMode)
                        }
                        items={targetOptions}
                        required
                    />
                    <input type="hidden" name="target" value={target} />
                </Stack>

                <Stack spacing={1}>
                    <Typography level="body-sm" semiBold>
                        Vrsta novosti
                    </Typography>
                    <SelectItems
                        value={newsType}
                        onValueChange={setNewsType}
                        items={newsTypeOptions}
                        required
                    />
                    <input type="hidden" name="newsType" value={newsType} />
                </Stack>

                <Stack spacing={1}>
                    <Typography level="body-sm" semiBold>
                        Sadržaj obavijesti
                    </Typography>
                    <textarea
                        name="content"
                        required
                        disabled={pending}
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        className="min-h-24 rounded-lg border border-stroke bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Napišite što je novo..."
                    />
                </Stack>

                {target === 'selected' && (
                    <Stack spacing={1}>
                        <Typography level="body-sm" semiBold>
                            Odaberite račune
                        </Typography>
                        <div className="max-h-72 overflow-y-auto rounded-lg border border-stroke p-3 space-y-2">
                            {accounts.map((account) => {
                                const inputId = `account-${account.id}`;

                                return (
                                    <div
                                        key={account.id}
                                        className="flex items-start gap-3 text-sm"
                                    >
                                        <Checkbox
                                            id={inputId}
                                            name="accountIds"
                                            value={account.id}
                                            disabled={pending}
                                            className="mt-1"
                                        />
                                        <label
                                            htmlFor={inputId}
                                            className="cursor-pointer"
                                        >
                                            <Typography
                                                level="body-sm"
                                                semiBold
                                            >
                                                {account.label}
                                            </Typography>
                                            <Typography
                                                level="body-sm"
                                                color="muted"
                                            >
                                                {account.description ||
                                                    account.id}
                                            </Typography>
                                        </label>
                                    </div>
                                );
                            })}
                            {accounts.length === 0 && (
                                <Typography level="body-sm" color="muted">
                                    Nema dostupnih računa.
                                </Typography>
                            )}
                        </div>
                    </Stack>
                )}

                {state?.error && (
                    <Typography level="body-sm" color="danger">
                        {state.error}
                    </Typography>
                )}
                {state?.success && (
                    <Typography level="body-sm" color="success">
                        {`Obavijest poslana (${state.createdCount})`}
                    </Typography>
                )}

                <Button type="submit" disabled={pending} loading={pending}>
                    Pošalji obavijest
                </Button>
            </Stack>
        </form>
    );
}
