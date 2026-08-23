import test from 'node:test';
import { createElement } from 'react';
import OrderConfirmationEmailTemplate from '../emails/Commerce/order-confirmation';
import { assertHtmlIncludes, renderNonEmpty } from './renderEmail';

test('order-confirmation renders order reference, items, and total', async () => {
    const html = await renderNonEmpty(
        createElement(OrderConfirmationEmailTemplate, {
            email: 'order@example.test',
            items: [
                {
                    name: 'Rajčica',
                    quantity: 2,
                    amountSubtotal: 900,
                    currency: 'eur',
                },
                {
                    name: 'Suncokret nagrada',
                    quantity: 1,
                    amountSubtotal: 120,
                    currency: 'sunflower',
                },
            ],
            manageUrl: 'https://example.test/vrt',
            orderReference: 'Narudžba #42',
            totalAmountCents: 900,
            currency: 'eur',
        }),
    );

    assertHtmlIncludes(html, 'Narudžba #42');
    assertHtmlIncludes(html, 'Rajčica');
    assertHtmlIncludes(html, 'Suncokret nagrada');
    assertHtmlIncludes(html, '120 suncokreta');
    assertHtmlIncludes(html, 'https://example.test/vrt');
});
