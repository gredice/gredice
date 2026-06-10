import test from 'node:test';
import { createElement } from 'react';
import DeliveryCancelledEmailTemplate from '../emails/Notifications/delivery-cancelled';
import DeliveryReadyEmailTemplate from '../emails/Notifications/delivery-ready';
import DeliveryScheduledEmailTemplate from '../emails/Notifications/delivery-scheduled';
import DeliverySurveyEmailTemplate from '../emails/Notifications/delivery-survey';
import { assertHtmlIncludes, renderNonEmpty } from './renderEmail';

test('delivery-scheduled renders with delivery details', async () => {
    const deliveryWindow = '15. lipnja 2026. od 10:00 do 12:00';
    const manageUrl = 'https://example.test/delivery-scheduled';
    const html = await renderNonEmpty(
        createElement(DeliveryScheduledEmailTemplate, {
            addressLine: 'Testna ulica 12',
            contactName: 'Luka',
            deliveryWindow,
            email: 'scheduled@example.test',
            manageUrl,
        }),
    );

    assertHtmlIncludes(html, deliveryWindow);
    assertHtmlIncludes(html, manageUrl);
});

test('delivery-ready renders with ready items and delivery details', async () => {
    const deliveryWindow = '16. lipnja 2026. od 14:00 do 16:00';
    const manageUrl = 'https://example.test/delivery-ready';
    const readyItem = 'Testna rajcica';
    const html = await renderNonEmpty(
        createElement(DeliveryReadyEmailTemplate, {
            addressLine: 'Probna avenija 3',
            contactName: 'Ana',
            deliveryWindow,
            email: 'ready@example.test',
            manageUrl,
            readyItems: [readyItem, 'Testna salata'],
        }),
    );

    assertHtmlIncludes(html, deliveryWindow);
    assertHtmlIncludes(html, manageUrl);
    assertHtmlIncludes(html, readyItem);
});

test('delivery-cancelled renders with the cancelled delivery details', async () => {
    const deliveryWindow = '17. lipnja 2026. od 09:00 do 11:00';
    const manageUrl = 'https://example.test/delivery-cancelled';
    const html = await renderNonEmpty(
        createElement(DeliveryCancelledEmailTemplate, {
            addressLine: 'Primjer cesta 4',
            contactName: 'Iva',
            deliveryWindow,
            email: 'cancelled@example.test',
            manageUrl,
        }),
    );

    assertHtmlIncludes(html, deliveryWindow);
    assertHtmlIncludes(html, manageUrl);
});

test('delivery-survey renders with the survey URL and period', async () => {
    const deliveryPeriod = 'probnog lipnja';
    const surveyUrl = 'https://example.test/delivery-survey';
    const html = await renderNonEmpty(
        createElement(DeliverySurveyEmailTemplate, {
            deliveryCount: 3,
            deliveryPeriod,
            email: 'survey@example.test',
            surveyUrl,
        }),
    );

    assertHtmlIncludes(html, deliveryPeriod);
    assertHtmlIncludes(html, surveyUrl);
});
