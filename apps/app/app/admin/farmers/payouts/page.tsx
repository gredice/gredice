import { getAllPayoutRequests } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import {
    approvePayoutAction,
    rejectPayoutAction,
} from '../../../(actions)/payoutAdminActions';
import { MarkAsPaidForm } from './MarkAsPaidForm';
import { PayoutStatusChip } from './PayoutStatusChip';

export const dynamic = 'force-dynamic';

function formatAmount(amount: string, currency: string) {
    const value = parseFloat(amount);
    return new Intl.NumberFormat('hr-HR', {
        style: 'currency',
        currency: currency.toUpperCase(),
    }).format(value);
}

export default async function AdminFarmerPayoutsPage() {
    await auth(['admin']);
    const payouts = await getAllPayoutRequests();

    const pending = payouts.filter((p) => p.status === 'pending');
    const other = payouts.filter((p) => p.status !== 'pending');

    return (
        <Stack spacing={6}>
            <Stack spacing={2}>
                <Typography level="h4" component="h1">
                    Isplate farmera
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Upravljanje zahtjevima za isplatu od farmera. Odobri
                    zahtjev, izvrši bankovni prijenos i potvrdi isplatu.
                </Typography>
            </Stack>

            {/* Pending */}
            <Card>
                <CardHeader>
                    <Row justifyContent="space-between" spacing={2}>
                        <CardTitle>Na čekanju ({pending.length})</CardTitle>
                    </Row>
                </CardHeader>
                {pending.length === 0 ? (
                    <CardContent>
                        <NoDataPlaceholder>
                            Nema zahtjeva na čekanju.
                        </NoDataPlaceholder>
                    </CardContent>
                ) : (
                    <CardOverflow>
                        <div className="overflow-auto">
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>Farmer</Table.Head>
                                        <Table.Head>Farma</Table.Head>
                                        <Table.Head>Iznos</Table.Head>
                                        <Table.Head>Napomena</Table.Head>
                                        <Table.Head>Zatraženo</Table.Head>
                                        <Table.Head>Radnja</Table.Head>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {pending.map((payout) => (
                                        <Table.Row key={payout.id}>
                                            <Table.Cell>
                                                <Typography level="body2" semiBold>
                                                    {payout.displayName ??
                                                        payout.userName}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell>
                                                {payout.farmName}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Typography
                                                    level="body2"
                                                    semiBold
                                                    className="tabular-nums"
                                                >
                                                    {formatAmount(
                                                        payout.requestedAmount,
                                                        payout.currency,
                                                    )}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    {payout.farmerNote ?? '—'}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <LocalDateTime>
                                                    {payout.createdAt}
                                                </LocalDateTime>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Row spacing={2}>
                                                    <form
                                                        action={approvePayoutAction.bind(
                                                            null,
                                                            payout.id,
                                                            undefined,
                                                        )}
                                                    >
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                        >
                                                            Odobri
                                                        </Button>
                                                    </form>
                                                    <form
                                                        action={rejectPayoutAction.bind(
                                                            null,
                                                            payout.id,
                                                            undefined,
                                                        )}
                                                    >
                                                        <Button
                                                            type="submit"
                                                            size="sm"
                                                            variant="outlined"
                                                        >
                                                            Odbij
                                                        </Button>
                                                    </form>
                                                </Row>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </div>
                    </CardOverflow>
                )}
            </Card>

            {/* Approved — ready for bank transfer */}
            {(() => {
                const approved = payouts.filter(
                    (p) => p.status === 'approved',
                );
                return approved.length > 0 ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Odobreno — čeka bankovni prijenos (
                                {approved.length})
                            </CardTitle>
                        </CardHeader>
                        <CardOverflow>
                            <div className="overflow-auto">
                                <Table>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.Head>Farmer</Table.Head>
                                            <Table.Head>Farma</Table.Head>
                                            <Table.Head>Iznos</Table.Head>
                                            <Table.Head>Odobreno</Table.Head>
                                            <Table.Head>Radnja</Table.Head>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {approved.map((payout) => (
                                            <Table.Row key={payout.id}>
                                                <Table.Cell>
                                                    <Typography
                                                        level="body2"
                                                        semiBold
                                                    >
                                                        {payout.displayName ??
                                                            payout.userName}
                                                    </Typography>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    {payout.farmName}
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <Typography
                                                        level="body2"
                                                        semiBold
                                                        className="tabular-nums"
                                                    >
                                                        {formatAmount(
                                                            payout.requestedAmount,
                                                            payout.currency,
                                                        )}
                                                    </Typography>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <LocalDateTime>
                                                        {payout.approvedAt}
                                                    </LocalDateTime>
                                                </Table.Cell>
                                                <Table.Cell>
                                                    <MarkAsPaidForm
                                                        id={payout.id}
                                                        farmerName={
                                                            payout.displayName ??
                                                            payout.userName
                                                        }
                                                    />
                                                </Table.Cell>
                                            </Table.Row>
                                        ))}
                                    </Table.Body>
                                </Table>
                            </div>
                        </CardOverflow>
                    </Card>
                ) : null;
            })()}

            {/* History */}
            <Card>
                <CardHeader>
                    <CardTitle>Povijest isplata</CardTitle>
                </CardHeader>
                {other.length === 0 ? (
                    <CardContent>
                        <NoDataPlaceholder>
                            Nema završenih zahtjeva.
                        </NoDataPlaceholder>
                    </CardContent>
                ) : (
                    <CardOverflow>
                        <div className="overflow-auto">
                            <Table>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.Head>Farmer</Table.Head>
                                        <Table.Head>Farma</Table.Head>
                                        <Table.Head>Iznos</Table.Head>
                                        <Table.Head>Status</Table.Head>
                                        <Table.Head>Referenca</Table.Head>
                                        <Table.Head>Datum</Table.Head>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {other.map((payout) => (
                                        <Table.Row key={payout.id}>
                                            <Table.Cell>
                                                {payout.displayName ??
                                                    payout.userName}
                                            </Table.Cell>
                                            <Table.Cell>
                                                {payout.farmName}
                                            </Table.Cell>
                                            <Table.Cell>
                                                <span className="tabular-nums">
                                                    {formatAmount(
                                                        payout.requestedAmount,
                                                        payout.currency,
                                                    )}
                                                </span>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <PayoutStatusChip
                                                    status={payout.status}
                                                />
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground font-mono"
                                                >
                                                    {payout.bankReference ??
                                                        payout.rejectionReason ??
                                                        '—'}
                                                </Typography>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <LocalDateTime>
                                                    {payout.paidAt ??
                                                        payout.rejectedAt ??
                                                        payout.createdAt}
                                                </LocalDateTime>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </div>
                    </CardOverflow>
                )}
            </Card>
        </Stack>
    );
}
