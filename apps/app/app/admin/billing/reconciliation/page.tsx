import {
    type BillingReconciliationEmailIssue,
    getBillingReconciliationIssues,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ExternalLink, FileText, Mail, Warning } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Route } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../components/admin/navigation/AdminPageTitle';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

export const dynamic = 'force-dynamic';

const ISSUE_KIND_OPTIONS = [
    { value: 'all', label: 'Sve' },
    { value: 'transactions', label: 'Transakcije' },
    { value: 'invoices', label: 'Ponude' },
    { value: 'receipts', label: 'Fiskalni računi' },
    { value: 'emails', label: 'Emailovi' },
] as const;

const SORT_OPTIONS = [
    { value: 'newest', label: 'Najnovije' },
    { value: 'oldest', label: 'Najstarije' },
] as const;

type IssueKind = (typeof ISSUE_KIND_OPTIONS)[number]['value'];
type SortOption = (typeof SORT_OPTIONS)[number]['value'];

function isIssueKind(value: string | undefined): value is IssueKind {
    return ISSUE_KIND_OPTIONS.some((option) => option.value === value);
}

function isSortOption(value: string | undefined): value is SortOption {
    return SORT_OPTIONS.some((option) => option.value === value);
}

function buildHref(kind: IssueKind, sort: SortOption): Route {
    const params = new URLSearchParams();
    if (kind !== 'all') {
        params.set('kind', kind);
    }
    if (sort !== 'newest') {
        params.set('sort', sort);
    }

    const search = params.toString();
    return (
        search
            ? `${KnownPages.BillingReconciliation}?${search}`
            : KnownPages.BillingReconciliation
    ) as Route;
}

function sortCombinedByDate<T>(
    rows: T[],
    sort: SortOption,
    getDate: (row: T) => Date,
) {
    return [...rows].sort((a, b) =>
        sort === 'oldest'
            ? getDate(a).getTime() - getDate(b).getTime()
            : getDate(b).getTime() - getDate(a).getTime(),
    );
}

function moneyFromCents(amount: number, currency: string) {
    const value = (amount / 100).toFixed(2);
    return `${value}${currency === 'eur' ? '€' : ` ${currency}`}`;
}

function moneyFromDecimal(amount: string, currency: string) {
    return `${Number(amount).toFixed(2)}${currency === 'eur' ? '€' : ` ${currency}`}`;
}

function IssueSection({
    children,
    count,
    emptyLabel,
    icon,
    title,
}: {
    children: ReactNode;
    count: number;
    emptyLabel: string;
    icon: ReactNode;
    title: string;
}) {
    return (
        <Card>
            <CardHeader>
                <Row spacing={2} className="min-w-0 flex-wrap items-center">
                    {icon}
                    <CardTitle>{title}</CardTitle>
                    <Chip color={count > 0 ? 'warning' : 'success'}>
                        {count}
                    </Chip>
                </Row>
            </CardHeader>
            <CardOverflow>
                {count === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>{emptyLabel}</NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">{children}</ul>
                )}
            </CardOverflow>
        </Card>
    );
}

function IssueRow({
    actions,
    children,
    title,
}: {
    actions: ReactNode;
    children: ReactNode;
    title: ReactNode;
}) {
    return (
        <li className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <Stack spacing={1} className="min-w-0">
                    <Typography component="h3" level="body1" semiBold>
                        {title}
                    </Typography>
                    {children}
                </Stack>
                <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                    {actions}
                </div>
            </div>
        </li>
    );
}

function MetadataLine({ children }: { children: ReactNode }) {
    return (
        <Typography
            component="div"
            level="body3"
            className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]"
        >
            {children}
        </Typography>
    );
}

function EmailIssueStatus({
    issue,
}: {
    issue: BillingReconciliationEmailIssue;
}) {
    if (issue.status === 'missing') {
        return <Chip color="warning">Nedostaje</Chip>;
    }

    return (
        <Chip color={issue.status === 'failed' ? 'error' : 'warning'}>
            {issue.status === 'failed' ? 'Neuspješno' : 'Odbijeno'}
        </Chip>
    );
}

