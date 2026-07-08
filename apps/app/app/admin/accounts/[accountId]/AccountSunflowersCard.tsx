import { getAchievementDefinition } from '@gredice/js/achievements';
import {
    earnSunflowers,
    getSunflowers,
    getSunflowersHistory,
    knownEventTypes,
} from '@gredice/storage';
import { BlockImage, getBlockImageUrl } from '@gredice/ui/BlockImage';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import {
    Add,
    Calendar,
    Heart,
    History,
    ListTodo,
    People,
    Reset,
    ShoppingCart,
    Sprout,
    Verified,
    Wallet,
} from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Popper } from '@gredice/ui/Popper';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { revalidatePath } from 'next/cache';
import Image from 'next/image';
import type { ReactNode } from 'react';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

type SunflowerHistoryEvent = Awaited<
    ReturnType<typeof getSunflowersHistory>
>[number];

type SunflowerLedgerTone = 'earned' | 'spent' | 'neutral';

const sunflowerIconUrl = 'https://cdn.gredice.com/sunflower-large.svg';

function formatSunflowerAmount(amount: number) {
    return amount.toLocaleString('hr-HR', {
        maximumFractionDigits: 0,
    });
}

function getSignedSunflowerAmount(event: SunflowerHistoryEvent) {
    const amount = Math.abs(event.amount);
    return event.type === knownEventTypes.accounts.spendSunflowers
        ? -amount
        : amount;
}

function formatSignedSunflowerAmount(amount: number) {
    return amount > 0
        ? `+${formatSunflowerAmount(amount)}`
        : formatSunflowerAmount(amount);
}

function formatHistoryCount(count: number) {
    const label = count === 1 ? 'zapis' : 'zapisa';
    return `${count.toLocaleString('hr-HR')} ${label}`;
}

function iconFrame(children: ReactNode, tone: SunflowerLedgerTone = 'neutral') {
    return (
        <span
            className={cx(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                tone === 'earned' &&
                    'bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-100',
                tone === 'spent' &&
                    'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200',
                tone === 'neutral' &&
                    'bg-muted text-muted-foreground dark:bg-muted/70',
            )}
        >
            {children}
        </span>
    );
}

function blockIcon(blockName: string | undefined, tone: SunflowerLedgerTone) {
    if (!blockName || !getBlockImageUrl(blockName)) {
        return iconFrame(<Sprout className="size-5" aria-hidden />, tone);
    }

    return iconFrame(
        <BlockImage
            alt={blockName}
            blockName={blockName}
            className="size-8 object-contain"
            height={32}
            width={32}
        />,
        tone,
    );
}

