'use client';

import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent } from '@gredice/ui/Card';
import { Truck, Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useActionState } from 'react';
import type { DeliveryNativeAuthorizationRequest } from '../../../lib/deliveryNativeAuthorization';
import { authorizeDeliveryNativeAction } from './actions';

type EligibleAccount = {
    id: string;
    city: string | null;
    postalCode: string | null;
};

function accountLabel(account: EligibleAccount) {
    const location = [account.postalCode, account.city]
        .filter(Boolean)
        .join(' ');
    return location || `Račun ${account.id.slice(0, 8)}`;
}

export function NativeAuthorizationPanel({
    request,
    accounts,
}: {
    request: DeliveryNativeAuthorizationRequest;
    accounts: EligibleAccount[];
}) {
    const [error, action, pending] = useActionState(
        authorizeDeliveryNativeAction,
        null,
    );
    const requiresSelection = accounts.length > 1;

    return (
        <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardContent noHeader className="p-6 sm:p-8">
                    <form action={action}>
                        <Stack spacing={6}>
                            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                                <Truck className="size-6" />
                            </div>
                            <Stack spacing={1}>
                                <Typography level="h2" semiBold>
                                    Povežite Android Auto
                                </Typography>
                                <Typography className="text-muted-foreground">
                                    Android Auto dobit će samo pristup ruti
                                    dostave za čitanje. Prijava u web aplikaciji
                                    ostaje nepromijenjena.
                                </Typography>
                            </Stack>
                            {requiresSelection ? (
                                <fieldset className="space-y-2">
                                    <legend className="mb-2 text-sm font-medium">
                                        Račun dostave
                                    </legend>
                                    {accounts.map((account) => (
                                        <label
                                            key={account.id}
                                            className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"
                                        >
                                            <input
                                                type="radio"
                                                name="account_id"
                                                value={account.id}
                                                required
                                            />
                                            <span>{accountLabel(account)}</span>
                                        </label>
                                    ))}
                                </fieldset>
                            ) : null}
                            {error ? (
                                <Alert
                                    color="danger"
                                    startDecorator={
                                        <Warning className="size-5" />
                                    }
                                >
                                    {error}
                                </Alert>
                            ) : null}
                            <input
                                type="hidden"
                                name="client_id"
                                value={request.clientId}
                            />
                            <input
                                type="hidden"
                                name="redirect_uri"
                                value={request.redirectUri}
                            />
                            <input
                                type="hidden"
                                name="code_challenge"
                                value={request.codeChallenge}
                            />
                            <input
                                type="hidden"
                                name="code_challenge_method"
                                value={request.codeChallengeMethod}
                            />
                            <input
                                type="hidden"
                                name="state"
                                value={request.state}
                            />
                            <Button type="submit" fullWidth loading={pending}>
                                Poveži aplikaciju
                            </Button>
                        </Stack>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