export default async function BillingReconciliationPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);

    const params = await searchParams;
    const kindParam = typeof params.kind === 'string' ? params.kind : undefined;
    const sortParam = typeof params.sort === 'string' ? params.sort : undefined;
    const selectedKind = isIssueKind(kindParam) ? kindParam : 'all';
    const selectedSort = isSortOption(sortParam) ? sortParam : 'newest';
    const issues = await getBillingReconciliationIssues({
        limit: 50,
        sort: selectedSort,
    });

    const transactionsWithoutInvoices = issues.transactionsWithoutInvoices;
    const paidInvoicesWithoutReceipts = issues.paidInvoicesWithoutReceipts;
    const receiptsNeedingFiscalization = issues.receiptsNeedingFiscalization;
    const missingBillingDocumentEmails = issues.missingBillingDocumentEmails;
    const failedBillingDocumentEmails = issues.failedBillingDocumentEmails;
    const visibleEmailIssues = sortCombinedByDate(
        [...missingBillingDocumentEmails, ...failedBillingDocumentEmails],
        selectedSort,
        (row) => row.createdAt,
    );
    const totalIssueCount =
        transactionsWithoutInvoices.length +
        paidInvoicesWithoutReceipts.length +
        receiptsNeedingFiscalization.length +
        visibleEmailIssues.length;

    return (
        <Stack spacing={4}>
            <AdminPageTitle title="Usklađenje naplate" />
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                                href: KnownPages.BillingReconciliation,
                            },
                            { label: 'Usklađenje naplate' },
                        ]}
                    />
                }
                heading="Usklađenje naplate"
            />

            <Row spacing={2} className="flex-wrap">
                <Chip color={totalIssueCount > 0 ? 'warning' : 'success'}>
                    {totalIssueCount}
                </Chip>
                {ISSUE_KIND_OPTIONS.map((option) => {
                    const active = selectedKind === option.value;
                    return (
                        <Link
                            key={option.value}
                            href={buildHref(option.value, selectedSort)}
                            prefetch={false}
                        >
                            <Chip
                                color={active ? 'primary' : 'neutral'}
                                className="cursor-pointer"
                            >
                                {option.label}
                            </Chip>
                        </Link>
                    );
                })}
            </Row>

            <Row spacing={2} className="flex-wrap">
                {SORT_OPTIONS.map((option) => {
                    const active = selectedSort === option.value;
                    return (
                        <Link
                            key={option.value}
                            href={buildHref(selectedKind, option.value)}
                            prefetch={false}
                        >
                            <Chip
                                color={active ? 'primary' : 'neutral'}
                                className="cursor-pointer"
                            >
                                {option.label}
                            </Chip>
                        </Link>
                    );
                })}
            </Row>

            {(selectedKind === 'all' || selectedKind === 'transactions') && (
                <IssueSection
                    count={transactionsWithoutInvoices.length}
                    emptyLabel="Nema dovršenih transakcija bez ponude."
                    icon={<FileText className="size-4 text-muted-foreground" />}
                    title="Dovršene transakcije bez ponude"
                >
                    {transactionsWithoutInvoices.map((transaction) => (
                        <IssueRow
                            key={transaction.id}
                            title={
                                <Link
                                    href={KnownPages.Transaction(
                                        transaction.id,
                                    )}
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    Transakcija #{transaction.id}
                                </Link>
                            }
                            actions={
                                <>
                                    <Button
                                        href={KnownPages.Transaction(
                                            transaction.id,
                                        )}
                                        size="sm"
                                        variant="outlined"
                                    >
                                        Otvori
                                    </Button>
                                    <Button
                                        href={KnownPages.StripePayment(
                                            transaction.stripePaymentId,
                                        )}
                                        size="sm"
                                        startDecorator={
                                            <ExternalLink className="size-4" />
                                        }
                                        variant="outlined"
                                    >
                                        Stripe
                                    </Button>
                                </>
                            }
                        >
                            <MetadataLine>
                                Račun:{' '}
                                {transaction.accountId ? (
                                    <Link
                                        href={KnownPages.Account(
                                            transaction.accountId,
                                        )}
                                        className="underline-offset-4 hover:text-primary hover:underline"
                                    >
                                        {transaction.accountId}
                                    </Link>
                                ) : (
                                    'nema računa'
                                )}
                            </MetadataLine>
                            <MetadataLine>
                                {moneyFromCents(
                                    transaction.amount,
                                    transaction.currency,
                                )}{' '}
                                · {transaction.status} ·{' '}
                                <LocalDateTime>
                                    {transaction.createdAt}
                                </LocalDateTime>
                            </MetadataLine>
                        </IssueRow>
                    ))}
                </IssueSection>
            )}

            {(selectedKind === 'all' || selectedKind === 'invoices') && (
                <IssueSection
                    count={paidInvoicesWithoutReceipts.length}
                    emptyLabel="Nema plaćenih ponuda bez fiskalnog računa."
                    icon={<FileText className="size-4 text-muted-foreground" />}
                    title="Plaćene ponude bez fiskalnog računa"
                >
                    {paidInvoicesWithoutReceipts.map((invoice) => (
                        <IssueRow
                            key={invoice.id}
                            title={
                                <Link
                                    href={KnownPages.Invoice(invoice.id)}
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    {invoice.invoiceNumber}
                                </Link>
                            }
                            actions={
                                <>
                                    <Button
                                        href={KnownPages.Invoice(invoice.id)}
                                        size="sm"
                                        variant="outlined"
                                    >
                                        Otvori
                                    </Button>
                                    <Button
                                        href={KnownPages.BillingPreviewInvoice(
                                            invoice.id,
                                        )}
                                        size="sm"
                                        variant="outlined"
                                    >
                                        Pregled
                                    </Button>
                                </>
                            }
                        >
                            <MetadataLine>
                                Račun:{' '}
                                <Link
                                    href={KnownPages.Account(invoice.accountId)}
                                    className="underline-offset-4 hover:text-primary hover:underline"
                                >
                                    {invoice.accountId}
                                </Link>{' '}
                                · {invoice.billToEmail}
                            </MetadataLine>
                            <MetadataLine>
                                {moneyFromDecimal(
                                    invoice.totalAmount,
                                    invoice.currency,
                                )}{' '}
                                · plaćeno{' '}
                                {invoice.paidDate ? (
                                    <LocalDateTime>
                                        {invoice.paidDate}
                                    </LocalDateTime>
                                ) : (
                                    'bez datuma'
                                )}
                            </MetadataLine>
                        </IssueRow>
                    ))}
                </IssueSection>
            )}

            {(selectedKind === 'all' || selectedKind === 'receipts') && (
                <IssueSection
                    count={receiptsNeedingFiscalization.length}
                    emptyLabel="Nema fiskalnih računa za fiskalizaciju."
                    icon={<Warning className="size-4 text-muted-foreground" />}
                    title="Fiskalni računi za fiskalizaciju"
                >
                    {receiptsNeedingFiscalization.map((receipt) => (
                        <IssueRow
                            key={receipt.id}
                            title={
                                <Link
                                    href={KnownPages.Receipt(receipt.id)}
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    {receipt.yearReceiptNumber}
                                </Link>
                            }
                            actions={
                                <>
                                    <Button
                                        href={KnownPages.Receipt(receipt.id)}
                                        size="sm"
                                        variant="outlined"
                                    >
                                        Otvori
                                    </Button>
                                    <Button
                                        href={KnownPages.BillingPreviewReceipt(
                                            receipt.id,
                                        )}
                                        size="sm"
                                        variant="outlined"
                                    >
                                        Pregled
                                    </Button>
                                </>
                            }
                        >
                            <MetadataLine>
                                Ponuda:{' '}
                                {receipt.invoiceId ? (
                                    <Link
                                        href={KnownPages.Invoice(
                                            receipt.invoiceId,
                                        )}
                                        className="underline-offset-4 hover:text-primary hover:underline"
                                    >
                                        {receipt.invoiceNumber ??
                                            `#${receipt.invoiceId}`}
                                    </Link>
                                ) : (
                                    'nema povezane ponude'
                                )}
                            </MetadataLine>
                            <MetadataLine>
                                {moneyFromDecimal(
                                    receipt.totalAmount,
                                    receipt.currency,
                                )}{' '}
                                · CIS {receipt.cisStatus} ·{' '}
                                <LocalDateTime>
                                    {receipt.issuedAt}
                                </LocalDateTime>
                            </MetadataLine>
                            {receipt.cisErrorMessage && (
                                <MetadataLine>
                                    {receipt.cisErrorMessage}
                                </MetadataLine>
                            )}
                        </IssueRow>
                    ))}
                </IssueSection>
            )}

            {(selectedKind === 'all' || selectedKind === 'emails') && (
                <IssueSection
                    count={visibleEmailIssues.length}
                    emptyLabel="Nema nedostajućih ili neuspješnih emailova za dokumente."
                    icon={<Mail className="size-4 text-muted-foreground" />}
                    title="Emailovi dokumenata"
                >
                    {visibleEmailIssues.map((issue) => (
                        <IssueRow
                            key={`${issue.status}-${issue.id ?? issue.invoiceId}`}
                            title={
                                <Link
                                    href={KnownPages.Invoice(issue.invoiceId)}
                                    className="text-primary underline-offset-4 hover:underline"
                                >
                                    {issue.invoiceNumber}
                                </Link>
                            }
                            actions={
                                <>
                                    <EmailIssueStatus issue={issue} />
                                    {issue.id && (
                                        <Button
                                            href={KnownPages.CommunicationEmail(
                                                issue.id,
                                            )}
                                            size="sm"
                                            variant="outlined"
                                        >
                                            Email
                                        </Button>
                                    )}
                                    <Button
                                        href={KnownPages.Invoice(
                                            issue.invoiceId,
                                        )}
                                        size="sm"
                                        variant="outlined"
                                    >
                                        Ponuda
                                    </Button>
                                </>
                            }
                        >
                            <MetadataLine>
                                Račun:{' '}
                                <Link
                                    href={KnownPages.Account(issue.accountId)}
                                    className="underline-offset-4 hover:text-primary hover:underline"
                                >
                                    {issue.accountId}
                                </Link>{' '}
                                · {issue.billToEmail}
                            </MetadataLine>
                            <MetadataLine>
                                {moneyFromDecimal(
                                    issue.totalAmount,
                                    issue.currency,
                                )}{' '}
                                ·{' '}
                                <LocalDateTime>{issue.createdAt}</LocalDateTime>
                            </MetadataLine>
                            {issue.errorMessage && (
                                <MetadataLine>
                                    {issue.errorMessage}
                                </MetadataLine>
                            )}
                        </IssueRow>
                    ))}
                </IssueSection>
            )}
        </Stack>
    );
}
