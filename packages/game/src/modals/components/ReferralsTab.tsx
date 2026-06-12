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
import { UserAvatar } from '@gredice/ui/UserAvatar';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Confetti from 'react-confetti-boom';
import { currentAccountKeys } from '../../hooks/useCurrentAccount';
import { useReferrals } from '../../hooks/useReferrals';
import { KnownPages } from '../../knownPages';

async function errorMessageFromResponse(response: Response, fallback: string) {
    const payload: unknown = await response.json().catch(() => null);
    if (payload && typeof payload === 'object' && 'error' in payload) {
        const error = payload.error;
        if (typeof error === 'string') {
            return error;
        }
    }
    return fallback;
}

function referralRewardGrantedFromPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object' || !('reward' in payload)) {
        return false;
    }

    const { reward } = payload;
    return (
        reward !== null &&
        typeof reward === 'object' &&
        'rewarded' in reward &&
        reward.rewarded === true
    );
}

type CopyState = 'idle' | 'copied';

export function ReferralsTab() {
    const queryClient = useQueryClient();
    const { data, refetch } = useReferrals();
    const [useCode, setUseCode] = useState('');
    const [showRewardConfetti, setShowRewardConfetti] = useState(false);
    const [changeCodeOpen, setChangeCodeOpen] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [codeCopyState, setCodeCopyState] = useState<CopyState>('idle');
    const [linkCopyState, setLinkCopyState] = useState<CopyState>('idle');
    const [changeCodeError, setChangeCodeError] = useState<string | null>(null);
    const [useCodeError, setUseCodeError] = useState<string | null>(null);
    const [isChangingCode, setIsChangingCode] = useState(false);
    const [isUsingCode, setIsUsingCode] = useState(false);
    const referralCode = data?.myCode ?? '';
    const referralLink = data?.referralLink ?? '';
    const usedReferral = data?.usedReferral ?? null;
    const usedReferralRewarded = usedReferral?.rewarded === true;
    const canEditUsedReferral = Boolean(usedReferral && !usedReferralRewarded);
    const referredAccounts = data?.referredAccounts ?? [];
    const trimmedUseCode = useCode.trim();
    const useCodeUnchanged = Boolean(
        usedReferral && trimmedUseCode === usedReferral.code,
    );

    useEffect(() => {
        if (usedReferral && !usedReferralRewarded) {
            setUseCode(usedReferral.code);
            return;
        }
        if (!usedReferral) {
            setUseCode('');
        }
    }, [usedReferral, usedReferralRewarded]);

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
                setChangeCodeError(
                    await errorMessageFromResponse(
                        response,
                        'Kod nije spremljen',
                    ),
                );
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
        setUseCodeError(null);
        try {
            const response =
                await clientAuthenticated().api.accounts.current.referrals.use.$post(
                    {
                        json: { code: trimmedUseCode },
                    },
                );
            if (!response.ok) {
                setUseCodeError(
                    await errorMessageFromResponse(
                        response,
                        'Kod preporuke nije iskorišten',
                    ),
                );
                return;
            }
            const payload: unknown = await response.json().catch(() => null);
            const rewardGranted = referralRewardGrantedFromPayload(payload);
            if (rewardGranted) {
                setShowRewardConfetti(true);
                window.setTimeout(() => setShowRewardConfetti(false), 3500);
                await queryClient.invalidateQueries({
                    queryKey: currentAccountKeys,
                });
            } else {
                setUseCode('');
            }
            await refetch();
        } finally {
            setIsUsingCode(false);
        }
    }

    return (
        <Stack spacing={8} className="relative">
            {showRewardConfetti ? (
                <div className="pointer-events-none fixed inset-0 z-50">
                    <Confetti mode="fall" particleCount={80} />
                </div>
            ) : null}
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
                        pozvani račun posadi svoje prvo povrće u gredici. Kod se
                        može iskoristiti jednom po računu, a isti kod može
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
                    <CardContent noHeader>
                        {usedReferral ? (
                            <Stack spacing={4}>
                                <Stack spacing={2}>
                                    <div className="text-sm font-semibold">
                                        Iskorišten kod preporuke
                                    </div>
                                    <Alert
                                        color={
                                            usedReferralRewarded
                                                ? 'success'
                                                : 'info'
                                        }
                                        startDecorator={
                                            usedReferralRewarded ? (
                                                <Check className="size-4" />
                                            ) : (
                                                <Info className="size-4" />
                                            )
                                        }
                                    >
                                        <Typography level="body2">
                                            {usedReferralRewarded
                                                ? 'Nagrada za kod preporuke je dodijeljena. Za ovaj račun više nije moguće unijeti drugi kod.'
                                                : 'Kod preporuke je spremljen. Možeš ga promijeniti dok nagrada za preporuku ne bude dodijeljena.'}
                                        </Typography>
                                    </Alert>
                                </Stack>
                                <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
                                    <UserAvatar
                                        avatarUrl={
                                            usedReferral.account?.avatarUrl
                                        }
                                        displayName={
                                            usedReferral.account?.displayName ??
                                            'Nepoznat račun'
                                        }
                                        className="size-9"
                                    />
                                    <Stack spacing={0}>
                                        <Typography level="body2" semiBold>
                                            {usedReferral.account
                                                ?.displayName ??
                                                'Nepoznat račun'}
                                        </Typography>
                                        <Typography level="body3">
                                            Kod: {usedReferral.code}
                                        </Typography>
                                    </Stack>
                                </div>
                                {canEditUsedReferral ? (
                                    <form
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            void redeemReferralCode();
                                        }}
                                    >
                                        <Stack spacing={6}>
                                            <Stack spacing={2}>
                                                {useCodeError ? (
                                                    <Alert color="danger">
                                                        <Typography level="body2">
                                                            {useCodeError}
                                                        </Typography>
                                                    </Alert>
                                                ) : null}
                                                <Input
                                                    fullWidth
                                                    label="Promijeni kod preporuke"
                                                    value={useCode}
                                                    onChange={(e) =>
                                                        setUseCode(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Unesi kod"
                                                    disabled={isUsingCode}
                                                />
                                            </Stack>
                                            <CardActions className="justify-end">
                                                <Button
                                                    disabled={
                                                        !trimmedUseCode ||
                                                        useCodeUnchanged ||
                                                        isUsingCode
                                                    }
                                                    loading={isUsingCode}
                                                    size="sm"
                                                    type="submit"
                                                    variant="solid"
                                                >
                                                    Promijeni kod
                                                </Button>
                                            </CardActions>
                                        </Stack>
                                    </form>
                                ) : null}
                            </Stack>
                        ) : (
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void redeemReferralCode();
                                }}
                            >
                                <Stack spacing={6}>
                                    <Stack spacing={2}>
                                        <div className="text-sm font-semibold">
                                            Iskoristi kod preporuke
                                        </div>
                                        {useCodeError ? (
                                            <Alert color="danger">
                                                <Typography level="body2">
                                                    {useCodeError}
                                                </Typography>
                                            </Alert>
                                        ) : null}
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
                            </form>
                        )}
                    </CardContent>
                </Card>
                {referredAccounts.length > 0 ? (
                    <Card>
                        <CardContent noHeader className="space-y-3">
                            <div className="text-sm font-semibold">
                                Preporučeni računi
                            </div>
                            <ul className="space-y-2">
                                {referredAccounts.map((u) => (
                                    <li
                                        key={u.accountId}
                                        className="flex items-center gap-3 rounded-md border bg-muted/40 p-3"
                                    >
                                        <UserAvatar
                                            avatarUrl={u.account?.avatarUrl}
                                            displayName={
                                                u.account?.displayName ??
                                                'Nepoznat račun'
                                            }
                                            className="size-9"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <Typography
                                                level="body2"
                                                semiBold
                                                noWrap
                                            >
                                                {u.account?.displayName ??
                                                    'Nepoznat račun'}
                                            </Typography>
                                            <Typography
                                                level="body3"
                                                tertiary
                                                noWrap
                                            >
                                                {u.rewarded
                                                    ? 'Nagrada dodijeljena'
                                                    : 'Čeka prvu sadnju'}
                                            </Typography>
                                        </div>
                                        <span
                                            aria-label={
                                                u.rewarded
                                                    ? 'Nagrada dodijeljena'
                                                    : 'Čeka prvu sadnju'
                                            }
                                            className="text-base"
                                            role="img"
                                        >
                                            {u.rewarded ? '✅' : '⏳'}
                                        </span>
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
