import { getAllTransactions } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { ExternalLink } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';

export async function TransactionsTable({ accountId }: { accountId?: string }) {
    await auth(['admin']);
    const allTransactions = await getAllTransactions({ filter: { accountId } });

    // Sort transactions by newest first (createdAt descending)
    const transactions = (allTransactions || []).sort(
        (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const hasAccountFilter = !!accountId;

    return (
        <div className="min-w-0">
            {transactions.length === 0 ? (
                <div className="p-4">
                    <NoDataPlaceholder>Nema transakcija</NoDataPlaceholder>
                </div>
            ) : (
                <ul className="divide-y">
                    {transactions.map((transaction) => {
                        const invoiceCount = transaction.invoices?.length || 0;
                        const hasNoInvoices = invoiceCount === 0;
                        const isTest =
                            transaction.stripePaymentId?.startsWith(
                                'cs_test_',
                            ) || false;
                        const transactionHref = KnownPages.Transaction(
                            transaction.id,
                        );

                        return (
                            <li
                                key={transaction.id}
                                className={
                                    hasNoInvoices
                                        ? 'bg-green-50 transition-colors hover:bg-muted/40 dark:bg-green-950'
                                        : 'transition-colors hover:bg-muted/40'
                                }
                            >
                                <div className="flex min-w-0 flex-col gap-3 px-3 py-4 sm:px-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <Link
                                                href={transactionHref}
                                                className="min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                                            >
                                                Transakcija #{transaction.id}
                                            </Link>
                                        </div>

                                        <div className="mt-2 grid min-w-0 gap-1">
                                            {!hasAccountFilter && (
                                                <div className="min-w-0">
                                                    {transaction.accountId ? (
                                                        <Link
                                                            href={KnownPages.Account(
                                                                transaction.accountId,
                                                            )}
                                                            className="break-all text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                                                        >
                                                            Račun:{' '}
                                                            {
                                                                transaction.accountId
                                                            }
                                                        </Link>
                                                    ) : (
                                                        <Typography
                                                            component="span"
                                                            level="body3"
                                                            className="text-muted-foreground"
                                                        >
                                                            Nema računa
                                                        </Typography>
                                                    )}
                                                </div>
                                            )}

                                            {transaction.stripePaymentId ? (
                                                <Link
                                                    href={KnownPages.StripePayment(
                                                        transaction.stripePaymentId,
                                                    )}
                                                    className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                                                >
                                                    <ExternalLink className="size-3.5 shrink-0" />
                                                    <span className="break-all">
                                                        Stripe Payment ID:{' '}
                                                        {
                                                            transaction.stripePaymentId
                                                        }
                                                    </span>
                                                </Link>
                                            ) : (
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Nema Stripe poveznicu
                                                </Typography>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                            <Chip
                                                color="info"
                                                size="sm"
                                                variant="soft"
                                            >
                                                <Typography
                                                    component="span"
                                                    noWrap
                                                >
                                                    {transaction.status}
                                                </Typography>
                                            </Chip>
                                            <Chip
                                                color="success"
                                                size="sm"
                                                variant="soft"
                                            >
                                                <Typography
                                                    component="span"
                                                    noWrap
                                                >
                                                    €
                                                    {(
                                                        transaction.amount / 100
                                                    ).toFixed(2)}
                                                </Typography>
                                            </Chip>
                                            {hasNoInvoices ? (
                                                <Chip
                                                    color="error"
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    <Typography
                                                        component="span"
                                                        noWrap
                                                    >
                                                        Bez ponuda
                                                    </Typography>
                                                </Chip>
                                            ) : (
                                                <Chip
                                                    color="success"
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    <Typography
                                                        component="span"
                                                        noWrap
                                                    >
                                                        📋 {invoiceCount} ponuda
                                                    </Typography>
                                                </Chip>
                                            )}

                                            {transaction.stripePaymentId ? (
                                                <Link
                                                    href={KnownPages.StripePayment(
                                                        transaction.stripePaymentId,
                                                    )}
                                                    className="inline-flex"
                                                >
                                                    <Chip
                                                        color={
                                                            isTest
                                                                ? 'warning'
                                                                : 'neutral'
                                                        }
                                                        size="sm"
                                                        variant="outlined"
                                                        startDecorator={
                                                            <ExternalLink className="size-3.5" />
                                                        }
                                                    >
                                                        Stripe
                                                        {isTest && ' (test)'}
                                                    </Chip>
                                                </Link>
                                            ) : null}
                                        </div>

                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground lg:text-right"
                                        >
                                            Kreirano:{' '}
                                            <span className="whitespace-nowrap">
                                                <LocalDateTime time={false}>
                                                    {transaction.createdAt}
                                                </LocalDateTime>
                                            </span>
                                        </Typography>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
