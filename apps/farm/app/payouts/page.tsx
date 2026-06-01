import { formatPrice } from '@gredice/js/currency';
import {
    type FarmerEarning,
    getFarmerBalance,
    getFarmPayoutRequests,
    getFarmsForUser,
} from '@gredice/storage';
import { AuthProtectedSection, SignedOut } from '@gredice/ui/auth/server';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { HomeButton } from '../../components/HomeButton';
import { auth } from '../../lib/auth/auth';
import { FarmPayoutFarmSelect } from './FarmPayoutFarmSelect';
import { PayoutRequestForm } from './PayoutRequestForm';

export const dynamic = 'force-dynamic';

type PayoutsPageProps = {
    searchParams: Promise<{ farmId?: string }>;
};

function parseFarmId(value: string | undefined) {
    if (!value) {
        return undefined;
    }

    const farmId = Number.parseInt(value, 10);
    return Number.isFinite(farmId) ? farmId : undefined;
}

const payoutStatusLabel: Record<
    string,
    {
        label: string;
        color: 'neutral' | 'warning' | 'info' | 'success' | 'error';
    }
> = {
    pending: { label: 'Na čekanju', color: 'warning' },
    approved: { label: 'Odobreno', color: 'info' },
    paid: { label: 'Isplaćeno', color: 'success' },
    rejected: { label: 'Odbijeno', color: 'error' },
};

const earningTypeLabel: Record<string, string> = {
    sowing: 'Sijanje (direktno)',
    sowingGreenhouse: 'Sijanje (staklenički rasad)',
};

function getEarningLabel(earning: FarmerEarning) {
    return (
        earningTypeLabel[earning.entityTypeName] ??
        earning.entityLabel ??
        earning.entityTypeName
    );
}

function getEarningKey(earning: FarmerEarning) {
    return [
        earning.entityTypeName,
        earning.entityId ?? 'none',
        earning.entityLabel ?? '',
        earning.durationMinutes,
        earning.pricePerUnit,
        earning.currency,
    ].join(':');
}

function formatDuration(minutes: number) {
    const roundedMinutes = Math.ceil(Math.max(0, minutes));
    const hours = Math.floor(roundedMinutes / 60);
    const remainingMinutes = roundedMinutes % 60;

    if (hours > 0 && remainingMinutes > 0) {
        return `${hours} h ${remainingMinutes} min`;
    }

    if (hours > 0) {
        return `${hours} h`;
    }

    return `${remainingMinutes} min`;
}

function formatWage(amount: number | null, unit: string) {
    if (amount === null) {
        return '—';
    }

    return `${formatPrice(amount)} / ${unit}`;
}

function mergeEarnings(earnings: FarmerEarning[]) {
    const merged = new Map<string, FarmerEarning>();

    for (const earning of earnings) {
        const key = getEarningKey(earning);
        const existing = merged.get(key);
        if (existing) {
            existing.operationCount += earning.operationCount;
            existing.totalDurationMinutes += earning.totalDurationMinutes;
            existing.totalEarned += earning.totalEarned;
            continue;
        }

        merged.set(key, { ...earning });
    }

    return Array.from(merged.values()).sort((left, right) =>
        getEarningLabel(left).localeCompare(getEarningLabel(right), 'hr', {
            numeric: true,
        }),
    );
}

