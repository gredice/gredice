import test from 'node:test';
import { createElement } from 'react';
import BillingDocumentsEmailTemplate from '../emails/Commerce/billing-documents';
import { assertHtmlIncludes, renderNonEmpty } from './renderEmail';

test('billing-documents renders invoice, receipt, and billing links', async () => {
    const html = await renderNonEmpty(
        createElement(BillingDocumentsEmailTemplate, {
            email: 'kupac@example.test',
            invoiceNumber: 'PON-2026-0042',
            invoiceUrl: 'https://api.gredice.test/api/invoice',
            receiptNumber: '2026-7',
            receiptUrl: 'https://api.gredice.test/api/receipt',
            billingUrl: 'https://vrt.gredice.test/racun/naplata',
        }),
    );

    assertHtmlIncludes(html, 'PON-2026-0042');
    assertHtmlIncludes(html, '2026-7');
    assertHtmlIncludes(html, 'https://api.gredice.test/api/invoice');
    assertHtmlIncludes(html, 'https://api.gredice.test/api/receipt');
    assertHtmlIncludes(html, 'https://vrt.gredice.test/racun/naplata');
});
