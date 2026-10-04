import { formatPrice } from '@gredice/js/currency';
import {
    getAllPayoutRequests,
    type PayoutRequestWithDetails,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { ArrowDownToLine } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { isMissingPayoutSchemaError } from '../payoutSchemaStatus';
import { ApprovePayoutForm, RejectPayoutForm } from './ApprovePayoutForm';
import { MarkAsPaidForm } from './MarkAsPaidForm';
import { PayoutStatusChip } from './PayoutStatusChip';

export const dynamic = 'force-dynamic';

function parseMoney(value: string) {
    const amount = Number.parseFloat(value);
    return Number.isFinite(amount) ? amount : 0;
}

function formatSignedPrice(value: string) {
    const amount = parseMoney(value);
    return amount > 0 ? `+${formatPrice(amount)}` : formatPrice(amount);
}

function payoutExportHref(payoutId: number) {
    return `/admin/farmers/payouts/${payoutId}/export`;
}

function PayoutCsvExportButton({ payoutId }: { payoutId: number }) {
    return (
        <Button
            href={payoutExportHref(payoutId)}
            download={`farmer-payout-${payoutId}.csv`}
            size="sm"
            variant="outlined"
            startDecorator={<ArrowDownToLine className="size-4" />}
        >
            CSV
        </Button>
    );
}

function PayoutAmountDetails({ payout }: { payout: PayoutRequestWithDetails }) {
    if (payout.adjustments.length === 0) {
        return (
            <Typography level="body2" semiBold className="tabular-nums">
                {formatPrice(parseMoney(payout.requestedAmount))}
            </Typography>
        );
    }

    return (
        <Stack spacing={1} className="min-w-52">
            <Typography level="body2" semiBold className="tabular-nums">
                {formatPrice(parseMoney(payout.requestedAmount))}
            </Typography>
            <Typography level="body3" className="text-muted-foreground">
                Zatraženo{' '}
                {formatPrice(parseMoney(payout.originalRequestedAmount))}
                {' · '}Korekcije {formatSignedPrice(payout.adjustmentTotal)}
            </Typography>
            <Stack spacing={0.5}>
                {payout.adjustments.map((adjustment) => (
                    <Row
                        key={adjustment.id}
                        justifyContent="space-between"
                        spacing={2}
                        className="text-muted-foreground"
                    >
                        <Typography level="body3" className="min-w-0 truncate">
                            {adjustment.label}
                        </Typography>
                        <Typography level="body3" className="tabular-nums">
                            {formatSignedPrice(adjustment.amount)}
                        </Typography>
                    </Row>
                ))}
            </Stack>
        </Stack>
    );
}

function PayoutListField({
    children,
    className,
    label,
}: {
    children: ReactNode;
    className?: string;
    label: string;
}) {
    return (
        <Stack spacing={0.5} className={cx('min-w-0', className)}>
            <Typography
                level="body3"
                semiBold
                className="text-muted-foreground"
            >
                {label}
            </Typography>
            {children}
        </Stack>
    );
}

function PayoutPrimaryDetails({
    note,
    noteLabel,
    payout,
}: {
    note?: string | null;
    noteLabel?: string;
    payout: PayoutRequestWithDetails;
}) {
    return (
        <Stack spacing={2} className="min-w-0 flex-1">
            <Stack spacing={0.5} className="min-w-0">
                <Typography
                    level="body2"
                    component="h3"
                    semiBold
                    className="min-w-0 break-words"
                >
                    {payout.displayName ?? payout.userName}
                </Typography>
                <Typography level="body3" className="text-muted-foreground">
                    Farmer
                </Typography>
            </Stack>
            <div
                className={cx(
                    'grid min-w-0 gap-3',
                    noteLabel ? 'sm:grid-cols-2' : 'sm:max-w-md',
                )}
            >
                <PayoutListField label="Farma">
                    <Typography level="body2" className="min-w-0 break-words">
                        {payout.farmName}
                    </Typography>
                </PayoutListField>
                {noteLabel ? (
                    <PayoutListField label={noteLabel}>
                        <Typography
                            level="body3"
                            className="min-w-0 whitespace-pre-line break-words text-muted-foreground"
                        >
                            {note ?? '—'}
                        </Typography>
                    </PayoutListField>
                ) : null}
            </div>
        </Stack>
    );
}

async function getPayoutsForPage() {
    try {
        return {
            payouts: await getAllPayoutRequests(),
            schemaAvailable: true,
        };
    } catch (error) {
        if (!isMissingPayoutSchemaError(error)) {
            throw error;
        }

        console.warn(
            'Farmer payout tables are not available in this database.',
        );
        return {
            payouts: [],
            schemaAvailable: false,
        };
    }
}

export default async function AdminFarmerPayoutsPage() {
    await auth(['admin']);
    const { payouts, schemaAvailable } = await getPayoutsForPage();

    const pending = payouts.filter((p) => p.status === 'pending');
    const approved = payouts.filter((p) => p.status === 'approved');
    const history = payouts.filter(
        (p) => p.status === 'paid' || p.status === 'rejected',
    );

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

            {!schemaAvailable && (
                <Card>
                    <CardContent>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Tablice za isplate nisu dostupne u ovoj bazi. Nakon
                            migracije podaci će se prikazati ovdje.
                        </Typography>
                    </CardContent>
                </Card>
            )}

            {/* Pending */}
            {schemaAvailable && (
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
                            <ul className="divide-y">
                                {pending.map((payout) => (
                                    <li
                                        key={payout.id}
                                        className="px-3 py-4 transition-colors hover:bg-muted/40 sm:px-4"
                                    >
                                        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                            <PayoutPrimaryDetails
                                                payout={payout}
                                                noteLabel="Napomena farmera"
                                                note={payout.farmerNote}
                                            />
                                            <div className="grid min-w-0 gap-4 xl:w-[46rem]">
                                                <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(11rem,1fr)_minmax(10rem,auto)_auto] sm:items-start">
                                                    <PayoutListField
                                                        label="Iznos"
                                                        className="sm:items-end sm:text-right"
                                                    >
                                                        <PayoutAmountDetails
                                                            payout={payout}
                                                        />
                                                    </PayoutListField>
                                                    <PayoutListField
                                                        label="Zatraženo"
                                                        className="sm:items-end sm:text-right"
                                                    >
                                                        <Typography
                                                            level="body3"
                                                            className="whitespace-nowrap text-muted-foreground"
                                                        >
                                                            <LocalDateTime>
                                                                {
                                                                    payout.createdAt
                                                                }
                                                            </LocalDateTime>
                                                        </Typography>
                                                    </PayoutListField>
                                                    <PayoutListField
                                                        label="Izvoz"
                                                        className="sm:items-end sm:text-right"
                                                    >
                                                        <PayoutCsvExportButton
                                                            payoutId={payout.id}
                                                        />
                                                    </PayoutListField>
                                                </div>
                                                <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(20rem,1fr)_minmax(14rem,auto)] lg:items-start">
                                                    <PayoutListField label="Odobri">
                                                        <div className="min-w-0 max-w-full overflow-x-auto pb-1">
                                                            <ApprovePayoutForm
                                                                id={payout.id}
                                                                requestedAmount={
                                                                    payout.requestedAmount
                                                                }
                                                            />
                                                        </div>
                                                    </PayoutListField>
                                                    <PayoutListField label="Odbij">
                                                        <RejectPayoutForm
                                                            id={payout.id}
                                                        />
                                                    </PayoutListField>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardOverflow>
                    )}
                </Card>
            )}

            {/* Approved — ready for bank transfer */}
            {approved.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Odobreno — čeka bankovni prijenos ({approved.length}
                            )
                        </CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <ul className="divide-y">
                            {approved.map((payout) => (
                                <li
                                    key={payout.id}
                                    className="px-3 py-4 transition-colors hover:bg-muted/40 sm:px-4"
                                >
                                    <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                        <PayoutPrimaryDetails
                                            payout={payout}
                                            noteLabel="Bilješka admina"
                                            note={payout.adminNote}
                                        />
                                        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,auto)_minmax(10rem,auto)_auto_minmax(12rem,auto)] xl:justify-items-end xl:text-right">
                                            <PayoutListField
                                                label="Iznos"
                                                className="sm:items-end sm:text-right"
                                            >
                                                <PayoutAmountDetails
                                                    payout={payout}
                                                />
                                            </PayoutListField>
                                            <PayoutListField
                                                label="Odobreno"
                                                className="sm:items-end sm:text-right"
                                            >
                                                <Typography
                                                    level="body3"
                                                    className="whitespace-nowrap text-muted-foreground"
                                                >
                                                    <LocalDateTime>
                                                        {payout.approvedAt}
                                                    </LocalDateTime>
                                                </Typography>
                                            </PayoutListField>
                                            <PayoutListField
                                                label="Izvoz"
                                                className="sm:items-end sm:text-right"
                                            >
                                                <PayoutCsvExportButton
                                                    payoutId={payout.id}
                                                />
                                            </PayoutListField>
                                            <PayoutListField
                                                label="Označi kao plaćeno"
                                                className="sm:items-end sm:text-right"
                                            >
                                                <MarkAsPaidForm
                                                    id={payout.id}
                                                    farmerName={
                                                        payout.displayName ??
                                                        payout.userName
                                                    }
                                                />
                                            </PayoutListField>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </CardOverflow>
                </Card>
            )}

            {/* History */}
            {schemaAvailable && (
                <Card>
                    <CardHeader>
                        <CardTitle>Povijest isplata</CardTitle>
                    </CardHeader>
                    {history.length === 0 ? (
                        <CardContent>
                            <NoDataPlaceholder>
                                Nema završenih zahtjeva.
                            </NoDataPlaceholder>
                        </CardContent>
                    ) : (
                        <CardOverflow>
                            <ul className="divide-y">
                                {history.map((payout) => (
                                    <li
                                        key={payout.id}
                                        className="px-3 py-4 transition-colors hover:bg-muted/40 sm:px-4"
                                    >
                                        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                            <PayoutPrimaryDetails
                                                payout={payout}
                                            />
                                            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,auto)_auto_minmax(12rem,1fr)_minmax(10rem,auto)_auto] xl:max-w-[54rem] xl:justify-items-end xl:text-right">
                                                <PayoutListField
                                                    label="Iznos"
                                                    className="sm:items-end sm:text-right"
                                                >
                                                    <PayoutAmountDetails
                                                        payout={payout}
                                                    />
                                                </PayoutListField>
                                                <PayoutListField
                                                    label="Status"
                                                    className="sm:items-end sm:text-right"
                                                >
                                                    <PayoutStatusChip
                                                        status={payout.status}
                                                    />
                                                </PayoutListField>
                                                <PayoutListField
                                                    label="Referenca / razlog"
                                                    className="sm:items-end sm:text-right"
                                                >
                                                    <Typography
                                                        level="body3"
                                                        className="min-w-0 break-words font-mono text-muted-foreground"
                                                    >
                                                        {payout.bankReference ??
                                                            payout.rejectionReason ??
                                                            '—'}
                                                    </Typography>
                                                </PayoutListField>
                                                <PayoutListField
                                                    label="Datum"
                                                    className="sm:items-end sm:text-right"
                                                >
                                                    <Typography
                                                        level="body3"
                                                        className="whitespace-nowrap text-muted-foreground"
                                                    >
                                                        <LocalDateTime>
                                                            {payout.paidAt ??
                                                                payout.rejectedAt ??
                                                                payout.createdAt}
                                                        </LocalDateTime>
                                                    </Typography>
                                                </PayoutListField>
                                                <PayoutListField
                                                    label="Izvoz"
                                                    className="sm:items-end sm:text-right"
                                                >
                                                    <PayoutCsvExportButton
                                                        payoutId={payout.id}
                                                    />
                                                </PayoutListField>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </CardOverflow>
                    )}
                </Card>
            )}
        </Stack>
    );
}