function getSunflowerReasonSummary(event: SunflowerHistoryEvent) {
    const signedAmount = getSignedSunflowerAmount(event);
    const tone: SunflowerLedgerTone =
        signedAmount < 0 ? 'spent' : signedAmount > 0 ? 'earned' : 'neutral';
    const reason =
        event.reason ??
        (event.type === knownEventTypes.accounts.earnSunflowerDrop
            ? 'sunflowerDrop'
            : undefined);
    const reasonPrefix = reason?.split(':')[0];
    const reasonDetail = reason?.split(':')[1];

    if (reason === 'registration') {
        return {
            icon: iconFrame(<Verified className="size-5" aria-hidden />, tone),
            label: 'Nagrada za registraciju',
            description: 'Početni bonus dodijeljen pri stvaranju računa.',
            reason,
        };
    }

    if (reasonPrefix === 'achievement') {
        const definition = reasonDetail
            ? getAchievementDefinition(reasonDetail)
            : undefined;
        return {
            icon: iconFrame(<Verified className="size-5" aria-hidden />, tone),
            label: definition
                ? `Postignuće: ${definition.title}`
                : 'Nagrada za postignuće',
            description:
                definition?.description ??
                'Suncokreti dodijeljeni za ostvareno postignuće.',
            reason,
        };
    }

    if (reasonPrefix === 'daily') {
        const day = reasonDetail ? `${reasonDetail}. dan` : 'Dnevni niz';
        return {
            icon: iconFrame(<Calendar className="size-5" aria-hidden />, tone),
            label: 'Dnevna aktivnost',
            description: `${day} aktivnosti u vrtu.`,
            reason,
        };
    }

    if (reasonPrefix === 'tutorial') {
        return {
            icon: iconFrame(<ListTodo className="size-5" aria-hidden />, tone),
            label: 'Zadaci za novi vrt',
            description: 'Nagrada iz uvodnog popisa zadataka.',
            reason,
        };
    }

    if (reason === 'sunflowerDrop') {
        return {
            icon: iconFrame(
                <Image
                    alt="Suncokret"
                    className="size-8"
                    height={32}
                    src={sunflowerIconUrl}
                    width={32}
                />,
                tone,
            ),
            label: 'Suncokret iz vrta',
            description: 'Skupljeno iz posebnog suncokreta u vrtu.',
            reason,
        };
    }

    if (reasonPrefix === 'block') {
        return {
            icon: blockIcon(reasonDetail, tone),
            label: 'Postavljanje bloka',
            description: 'Suncokreti potrošeni za uređenje vrta.',
            reason,
        };
    }

    if (reasonPrefix === 'recycle') {
        return {
            icon: iconFrame(<Reset className="size-5" aria-hidden />, tone),
            label: 'Recikliranje bloka',
            description: 'Povrat suncokreta nakon recikliranja.',
            reason,
        };
    }

    if (reason === 'gift') {
        return {
            icon: iconFrame(<Heart className="size-5" aria-hidden />, tone),
            label: 'Poklon',
            description: 'Ručno dodijeljeno iz administracije.',
            reason,
        };
    }

    if (reason === 'payment') {
        return {
            icon: iconFrame(<Wallet className="size-5" aria-hidden />, tone),
            label: 'Bonus za plaćanje',
            description: 'Suncokreti dodijeljeni nakon plaćanja.',
            reason,
        };
    }

    if (
        reasonPrefix === 'shoppingCart' ||
        reasonPrefix === 'shoppingCartItem'
    ) {
        return {
            icon: iconFrame(
                <ShoppingCart className="size-5" aria-hidden />,
                tone,
            ),
            label:
                reasonPrefix === 'shoppingCartItem'
                    ? 'Stavka košarice'
                    : 'Kupnja',
            description: 'Potrošnja kroz korisničku košaricu.',
            reason,
        };
    }

    if (reasonPrefix === 'refund') {
        return {
            icon: iconFrame(<Reset className="size-5" aria-hidden />, tone),
            label: 'Povrat sredstava',
            description: 'Vraćeni suncokreti nakon otkazivanja ili promjene.',
            reason,
        };
    }

    if (reasonPrefix === 'referral') {
        return {
            icon: iconFrame(<People className="size-5" aria-hidden />, tone),
            label: 'Preporuka',
            description: 'Nagrada povezana s preporukom računa.',
            reason,
        };
    }

    if (reasonPrefix === 'birthday') {
        return {
            icon: iconFrame(<Heart className="size-5" aria-hidden />, tone),
            label: 'Rođendanski poklon',
            description: 'Posebna rođendanska nagrada.',
            reason,
        };
    }

    return {
        icon: iconFrame(<History className="size-5" aria-hidden />, tone),
        label:
            event.type === knownEventTypes.accounts.spendSunflowers
                ? 'Potrošnja suncokreta'
                : 'Dodani suncokreti',
        description: reason
            ? `Razlog: ${reason}`
            : 'Događaj nema spremljen opis razloga.',
        reason,
    };
}

