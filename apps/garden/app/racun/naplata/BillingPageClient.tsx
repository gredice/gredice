'use client';

import { clientAuthenticated } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { FileText, Wallet } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { useQuery } from '@tanstack/react-query';

type BillingReceipt = {
    id: number;
    receiptNumber: string;
    yearReceiptNumber: string;
    issuedAt: string;
    totalAmount: string;
    currency: string;
    cisStatus: string;
    documentUrl: string;
};

type BillingInvoice = {
    id: number;
    invoiceNumber: string;
    status: string;
    issueDate: string;
    paidDate: string | null;
    totalAmount: string;
    currency: string;
    receipt: BillingReceipt | null;
    documentUrl: string;
};

type BillingResponse = {
    invoices: BillingInvoice[];
};

const billingStatusLabels: Record<string, string> = {
    cancelled: 'Otkazano',
    draft: 'Nacrt',
    paid: 'Plaćeno',
    pending: 'Na čekanju',
    sent: 'Poslano',
};

const receiptStatusLabels: Record<string, string> = {
    confirmed: 'Fiskalizirano',
    failed: 'Fiskalizacija nije uspjela',
    pending: 'Čeka fiskalizaciju',
    sent: 'Poslano u CIS',
};

function formatDate(value: string | null) {
    if (!value) {
        return '-';
    }

    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
    }).format(new Date(value));
}

function formatMoney(value: string, currency: string) {
    const amount = Number.parseFloat(value);
    if (!Number.isFinite(amount)) {
        return '-';
    }

    return new Intl.NumberFormat('hr-HR', {
        currency: currency.toUpperCase(),
        style: 'currency',
    }).format(amount);
}

function useBillingInvoices() {
    return useQuery({
        queryKey: ['accounts', 'current', 'billing', 'invoices'],
        queryFn: async () => {
            const response =
                await clientAuthenticated().api.accounts.current.billing.invoices.$get();
            if (response.status === 401) {
                return null;
            }
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch billing invoices: ${response.status}`,
                );
            }

            return (await response.json()) as BillingResponse;
        },
        retry: false,
        staleTime: 1000 * 60 * 5,
    });
}

export function BillingPageClient() {
    const billingQuery = useBillingInvoices();
    const invoices = billingQuery.data?.invoices ?? [];

    return (
        <main className="min-h-dvh bg-[#eef4ef] px-4 py-6 text-[#1f2418] sm:px-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2 text-[#5f6b3d]">
                            <Wallet className="size-5" />
                            <Typography level="body2" semiBold>
                                Moj račun
                            </Typography>
                        </div>
                        <h1 className="text-2xl font-semibold sm:text-3xl">
                            Računi i plaćanja
                        </h1>
                    </div>
                    <Button href="/" variant="outlined" color="neutral">
                        Natrag u vrt
                    </Button>
                </div>

                {billingQuery.isLoading && (
                    <Card className="p-5">
                        <Typography level="body1">Učitavanje...</Typography>
                    </Card>
                )}

                {billingQuery.isError && (
                    <Alert color="danger">
                        Računi trenutno nisu dostupni. Osvježite stranicu i
                        pokušajte ponovno.
                    </Alert>
                )}

                {!billingQuery.isLoading &&
                    !billingQuery.isError &&
                    invoices.length === 0 && (
                        <Card className="p-5">
                            <Typography level="body1" semiBold>
                                Još nema računa za ovaj račun.
                            </Typography>
                            <Typography level="body2" secondary>
                                Ovdje će se prikazati dokumenti nakon dovršene
                                kupnje.
                            </Typography>
                        </Card>
                    )}

                {invoices.length > 0 && (
                    <div className="grid gap-3">
                        {invoices.map((invoice) => (
                            <Card className="p-5" key={invoice.id}>
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Typography level="body1" semiBold>
                                                {invoice.invoiceNumber}
                                            </Typography>
                                            <Chip color="success">
                                                {billingStatusLabels[
                                                    invoice.status
                                                ] ?? invoice.status}
                                            </Chip>
                                            {invoice.receipt && (
                                                <Chip color="neutral">
                                                    {receiptStatusLabels[
                                                        invoice.receipt
                                                            .cisStatus
                                                    ] ??
                                                        invoice.receipt
                                                            .cisStatus}
                                                </Chip>
                                            )}
                                        </div>
                                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                                            <div>
                                                <dt className="text-[#6f7666]">
                                                    Izdano
                                                </dt>
                                                <dd>
                                                    {formatDate(
                                                        invoice.issueDate,
                                                    )}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-[#6f7666]">
                                                    Plaćeno
                                                </dt>
                                                <dd>
                                                    {formatDate(
                                                        invoice.paidDate,
                                                    )}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-[#6f7666]">
                                                    Iznos
                                                </dt>
                                                <dd className="font-semibold">
                                                    {formatMoney(
                                                        invoice.totalAmount,
                                                        invoice.currency,
                                                    )}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-[#6f7666]">
                                                    Račun
                                                </dt>
                                                <dd>
                                                    {invoice.receipt
                                                        ?.yearReceiptNumber ??
                                                        '-'}
                                                </dd>
                                            </div>
                                        </dl>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                                        <Button
                                            href={invoice.documentUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            variant="outlined"
                                            color="neutral"
                                            startDecorator={
                                                <FileText className="size-4" />
                                            }
                                        >
                                            Ponuda
                                        </Button>
                                        {invoice.receipt ? (
                                            <Button
                                                href={
                                                    invoice.receipt.documentUrl
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                                variant="outlined"
                                                color="neutral"
                                                startDecorator={
                                                    <FileText className="size-4" />
                                                }
                                            >
                                                Račun
                                            </Button>
                                        ) : (
                                            <Button
                                                disabled
                                                variant="outlined"
                                                color="neutral"
                                            >
                                                Račun
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
