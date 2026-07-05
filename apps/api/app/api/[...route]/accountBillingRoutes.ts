import {
    getAccountBillingInvoice,
    getAccountBillingInvoices,
    getAccountBillingReceipt,
} from '@gredice/storage';
import { type Context, Hono, type MiddlewareHandler, type Next } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const numericIdParam = z.string().regex(/^\d+$/);

const invoiceParamSchema = z.object({
    invoiceId: numericIdParam,
});

const receiptParamSchema = z.object({
    receiptId: numericIdParam,
});

type AccountBillingAuthValidator = (
    roles: string[],
) => MiddlewareHandler<{ Variables: AuthVariables }>;

export type AccountBillingRouteDeps = {
    authValidator: AccountBillingAuthValidator;
    getAccountBillingInvoice: typeof getAccountBillingInvoice;
    getAccountBillingInvoices: typeof getAccountBillingInvoices;
    getAccountBillingReceipt: typeof getAccountBillingReceipt;
};

const defaultDeps: AccountBillingRouteDeps = {
    authValidator,
    getAccountBillingInvoice,
    getAccountBillingInvoices,
    getAccountBillingReceipt,
};

type CustomerBillingReceiptRecord = {
    id: number;
    receiptNumber: string;
    yearReceiptNumber: string;
    issuedAt: Date;
    totalAmount: string;
    currency: string;
    cisStatus: string;
    jir?: string | null;
    zki?: string | null;
    businessName?: string | null;
    businessAddress?: string | null;
    paymentMethod: string;
    paymentReference?: string | null;
};

type CustomerBillingInvoiceRecord = {
    id: number;
    invoiceNumber: string;
    status: string;
    issueDate: Date;
    dueDate: Date;
    paidDate?: Date | null;
    totalAmount: string;
    currency: string;
    billToName?: string | null;
    billToEmail: string;
    invoiceItems: Array<{
        description: string;
        quantity: string;
        totalPrice: string;
    }>;
    receipt?: CustomerBillingReceiptRecord | null;
};

function toIso(value: Date | null | undefined) {
    return value ? value.toISOString() : null;
}

function documentUrl(context: Context, path: string) {
    return new URL(path, context.req.url).toString();
}

function invoiceDocumentPath(invoiceId: number) {
    return `/api/accounts/current/billing/invoices/${invoiceId}/document`;
}

function receiptDocumentPath(receiptId: number) {
    return `/api/accounts/current/billing/receipts/${receiptId}/document`;
}

function serializeReceipt(
    context: Context,
    receipt: CustomerBillingReceiptRecord | null | undefined,
) {
    if (!receipt) {
        return null;
    }

    return {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        yearReceiptNumber: receipt.yearReceiptNumber,
        issuedAt: receipt.issuedAt.toISOString(),
        totalAmount: receipt.totalAmount,
        currency: receipt.currency,
        cisStatus: receipt.cisStatus,
        jir: receipt.jir,
        zki: receipt.zki,
        documentUrl: documentUrl(context, receiptDocumentPath(receipt.id)),
    };
}

function serializeInvoice(
    context: Context,
    invoice: CustomerBillingInvoiceRecord | null | undefined,
) {
    if (!invoice) {
        return null;
    }

    return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        issueDate: invoice.issueDate.toISOString(),
        dueDate: invoice.dueDate.toISOString(),
        paidDate: toIso(invoice.paidDate),
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        receipt: serializeReceipt(context, invoice.receipt),
        documentUrl: documentUrl(context, invoiceDocumentPath(invoice.id)),
    };
}

function escapeHtml(value: string | number | null | undefined) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatMoney(value: string | number, currency: string) {
    const amount = typeof value === 'number' ? value : Number.parseFloat(value);
    if (!Number.isFinite(amount)) {
        return '-';
    }

    return new Intl.NumberFormat('hr-HR', {
        currency: currency.toUpperCase(),
        style: 'currency',
    }).format(amount);
}

function renderDocumentShell({
    body,
    heading,
    label,
}: {
    body: string;
    heading: string;
    label: string;
}) {
    return `<!doctype html>
<html lang="hr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(label)} ${escapeHtml(heading)}</title>
<style>
body{margin:0;background:#f4f1ea;color:#1e1b16;font-family:Arial,sans-serif;}
main{max-width:760px;margin:24px auto;padding:32px;background:#fff;border:1px solid #ddd5c7;}
h1{font-size:28px;margin:0 0 4px;}
.label{color:#5f6b3d;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:24px 0;}
.box{border:1px solid #e5decf;padding:12px;}
table{width:100%;border-collapse:collapse;margin-top:24px;}
th,td{border-bottom:1px solid #e5decf;padding:10px;text-align:left;}
th:last-child,td:last-child{text-align:right;}
.total{font-size:20px;font-weight:700;text-align:right;margin-top:20px;}
@media print{body{background:#fff;}main{border:0;margin:0;max-width:none;}}
</style>
</head>
<body><main><div class="label">${escapeHtml(label)}</div><h1>${escapeHtml(heading)}</h1>${body}</main></body>
</html>`;
}