async function PayoutsContent({ selectedFarmId }: { selectedFarmId?: number }) {
    const { userId } = await auth(['farmer', 'admin']);

    const farms = await getFarmsForUser(userId);
    const selectedFarm =
        farms.find((farm) => farm.id === selectedFarmId) ?? farms[0];

    if (!selectedFarm) {
        return (
            <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
                <div className="flex min-w-0 items-center">
                    <HomeButton />
                </div>
                <Card>
                    <CardContent>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Nema dodijeljenih farmi.
                        </Typography>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const [balance, allPayouts] = await Promise.all([
        getFarmerBalance(userId, selectedFarm.id),
        getFarmPayoutRequests(selectedFarm.id),
    ]);

    const totalEarned = balance.totalEarned;
    const totalPaid = balance.totalPaid;
    const totalPending = balance.totalPending;
    const availableBalance = balance.availableBalance;
    const currency = balance.currency;

    const earningsByType = mergeEarnings(balance.earningsByType);
    const totalOperationCount = earningsByType.reduce(
        (total, earning) => total + earning.operationCount,
        0,
    );
    const totalDurationMinutes = earningsByType.reduce(
        (total, earning) => total + earning.totalDurationMinutes,
        0,
    );
    const minuteWage =
        totalDurationMinutes > 0 ? totalEarned / totalDurationMinutes : null;
    const hourlyWage = minuteWage === null ? null : minuteWage * 60;

    const farmWithBalance = selectedFarm;

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            <div className="flex min-w-0 items-center">
                <HomeButton />
            </div>

            {farms.length > 1 && (
                <Card>
                    <CardContent noHeader>
                        <FarmPayoutFarmSelect
                            farms={farms.map((farm) => ({
                                id: farm.id,
                                name: farm.name,
                            }))}
                            selectedFarmId={selectedFarm.id}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Balance Summary */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardContent noHeader>
                        <Stack spacing={1}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Zarađeno za isplatu
                            </Typography>
                            <Typography
                                level="h4"
                                semiBold
                                className="tabular-nums"
                            >
                                {formatPrice(totalEarned)}
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent noHeader>
                        <Stack spacing={1}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Raspoloživo za isplatu
                            </Typography>
                            <Typography
                                level="h4"
                                semiBold
                                className="tabular-nums text-green-700"
                            >
                                {formatPrice(availableBalance)}
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent noHeader>
                        <Stack spacing={1}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Ukupno isplaćeno
                            </Typography>
                            <Typography
                                level="h4"
                                semiBold
                                className="tabular-nums"
                            >
                                {formatPrice(totalPaid)}
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent noHeader>
                        <Stack spacing={1}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Ukupno vrijeme
                            </Typography>
                            <Typography
                                level="h4"
                                semiBold
                                className="tabular-nums"
                            >
                                {formatDuration(totalDurationMinutes)}
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent noHeader>
                        <Stack spacing={1}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Zarada / minuta
                            </Typography>
                            <Typography
                                level="h4"
                                semiBold
                                className="tabular-nums"
                            >
                                {formatWage(minuteWage, 'min')}
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent noHeader>
                        <Stack spacing={1}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Zarada / sat
                            </Typography>
                            <Typography
                                level="h4"
                                semiBold
                                className="tabular-nums"
                            >
                                {formatWage(hourlyWage, 'h')}
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            </div>

            {/* Earnings breakdown */}
            {earningsByType.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Radnje za isplatu</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Vrsta radnje</Table.Head>
                                    <Table.Head className="text-right">
                                        Broj radnji
                                    </Table.Head>
                                    <Table.Head className="text-right">
                                        Vrijeme
                                    </Table.Head>
                                    <Table.Head className="text-right">
                                        Cijena / radnja
                                    </Table.Head>
                                    <Table.Head className="text-right">
                                        Ukupno
                                    </Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {earningsByType.map((e) => (
                                    <Table.Row key={getEarningKey(e)}>
                                        <Table.Cell>
                                            {getEarningLabel(e)}
                                        </Table.Cell>
                                        <Table.Cell className="text-right tabular-nums">
                                            {e.operationCount}
                                        </Table.Cell>
                                        <Table.Cell className="text-right tabular-nums">
                                            {formatDuration(
                                                e.totalDurationMinutes,
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="text-right tabular-nums">
                                            {formatPrice(e.pricePerUnit)}
                                        </Table.Cell>
                                        <Table.Cell className="text-right tabular-nums font-medium">
                                            {formatPrice(e.totalEarned)}
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                                <Table.Row className="bg-muted/40 font-medium hover:bg-muted/40">
                                    <Table.Cell>Ukupno</Table.Cell>
                                    <Table.Cell className="text-right tabular-nums">
                                        {totalOperationCount}
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums">
                                        {formatDuration(totalDurationMinutes)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        —
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums font-semibold">
                                        {formatPrice(totalEarned)}
                                    </Table.Cell>
                                </Table.Row>
                            </Table.Body>
                        </Table>
                    </CardOverflow>
                </Card>
            )}

            {/* Request payout */}
            {farmWithBalance && availableBalance > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Zatraži isplatu</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PayoutRequestForm
                            farmId={farmWithBalance.id}
                            availableBalance={availableBalance}
                            currency={currency}
                        />
                    </CardContent>
                </Card>
            )}

            {availableBalance <= 0 && totalEarned <= 0 && (
                <Card>
                    <CardContent>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Još nema zarađenih iznosa. Završi i verificiraj
                            radnje kako bi se iznos pojavio ovdje.
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {availableBalance <= 0 && totalEarned > 0 && (
                <Card>
                    <CardContent>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            {totalPending > 0
                                ? `Farma ima ${formatPrice(totalPending)} u zahtjevima na čekanju. Pričekaj da administrator obradi zahtjev.`
                                : 'Svi iznosi su isplaćeni.'}
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {/* Payout history */}
            {allPayouts.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Povijest isplata</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Iznos</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Referenca</Table.Head>
                                    <Table.Head>Datum</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {allPayouts.map((p) => {
                                    const statusCfg = payoutStatusLabel[
                                        p.status
                                    ] ?? {
                                        label: p.status,
                                        color: 'neutral' as const,
                                    };
                                    return (
                                        <Table.Row key={p.id}>
                                            <Table.Cell className="tabular-nums font-medium">
                                                {formatPrice(
                                                    parseFloat(
                                                        p.requestedAmount,
                                                    ),
                                                )}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Chip
                                                    color={statusCfg.color}
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    {statusCfg.label}
                                                </Chip>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground font-mono"
                                                >
                                                    {p.bankReference ??
                                                        p.rejectionReason ??
                                                        '—'}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <LocalDateTime time={false}>
                                                    {p.paidAt ??
                                                        p.rejectedAt ??
                                                        p.createdAt}
                                                </LocalDateTime>
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                            </Table.Body>
                        </Table>
                    </CardOverflow>
                </Card>
            )}
        </div>
    );
}

export default async function PayoutsPage({ searchParams }: PayoutsPageProps) {
    const { farmId } = await searchParams;
    const selectedFarmId = parseFarmId(farmId);
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <PayoutsContent selectedFarmId={selectedFarmId} />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
