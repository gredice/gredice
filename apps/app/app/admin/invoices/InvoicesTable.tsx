import { getAllInvoices } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { ExternalLink } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';

function getStatusColor(status: string) {
    switch (status) {
        case 'draft':
            return 'neutral';
        case 'pending':
            return 'warning';
        case 'sent':
            return 'info';
        case 'paid':
            return 'success';
        case 'overdue':
            return 'error';
        case 'cancelled':
            return 'neutral';
        default:
            return 'neutral';
    }
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'draft':
            return 'Nacrt';
        case 'pending':
            return 'Na čekanju';
        case 'sent':
            return 'Poslan';
        case 'paid':
            return 'Plaćen';
        case 'overdue':
            return 'Dospio';
        case 'cancelled':
            return 'Otkazan';
        default:
            return status;
    }
}

function formatInvoiceAmount(amount: string, currency: string) {
    return `${amount}${currency === 'eur' ? '€' : currency}`;
}

export async function InvoicesTable({
    transactionId,
}: {
    transactionId?: number;
}) {
    const invoices = await getAllInvoices({ transactionId });

    if (invoices.length === 0) {
        return (
            <div className="p-4">
                <NoDataPlaceholder>Nema ponuda</NoDataPlaceholder>
            </div>
        );
    }

    return (
        <ul className="min-w-0 divide-y">
            {invoices.map((invoice) => (
                <li
                    key={invoice.id}
                    className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                >
                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                                <Typography
                                    component="h3"
                                    level="body1"
                                    semiBold
                                    className="min-w-0"
                                >
                                    <Link
                                        href={KnownPages.Invoice(invoice.id)}
                                        className="min-w-0 break-words text-primary underline-offset-4 hover:underline"
                                    >
                                        {invoice.invoiceNumber}
                                    </Link>
                                </Typography>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Chip
                                        color={getStatusColor(invoice.status)}
                                        size="sm"
                                    >
                                        {getStatusLabel(invoice.status)}
                                    </Chip>
                                    <Chip color="success" size="sm">
                                        {formatInvoiceAmount(
                                            invoice.totalAmount,
                                            invoice.currency,
                                        )}
                                    </Chip>
                                </div>
                            </div>
                            <div className="min-w-0 space-y-1">
                                {invoice.billToName && (
                                    <Typography
                                        component="div"
                                        level="body2"
                                        className="min-w-0 break-words text-foreground"
                                    >
                                        {invoice.billToName}
                                    </Typography>
                                )}
                                <Typography
                                    component="div"
                                    level="body3"
                                    className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]"
                                >
                                    {invoice.billToEmail}
                                </Typography>
                            </div>
                        </div>
                        <div className="flex min-w-0 flex-col gap-2 lg:items-end">
                            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-left lg:justify-end lg:text-right">
                                <Typography
                                    component="div"
                                    level="body3"
                                    className="whitespace-nowrap text-muted-foreground"
                                >
                                    Datum izdavanja:{' '}
                                    <LocalDateTime time={false}>
                                        {invoice.issueDate}
                                    </LocalDateTime>
                                </Typography>
                                <Typography
                                    component="div"
                                    level="body3"
                                    className="whitespace-nowrap text-muted-foreground"
                                >
                                    Datum dospijeća:{' '}
                                    <LocalDateTime time={false}>
                                        {invoice.dueDate}
                                    </LocalDateTime>
                                </Typography>
                            </div>
                            <div className="flex min-w-0 justify-start lg:justify-end">
                                {invoice.transactionId ? (
                                    <Chip
                                        href={KnownPages.Transaction(
                                            invoice.transactionId,
                                        )}
                                        startDecorator={
                                            <ExternalLink className="size-4 shrink-0" />
                                        }
                                    >
                                        #{invoice.transactionId}
                                    </Chip>
                                ) : (
                                    <NoDataPlaceholder
                                        center={false}
                                        className="text-left text-muted-foreground lg:text-right"
                                    >
                                        Nema transakcije
                                    </NoDataPlaceholder>
                                )}
                            </div>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}