function renderInvoiceDocument(invoice: CustomerBillingInvoiceRecord) {
    const itemRows = invoice.invoiceItems
        .map(
            (item) =>
                `<tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(
                    item.quantity,
                )}</td><td>${escapeHtml(formatMoney(item.totalPrice, invoice.currency))}</td></tr>`,
        )
        .join('');
    const body = `
<div class="grid">
<section class="box"><strong>Kupac</strong><br>${escapeHtml(invoice.billToName ?? invoice.billToEmail)}<br>${escapeHtml(invoice.billToEmail)}</section>
<section class="box"><strong>Datumi</strong><br>Izdano: ${escapeHtml(invoice.issueDate.toLocaleDateString('hr-HR'))}<br>Plaćeno: ${escapeHtml(invoice.paidDate?.toLocaleDateString('hr-HR') ?? '-')}</section>
</div>
<table><thead><tr><th>Stavka</th><th>Količina</th><th>Iznos</th></tr></thead><tbody>${itemRows}</tbody></table>
<p class="total">Ukupno ${escapeHtml(formatMoney(invoice.totalAmount, invoice.currency))}</p>`;

    return renderDocumentShell({
        body,
        heading: invoice.invoiceNumber,
        label: 'Ponuda',
    });
}

function renderReceiptDocument(receipt: CustomerBillingReceiptRecord) {
    const body = `
<div class="grid">
<section class="box"><strong>Izdavatelj</strong><br>${escapeHtml(receipt.businessName ?? 'Gredice')}<br>${escapeHtml(receipt.businessAddress)}</section>
<section class="box"><strong>Fiskalizacija</strong><br>Status: ${escapeHtml(receipt.cisStatus)}<br>JIR: ${escapeHtml(receipt.jir ?? '-')}<br>ZKI: ${escapeHtml(receipt.zki ?? '-')}</section>
</div>
<p>Način plaćanja: ${escapeHtml(receipt.paymentMethod)}</p>
<p>Referenca plaćanja: ${escapeHtml(receipt.paymentReference ?? '-')}</p>
<p class="total">Ukupno ${escapeHtml(formatMoney(receipt.totalAmount, receipt.currency))}</p>`;

    return renderDocumentShell({
        body,
        heading: receipt.yearReceiptNumber,
        label: 'Fiskalni račun',
    });
}

export function createAccountBillingRoutes(
    deps: AccountBillingRouteDeps = defaultDeps,
) {
    return new Hono<{ Variables: AuthVariables }>()
        .get(
            '/invoices',
            describeRoute({
                description:
                    'List invoices and receipt status for the current authenticated account.',
                security: authSecurity,
                tags: ['Accounts'],
            }),
            deps.authValidator(['user', 'admin']),
            async (context) => {
                const { accountId } = context.get('authContext');
                const invoices =
                    await deps.getAccountBillingInvoices(accountId);

                return context.json({
                    invoices: invoices.map((invoice) =>
                        serializeInvoice(context, invoice),
                    ),
                });
            },
        )
        .get(
            '/invoices/:invoiceId',
            describeRoute({
                description:
                    'Get one invoice for the current authenticated account.',
                security: authSecurity,
                tags: ['Accounts'],
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('param', invoiceParamSchema),
            async (context) => {
                const { accountId } = context.get('authContext');
                const invoiceId = Number.parseInt(
                    context.req.valid('param').invoiceId,
                    10,
                );
                const invoice = await deps.getAccountBillingInvoice(
                    accountId,
                    invoiceId,
                );
                if (!invoice) {
                    return context.json({ error: 'Invoice not found' }, 404);
                }

                return context.json({
                    invoice: serializeInvoice(context, invoice),
                });
            },
        )
        .get(
            '/invoices/:invoiceId/document',
            describeRoute({
                description:
                    'Render a printable invoice document for the current authenticated account.',
                security: authSecurity,
                tags: ['Accounts'],
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('param', invoiceParamSchema),
            async (context) => {
                const { accountId } = context.get('authContext');
                const invoiceId = Number.parseInt(
                    context.req.valid('param').invoiceId,
                    10,
                );
                const invoice = await deps.getAccountBillingInvoice(
                    accountId,
                    invoiceId,
                );
                if (!invoice) {
                    return context.json({ error: 'Invoice not found' }, 404);
                }

                return context.html(renderInvoiceDocument(invoice));
            },
        )
        .get(
            '/receipts/:receiptId/document',
            describeRoute({
                description:
                    'Render a printable receipt document for the current authenticated account.',
                security: authSecurity,
                tags: ['Accounts'],
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('param', receiptParamSchema),
            async (context) => {
                const { accountId } = context.get('authContext');
                const receiptId = Number.parseInt(
                    context.req.valid('param').receiptId,
                    10,
                );
                const receipt = await deps.getAccountBillingReceipt(
                    accountId,
                    receiptId,
                );
                if (!receipt) {
                    return context.json({ error: 'Receipt not found' }, 404);
                }

                return context.html(renderReceiptDocument(receipt));
            },
        );
}

export function createTestAuthMiddleware({
    accountId = 'test-account',
    userId = 'test-user',
}: {
    accountId?: string;
    userId?: string;
} = {}) {
    return async (
        context: Context<{ Variables: AuthVariables }>,
        next: Next,
    ) => {
        context.set('authContext', {
            accountId,
            userId,
            user: {
                id: userId,
                accountIds: [accountId],
                role: 'user',
            },
        });

        await next();
    };
}

export default createAccountBillingRoutes();
