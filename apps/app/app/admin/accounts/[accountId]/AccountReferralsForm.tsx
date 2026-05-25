'use client';

import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Clear, Save } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { UserAvatar } from '@gredice/ui/UserAvatar';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { KnownPages } from '../../../../src/KnownPages';
import {
    type AccountReferralActionState,
    clearAccountUsedReferralCodeAction,
    setAccountReferralCodeAction,
} from '../../../(actions)/accountReferralActions';

type AccountReferralsFormProps = {
    accountId: string;
    currentCode: string | null;
    usedReferral: {
        code: string;
        account: {
            id: string;
            displayName: string;
            avatarUrl: string | null;
        } | null;
    } | null;
};

function ActionMessage({ state }: { state: AccountReferralActionState }) {
    if (!state) {
        return null;
    }

    return (
        <Typography level="body2" color={state.success ? 'success' : 'danger'}>
            {state.message}
        </Typography>
    );
}

function SaveCodeButton() {
    const { pending } = useFormStatus();

    return (
        <Button
            type="submit"
            disabled={pending}
            startDecorator={<Save className="size-4" />}
        >
            {pending ? 'Spremanje...' : 'Spremi kod'}
        </Button>
    );
}

function ClearUsedCodeButton() {
    const { pending } = useFormStatus();

    return (
        <Button
            type="submit"
            disabled={pending}
            variant="outlined"
            color="danger"
            startDecorator={<Clear className="size-4" />}
        >
            {pending ? 'Čišćenje...' : 'Očisti preporučitelja'}
        </Button>
    );
}

export function AccountReferralsForm({
    accountId,
    currentCode,
    usedReferral,
}: AccountReferralsFormProps) {
    const [setCodeState, setCodeAction] = useActionState(
        setAccountReferralCodeAction,
        null,
    );
    const [clearCodeState, clearCodeAction] = useActionState(
        clearAccountUsedReferralCodeAction,
        null,
    );
    const referrerAccount = usedReferral?.account ?? null;

    return (
        <Stack spacing={4}>
            <form action={setCodeAction}>
                <Stack spacing={2}>
                    <input type="hidden" name="accountId" value={accountId} />
                    <Input
                        label="Kod preporuke računa"
                        name="code"
                        defaultValue={currentCode ?? ''}
                        fullWidth
                        autoComplete="off"
                        helperText="Do 32 znaka: slova, brojevi, _ i -."
                    />
                    <SaveCodeButton />
                    <ActionMessage state={setCodeState} />
                </Stack>
            </form>

            <Stack spacing={2}>
                <Typography level="body2" semiBold>
                    Dodijeljeni preporučitelj
                </Typography>
                {usedReferral ? (
                    <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                        <UserAvatar
                            avatarUrl={referrerAccount?.avatarUrl}
                            displayName={
                                referrerAccount?.displayName ?? 'Nepoznat račun'
                            }
                            size="sm"
                        />
                        <div className="min-w-0 flex-1">
                            {referrerAccount ? (
                                <Link
                                    href={KnownPages.Account(
                                        referrerAccount.id,
                                    )}
                                    className="block truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                                >
                                    {referrerAccount.displayName}
                                </Link>
                            ) : (
                                <Typography level="body2" semiBold noWrap>
                                    Nepoznat račun
                                </Typography>
                            )}
                            <Typography level="body3" mono noWrap>
                                {usedReferral.code}
                            </Typography>
                        </div>
                    </div>
                ) : (
                    <Typography level="body2" tertiary>
                        Nema dodijeljenog preporučitelja.
                    </Typography>
                )}
                {usedReferral ? (
                    <form action={clearCodeAction}>
                        <Stack spacing={2}>
                            <input
                                type="hidden"
                                name="accountId"
                                value={accountId}
                            />
                            <ClearUsedCodeButton />
                            <ActionMessage state={clearCodeState} />
                        </Stack>
                    </form>
                ) : null}
            </Stack>
        </Stack>
    );
}
