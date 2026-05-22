import { clientAuthenticated } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardActions, CardContent } from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Check, Copy, Edit, ExternalLink, Info } from '@gredice/ui/icons';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { useReferrals } from '../../hooks/useReferrals';
import { KnownPages } from '../../knownPages';

async function errorMessageFromResponse(response: Response) {
    const payload: unknown = await response.json().catch(() => null);
    if (payload && typeof payload === 'object' && 'error' in payload) {
        const error = payload.error;
        if (typeof error === 'string') {
            return error;
        }
    }
    return 'Kod nije spremljen';
}

type CopyState = 'idle' | 'copied';

export function ReferralsTab() {
    const { data, refetch } = useReferrals();
    const [useCode, setUseCode] = useState('');
    const [changeCodeOpen, setChangeCodeOpen] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [codeCopyState, setCodeCopyState] = useState<CopyState>('idle');
    const [linkCopyState, setLinkCopyState] = useState<CopyState>('idle');
    const [changeCodeError, setChangeCodeError] = useState<string | null>(null);
    const [isChangingCode, setIsChangingCode] = useState(false);
    const [isUsingCode, setIsUsingCode] = useState(false);
    const referralCode = data?.myCode ?? '';
    const referralLink = data?.referralLink ?? '';
    const referredAccounts = data?.referredAccounts ?? [];
    const trimmedUseCode = useCode.trim();

    async function copyTextToClipboard(
        value: string,
        setCopyState: (state: CopyState) => void,
    ) {
        if (
            !value ||
            typeof navigator === 'undefined' ||
            !navigator.clipboard
        ) {
            return;
        }
        try {
            await navigator.clipboard.writeText(value);
            setCopyState('copied');
            window.setTimeout(() => setCopyState('idle'), 1800);
        } catch {
            setCopyState('idle');
        }
    }

    function openChangeCodeModal() {
        setNewCode(referralCode);
        setChangeCodeError(null);
        setChangeCodeOpen(true);
    }

    async function changeReferralCode() {
        setIsChangingCode(true);
        setChangeCodeError(null);
        try {
            const response =
                await clientAuthenticated().api.accounts.current.referrals.code.$post(
                    { json: { code: newCode } },
                );
            if (!response.ok) {
                setChangeCodeError(await errorMessageFromResponse(response));
                return;
            }
            await refetch();
            setChangeCodeOpen(false);
        } finally {
            setIsChangingCode(false);
        }
    }

    async function redeemReferralCode() {
        if (!trimmedUseCode) {
            return;
        }

        setIsUsingCode(true);
        try {
            await clientAuthenticated().api.accounts.current.referrals.use.$post(
                {
                    json: { code: trimmedUseCode },
                },
            );
            await refetch();
        } finally {
            setIsUsingCode(false);
        }
    }

    return (
        <Stack spacing={8}>
            <Typography level="h4" className="hidden md:block">
                💮 Preporuke
            </Typography>
            <Stack spacing={2}>
                <Alert
                    color="info"
                    startDecorator={<Info className="size-4" />}
                >
                    <Typography level="body2">
                        Podijeli svoj kod i zaradi{' '}
                        <strong>{data?.rewardAmount ?? 10000} 🌻</strong> kada
                        novi račun ispuni uvjet aktivne gredice. Kod se može
                        iskoristiti jednom po računu, a isti kod može
                        iskoristiti više različitih računa.{' '}
                        <Button
                            className="inline-flex text-blue-950 dark:text-blue-100"
                            endDecorator={
                                <ExternalLink
                                    aria-hidden
                                    className="size-3.5"
                                />
                            }
                            href={KnownPages.GrediceReferrals}
                            rel="noreferrer"
                            size="sm"
                            target="_blank"
                            variant="link"
                        >
                            Saznaj više
                        </Button>
                    </Typography>
                </Alert>
                <Card>
                    <CardContent noHeader className="space-y-3">
                        <div className="text-sm font-semibold">
                            Podijeli svoj kod
                        </div>
                        <div>
                            <div className="flex max-w-md items-end gap-2">
                                <Input
                                    className="font-medium"
                                    endDecorator={
                                        <IconButton
                                            className="mr-1"
                                            disabled={!referralCode}
                                            onClick={() =>
                                                copyTextToClipboard(
                                                    referralCode,
                                                    setCodeCopyState,
                                                )
                                            }
                                            size="sm"
                                            title="Kopiraj kod"
                                            type="button"
                                            variant="plain"
                                        >
                                            {codeCopyState === 'copied' ? (
                                                <Check
                                                    aria-hidden
                                                    className="size-4"
                                                />
                                            ) : (
                                                <Copy
                                                    aria-hidden
                                                    className="size-4"
                                                />
                                            )}
                                        </IconButton>
                                    }
                                    fullWidth
                                    label="Kod za preporuku računa"
                                    readOnly
                                    value={referralCode}
                                />
                                <IconButton
                                    disabled={!referralCode}
                                    onClick={openChangeCodeModal}
                                    title="Promijeni kod"
                                    type="button"
                                    variant="plain"
                                >
                                    <Edit aria-hidden className="size-4" />
                                </IconButton>
                            </div>
                        </div>
                        <Input
                            aria-label="Poveznica za preporuku"
                            className="font-medium"
                            endDecorator={
                                <IconButton
                                    className="mr-1"
                                    disabled={!referralLink}
                                    onClick={() =>
                                        copyTextToClipboard(
                                            referralLink,
                                            setLinkCopyState,
                                        )
                                    }
                                    size="sm"
                                    title="Kopiraj poveznicu"
                                    type="button"
                                    variant="plain"
                                >
                                    {linkCopyState === 'copied' ? (
                                        <Check aria-hidden className="size-4" />
                                    ) : (
                                        <Copy aria-hidden className="size-4" />
                                    )}
                                </IconButton>
                            }
                            fullWidth
                            label="Poveznica za preporuku"
                            readOnly
                            value={referralLink}
                        />
                    </CardContent>
                </Card>
                <Modal
                    onOpenChange={setChangeCodeOpen}
                    open={changeCodeOpen}
                    title="Promijeni kod preporuke"
                >
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void changeReferralCode();
                        }}
                    >
                        <Stack spacing={3}>
                            <div className="text-base font-semibold">
                                Promijeni kod preporuke
                            </div>
                            <Input
                                autoFocus
                                fullWidth
                                label="Novi kod"
                                onChange={(event) =>
                                    setNewCode(event.target.value)
                                }
                                value={newCode}
                            />
                            {changeCodeError ? (
                                <div className="text-sm text-destructive">
                                    {changeCodeError}
                                </div>
                            ) : null}
                            <div className="flex justify-end gap-2">
                                <Button
                                    onClick={() => setChangeCodeOpen(false)}
                                    type="button"
                                    variant="outlined"
                                >
                                    Odustani
                                </Button>
                                <Button loading={isChangingCode} type="submit">
                                    Spremi kod
                                </Button>
                            </div>
                        </Stack>
                    </form>
                </Modal>
                <Card>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void redeemReferralCode();
                        }}
                    >
                        <CardContent noHeader>
                            <Stack spacing={6}>
                                <Stack spacing={2}>
                                    <div className="text-sm font-semibold">
                                        Iskoristi kod preporuke
                                    </div>
                                    <Input
                                        fullWidth
                                        label="Kod za preporuku"
                                        value={useCode}
                                        onChange={(e) =>
                                            setUseCode(e.target.value)
                                        }
                                        placeholder="Unesi kod"
                                        disabled={isUsingCode}
                                    />
                                </Stack>
                                <CardActions className="justify-end">
                                    <Button
                                        disabled={
                                            !trimmedUseCode || isUsingCode
                                        }
                                        loading={isUsingCode}
                                        size="sm"
                                        type="submit"
                                        variant="solid"
                                    >
                                        Primijeni kod
                                    </Button>
                                </CardActions>
                            </Stack>
                        </CardContent>
                    </form>
                </Card>
                {referredAccounts.length > 0 ? (
                    <Card>
                        <CardContent noHeader className="space-y-3">
                            <div className="text-sm font-semibold">
                                Preporučeni računi
                            </div>
                            <ul className="space-y-1 text-sm">
                                {referredAccounts.map((u) => (
                                    <li key={u.accountId}>
                                        {u.accountId} {u.rewarded ? '✅' : '⏳'}
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                ) : null}
            </Stack>
        </Stack>
    );
}
