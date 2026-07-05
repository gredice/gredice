'use server';

import { ensureInvoiceForTransaction, getTransaction } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

function invoiceGenerationErrorUrl(transactionId: number, message: string) {
    const searchParams = new URLSearchParams({
        invoiceGenerationError: message,
    });
    return `${KnownPages.Transaction(transactionId)}?${searchParams.toString()}`;
}

export async function generateInvoiceForTransactionAction(
    transactionId: number,
) {
    await auth(['admin']);

    let redirectTarget: string;
    try {
        const transaction = await getTransaction(transactionId);
        if (!transaction) {
            redirectTarget = invoiceGenerationErrorUrl(
                transactionId,
                'Transakcija nije pronađena.',
            );
        } else {
            const result = await ensureInvoiceForTransaction({
                transactionId,
                billingSnapshot: {
                    notes: 'Ručno generirano iz admin pregleda transakcije.',
                },
                items: [
                    {
                        description: `Plaćena Gredice checkout transakcija ${transaction.stripePaymentId}`,
                        quantity: 1,
                        unitPriceCents: transaction.amount,
                        totalPriceCents: transaction.amount,
                    },
                ],
            });

            if (result.status === 'skipped') {
                console.warn('Manual invoice generation skipped', {
                    reason: result.reason,
                    transactionId,
                });
                redirectTarget = invoiceGenerationErrorUrl(
                    transactionId,
                    result.message,
                );
            } else {
                revalidatePath(KnownPages.Transaction(transactionId));
                revalidatePath(KnownPages.Invoices);
                revalidatePath(KnownPages.Invoice(result.invoiceId));
                redirectTarget = KnownPages.Invoice(result.invoiceId);
            }
        }
    } catch (error) {
        console.error('Manual invoice generation failed', {
            error,
            transactionId,
        });
        redirectTarget = invoiceGenerationErrorUrl(
            transactionId,
            'Generiranje ponude nije uspjelo. Provjerite podatke transakcije i pokušajte ponovno.',
        );
    }

    redirect(redirectTarget);
}
