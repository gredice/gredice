import { expect, test } from '@playwright/experimental-ct-react';
import { FeedbackModalHarness } from './FeedbackModalHarness';
import '../app/globals.css';

type FeedbackRequest = {
    method: string;
    pathname: string;
    body: unknown;
};

const currentUser = {
    id: 'user-1',
    userName: 'ana',
    displayName: 'Ana',
    role: 'user',
};

test('submits the selected thumbs rating immediately', async ({
    mount,
    page,
}) => {
    const requests: FeedbackRequest[] = [];

    await page.route('**/api/gredice/api/feedback**', async (route) => {
        const request = route.request();
        requests.push({
            method: request.method(),
            pathname: new URL(request.url()).pathname,
            body: request.postDataJSON(),
        });

        await route.fulfill({
            status: 200,
            json: { id: '11111111-1111-4111-8111-111111111111' },
        });
    });

    await mount(
        <FeedbackModalHarness
            topic="www/test-feedback"
            data={{ page: 'plant' }}
            currentUser={currentUser}
        />,
    );

    await page.getByTitle('Sviđa mi se', { exact: true }).click();

    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toMatchObject({
        method: 'POST',
        pathname: '/api/gredice/api/feedback',
        body: {
            topic: 'www/test-feedback',
            data: {
                page: 'plant',
                userId: 'user-1',
            },
            score: '1',
        },
    });
});

test('updates the created feedback with a comment instead of creating another row', async ({
    mount,
    page,
}) => {
    const requests: FeedbackRequest[] = [];

    await page.route('**/api/gredice/api/feedback**', async (route) => {
        const request = route.request();
        requests.push({
            method: request.method(),
            pathname: new URL(request.url()).pathname,
            body: request.postDataJSON(),
        });

        await route.fulfill({
            status: 200,
            json: { id: '22222222-2222-4222-8222-222222222222' },
        });
    });

    await mount(
        <FeedbackModalHarness
            topic="www/test-feedback"
            data={{ page: 'plant' }}
            currentUser={currentUser}
        />,
    );

    await page.getByTitle('Ne sviđa mi se').first().click();
    const form = page.locator('form').filter({
        hasText: 'Kako ti se sviđa ovaj sadržaj?',
    });
    await form.getByPlaceholder('Komentar').fill('Nedostaje detalja.');
    await form.getByRole('button', { name: 'Pošalji' }).click();

    await expect.poll(() => requests.length).toBe(2);
    expect(requests.map((request) => request.method)).toEqual([
        'POST',
        'PATCH',
    ]);
    expect(requests[1]).toMatchObject({
        pathname:
            '/api/gredice/api/feedback/22222222-2222-4222-8222-222222222222',
        body: {
            score: '-1',
            comment: 'Nedostaje detalja.',
        },
    });
});

test('updates the same feedback when the rating changes in the modal', async ({
    mount,
    page,
}) => {
    const requests: FeedbackRequest[] = [];

    await page.route('**/api/gredice/api/feedback**', async (route) => {
        const request = route.request();
        requests.push({
            method: request.method(),
            pathname: new URL(request.url()).pathname,
            body: request.postDataJSON(),
        });

        await route.fulfill({
            status: 200,
            json: { id: '33333333-3333-4333-8333-333333333333' },
        });
    });

    await mount(
        <FeedbackModalHarness
            topic="www/test-feedback"
            data={{ page: 'plant' }}
            currentUser={currentUser}
        />,
    );

    await page.getByTitle('Sviđa mi se', { exact: true }).click();
    const form = page.locator('form').filter({
        hasText: 'Kako ti se sviđa ovaj sadržaj?',
    });
    await form.getByTitle('Ne sviđa mi se').click();

    await expect.poll(() => requests.length).toBe(2);
    expect(requests.map((request) => request.method)).toEqual([
        'POST',
        'PATCH',
    ]);
    expect(requests[1]).toMatchObject({
        pathname:
            '/api/gredice/api/feedback/33333333-3333-4333-8333-333333333333',
        body: {
            score: '-1',
        },
    });
});

test('keeps the interaction recoverable when the immediate submit fails', async ({
    mount,
    page,
}) => {
    const requests: FeedbackRequest[] = [];

    await page.route('**/api/gredice/api/feedback**', async (route) => {
        const request = route.request();
        requests.push({
            method: request.method(),
            pathname: new URL(request.url()).pathname,
            body: request.postDataJSON(),
        });

        if (requests.length === 1) {
            await route.fulfill({
                status: 500,
                json: { error: 'Feedback failed' },
            });
            return;
        }

        await route.fulfill({
            status: 200,
            json: { id: '44444444-4444-4444-8444-444444444444' },
        });
    });

    await mount(
        <FeedbackModalHarness
            topic="www/test-feedback"
            data={{ page: 'plant' }}
            currentUser={currentUser}
        />,
    );

    await page.getByTitle('Sviđa mi se', { exact: true }).click();
    await expect(
        page.getByText('Nismo uspjeli spremiti mišljenje. Pokušaj ponovno.'),
    ).toBeVisible();

    const form = page.locator('form').filter({
        hasText: 'Kako ti se sviđa ovaj sadržaj?',
    });
    await form.getByPlaceholder('Komentar').fill('Može jasnije.');
    await form.getByRole('button', { name: 'Pošalji' }).click();

    await expect.poll(() => requests.length).toBe(2);
    expect(requests.map((request) => request.method)).toEqual(['POST', 'POST']);
    expect(requests[1]).toMatchObject({
        pathname: '/api/gredice/api/feedback',
        body: {
            score: '1',
            comment: 'Može jasnije.',
        },
    });
});
