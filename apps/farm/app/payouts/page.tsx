import {
    getFarmerBalance,
    getFarmerPayoutRequests,
    getFarms,
} from '@gredice/storage';

export const dynamic = 'force-dynamic';
import { formatPrice } from '@gredice/js/currency';
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
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import LoginDialog from '../../components/auth/LoginDialog';
import { auth } from '../../lib/auth/auth';
import { PayoutRequestForm } from './PayoutRequestForm';

const payoutStatusLabel: Record<
    string,
    { label: string; color: 'neutral' | 'warning' | 'info' | 'success' | 'error' }
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

async function PayoutsContent() {
    const { userId } = await auth(['farmer', 'admin']);

    const farms = await getFarms();

    const [balanceResults, allPayouts] = await Promise.all([
        Promise.all(farms.map((f) => getFarmerBalance(userId, f.id))),
        getFarmerPayoutRequests(userId),
    ]);

    const totalEarned = balanceResults.reduce(
        (s, b) => s + b.totalEarned,
        0,
    );
    const totalPaid = balanceResults.reduce((s, b) => s + b.totalPaid, 0);
    const totalPending = balanceResults.reduce(
        (s, b) => s + b.totalPending,
        0,
    );
    const availableBalance = Math.max(
        0,
        totalEarned - totalPaid - totalPending,
    );
    const currency =
        balanceResults.find((b) => b.currency)?.currency ?? 'eur';

    const earningsByType = balanceResults.flatMap((b) => b.earningsByType);

    const farmWithBalance =
        farms.find((_, i) => balanceResults[i].totalEarned > 0) ?? farms[0];

    return (
        <div className="max-w-5xl mx-auto w-full p-4 space-y-4">
            {/* Balance Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent noHeader>
                        <Stack spacing={1}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Ukupno zarađeno
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
            </div>

            {/* Earnings breakdown */}
            {earningsByType.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Zarađeno po vrsti radnje</CardTitle>
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
                                        Cijena / radnja
                                    </Table.Head>
                                    <Table.Head className="text-right">
                                        Ukupno
                                    </Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {earningsByType.map((e) => (
                                    <Table.Row key={e.entityTypeName}>
                                        <Table.Cell>
                                            {earningTypeLabel[e.entityTypeName] ??
                                                e.entityTypeLabel ??
                                                e.entityTypeName}
                                        </Table.Cell>
                                        <Table.Cell className="text-right tabular-nums">
                                            {e.operationCount}
                                        </Table.Cell>
                                        <Table.Cell className="text-right tabular-nums">
                                            {formatPrice(e.pricePerUnit)}
                                        </Table.Cell>
                                        <Table.Cell className="text-right tabular-nums font-medium">
                                            {formatPrice(e.totalEarned)}
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
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
                        <Typography level="body2" className="text-muted-foreground">
                            {totalPending > 0
                                ? `Imaš ${formatPrice(totalPending)} u zahtjevima na čekanju. Pričekaj da administrator obradi zahtjev.`
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

export default function PayoutsPage() {
    const authFarmer = auth.bind(null, ['farmer', 'admin']);

    return (
        <div className="min-h-[100dvh] w-full bg-muted">
            <AuthProtectedSection auth={authFarmer}>
                <PayoutsContent />
            </AuthProtectedSection>
            <SignedOut auth={authFarmer}>
                <LoginDialog />
            </SignedOut>
        </div>
    );
}
