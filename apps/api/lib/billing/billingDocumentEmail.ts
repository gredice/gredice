import {
    type EmailStatus,
    getEmailMessageByTemplateAndMetadata,
} from '@gredice/storage';
import { sendBillingDocuments } from '../email/transactional';

export const billingDocumentsTemplateName = 'commerce-billing-documents';
const activeEmailStatuses = [
    'queued',
    'sending',
    'sent',
] satisfies EmailStatus[];

const API_APP_URL =
    process.env.GREDICE_API_APP_URL ?? 'https://api.gredice.com';
const CUSTOMER_APP_URL =
    process.env.GREDICE_GARDEN_APP_URL ?? 'https://vrt.gredice.com';

export interface BillingDocumentsEmailParams {
    to?: string | null;
    invoiceId: number;
    invoiceNumber: string;
    receiptId?: number | null;
    receiptNumber?: string | null;
    checkoutSessionId?: string | null;
    cartIds?: number[];
}

type BillingDocumentsEmailDeps = {
    getEmailMessageByTemplateAndMetadata: typeof getEmailMessageByTemplateAndMetadata;
    sendBillingDocuments: typeof sendBillingDocuments;
};

const defaultDeps: BillingDocumentsEmailDeps = {
    getEmailMessageByTemplateAndMetadata,
    sendBillingDocuments,
};

function absoluteUrl(baseUrl: string, path: string) {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(path, base).toString();
}

export function billingDocumentDeliveryKey(invoiceId: number) {
    return `billing-documents:invoice:${invoiceId}`;
}

export function invoiceDocumentUrl(invoiceId: number) {
    return absoluteUrl(
        API_APP_URL,
        `/api/accounts/current/billing/invoices/${invoiceId}/document`,
    );
}

export function receiptDocumentUrl(receiptId: number) {
    return absoluteUrl(
        API_APP_URL,
        `/api/accounts/current/billing/receipts/${receiptId}/document`,
    );
}

export function accountBillingUrl() {
    return absoluteUrl(CUSTOMER_APP_URL, '/racun/naplata');
}

export type NotifyBillingDocumentsEmailResult =
    | { status: 'sent' }
    | {
          status: 'skipped';
          reason: 'missing_recipient' | 'already_sent';
          emailMessageId?: number;
      }
    | { status: 'failed'; message: string };

export async function notifyBillingDocumentsEmail(
    {
        cartIds,
        checkoutSessionId,
        invoiceId,
        invoiceNumber,
        receiptId,
        receiptNumber,
        to,
    }: BillingDocumentsEmailParams,
    deps: BillingDocumentsEmailDeps = defaultDeps,
): Promise<NotifyBillingDocumentsEmailResult> {
    const email = to?.trim();
    if (!email) {
        console.warn('Skipping billing documents email: missing recipient', {
            checkoutSessionId,
            invoiceId,
        });
        return { status: 'skipped', reason: 'missing_recipient' };
    }

    const deliveryKey = billingDocumentDeliveryKey(invoiceId);
    const existingEmail = await deps.getEmailMessageByTemplateAndMetadata({
        metadataKey: 'billingDeliveryKey',
        metadataValue: deliveryKey,
        statuses: [...activeEmailStatuses],
        templateName: billingDocumentsTemplateName,
    });
    if (existingEmail) {
        return {
            status: 'skipped',
            reason: 'already_sent',
            emailMessageId: existingEmail.id,
        };
    }

    try {
        await deps.sendBillingDocuments(
            email,
            {
                billingUrl: accountBillingUrl(),
                email,
                invoiceNumber,
                invoiceUrl: invoiceDocumentUrl(invoiceId),
                receiptNumber,
                receiptUrl: receiptId ? receiptDocumentUrl(receiptId) : null,
            },
            {
                billingDeliveryKey: deliveryKey,
                cartIds: cartIds ?? [],
                checkoutSessionId: checkoutSessionId ?? null,
                invoiceId,
                receiptId: receiptId ?? null,
            },
        );
        return { status: 'sent' };
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Failed to send billing documents email.';
        console.error('Failed to send billing documents email', {
            checkoutSessionId,
            invoiceId,
            hasRecipient: true,
            error,
        });
        return { status: 'failed', message };
    }
}