export async function AccountSunflowersCard({
    accountId,
}: {
    accountId: string;
}) {
    const currentSunflowers = await getSunflowers(accountId);
    const history = await getSunflowersHistory(accountId, 0, 10000);

    async function submitGiftSunflowers(formData: FormData) {
        'use server';
        await auth(['admin']);
        const amountValue = formData.get('amount');
        const reasonValue = formData.get('reason');
        const amount =
            typeof amountValue === 'string'
                ? Number.parseInt(amountValue, 10)
                : 0;
        const reason = typeof reasonValue === 'string' ? reasonValue : 'gift';
        await earnSunflowers(accountId, amount, reason);
        revalidatePath(KnownPages.Account(accountId));
    }

    return (
        <Card className={scrollableTableCardClassName}>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                <div className="flex min-w-0 items-center gap-2">
                    <CardTitle>Suncokreti</CardTitle>
                    <Chip size="sm" variant="soft">
                        {formatHistoryCount(history.length)}
                    </Chip>
                </div>
                <Popper
                    align="end"
                    className="w-80 p-3"
                    trigger={
                        <IconButton title="Dodjeli suncokrete">
                            <Add className="size-5" />
                        </IconButton>
                    }
                >
                    <Stack spacing={4}>
                        <Typography level="h5">Dodjeli suncokrete</Typography>
                        <form action={submitGiftSunflowers} className="min-w-0">
                            <Stack className="min-w-0" spacing={4}>
                                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                                    <Input
                                        label="Iznos"
                                        type="number"
                                        name="amount"
                                        defaultValue="0"
                                        fullWidth
                                    />
                                    <SelectItems
                                        className="min-w-0"
                                        label="Razlog"
                                        name="reason"
                                        defaultValue="gift"
                                        items={[
                                            { value: 'gift', label: 'Poklon' },
                                        ]}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    startDecorator={<Add className="size-5" />}
                                >
                                    Dodjeli
                                </Button>
                            </Stack>
                        </form>
                    </Stack>
                </Popper>
            </CardHeader>
            <CardContent className="pb-3">
                <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-yellow-50 text-yellow-800 dark:bg-yellow-950">
                        <Image
                            alt="Suncokret"
                            className="size-10"
                            height={40}
                            src={sunflowerIconUrl}
                            width={40}
                        />
                    </span>
                    <Stack spacing={0.5} className="min-w-0">
                        <Typography
                            level="body3"
                            className="font-medium uppercase text-muted-foreground"
                        >
                            Ukupno na računu
                        </Typography>
                        <Typography
                            level="h5"
                            className="tabular-nums leading-tight"
                        >
                            {formatSunflowerAmount(currentSunflowers)}
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Suncokreti dostupni za vrt, kupnju i nagrade.
                        </Typography>
                    </Stack>
                </div>
            </CardContent>
            <CardOverflow className={scrollableTableCardOverflowClassName}>
                {history.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>Nema suncokreta</NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {history.map((sunflower) => {
                            const summary =
                                getSunflowerReasonSummary(sunflower);
                            const amount = getSignedSunflowerAmount(sunflower);
                            return (
                                <li
                                    key={sunflower.id}
                                    className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                >
                                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex min-w-0 gap-3">
                                            {summary.icon}
                                            <Stack
                                                spacing={1}
                                                className="min-w-0"
                                            >
                                                <Typography
                                                    level="body2"
                                                    semiBold
                                                    className="min-w-0 break-words"
                                                >
                                                    {summary.label}
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    className="min-w-0 break-words text-muted-foreground"
                                                >
                                                    {summary.description}
                                                </Typography>
                                                {summary.reason ? (
                                                    <Typography
                                                        component="span"
                                                        level="body3"
                                                        mono
                                                        className="min-w-0 break-all text-muted-foreground"
                                                    >
                                                        {summary.reason}
                                                    </Typography>
                                                ) : null}
                                            </Stack>
                                        </div>
                                        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                                            <Chip
                                                color={
                                                    amount < 0
                                                        ? 'error'
                                                        : 'success'
                                                }
                                                size="sm"
                                                variant="soft"
                                                className="w-fit tabular-nums"
                                            >
                                                {formatSignedSunflowerAmount(
                                                    amount,
                                                )}{' '}
                                                suncokreta
                                            </Chip>
                                            <div className="flex flex-col gap-1 text-left sm:items-end sm:text-right">
                                                <Typography
                                                    component="div"
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    <LocalDateTime>
                                                        {sunflower.createdAt}
                                                    </LocalDateTime>
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    ID: {sunflower.id}
                                                </Typography>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardOverflow>
        </Card>
    );
}
