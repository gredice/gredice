import test from 'node:test';
import { createElement } from 'react';
import BirthdayEmailTemplate from '../emails/Notifications/birthday';
import EmailNotificationsBulkTemplate from '../emails/Notifications/notifications-bulk';
import { assertHtmlIncludes, renderNonEmpty } from './renderEmail';

test('birthday renders with the recipient name and sunflower amount', async () => {
    const html = await renderNonEmpty(
        createElement(BirthdayEmailTemplate, {
            appDomain: 'example.test',
            email: 'birthday@example.test',
            name: 'Mila Test',
            sunflowerAmount: 1234,
        }),
    );

    assertHtmlIncludes(html, 'Mila Test');
    assertHtmlIncludes(html, '1234');
    assertHtmlIncludes(html, 'vrt.example.test');
});

test('notifications-bulk renders with the notification image URL', async () => {
    const notificationImageUrl = 'https://example.test/notification.jpg';
    const html = await renderNonEmpty(
        createElement(EmailNotificationsBulkTemplate, {
            email: 'bulk@example.test',
            notificationImageUrls: [notificationImageUrl],
            notificationsCount: 3,
        }),
    );

    assertHtmlIncludes(html, notificationImageUrl);
    assertHtmlIncludes(html, 'bulk@example.test');
});
