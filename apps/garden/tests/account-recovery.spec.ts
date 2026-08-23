import { expect, type Locator, type Page, test } from '@playwright/test';
import { errorMessages } from '../misc/errorMessages';

const verificationEndpoint = '/api/auth/send-verify-email';
const passwordResetEndpoint = '/api/auth/send-change-password-email';
const rawUpstreamError = 'smtp-provider-secret-debug-detail';

type RecoveryApiBehavior = {
    abort?: boolean;
    endpoint: string;
    status: number;
};

async function mockRecoveryApi(page: Page, behavior: RecoveryApiBehavior) {
    const requests: unknown[] = [];

    await page.route('**/api/gredice/**', async (route) => {
        const { pathname } = new URL(route.request().url());

        if (pathname.endsWith('/api/auth/current-claims')) {
            await route.fulfill({
                body: JSON.stringify({ error: 'Unauthorized' }),
                contentType: 'application/json',
                status: 401,
            });
            return;
        }

        if (pathname.endsWith(behavior.endpoint)) {
            requests.push(route.request().postDataJSON());
            if (behavior.abort) {
                await route.abort('failed');
                return;
            }

            await route.fulfill({
                body: JSON.stringify(
                    behavior.status === 200
                        ? { message: 'Email sent' }
                        : { error: rawUpstreamError },
                ),
                contentType: 'application/json',
                status: behavior.status,
            });
            return;
        }

        await route.fulfill({
            body: JSON.stringify({ error: 'Not found' }),
            contentType: 'application/json',
            status: 404,
        });
    });

    return requests;
}

async function expectNoHorizontalOverflow(page: Page) {
    const viewport = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(viewport.clientWidth).toBe(320);
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
}

async function expectMinimumHeight(locator: Locator, minimum: number) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height).toBeGreaterThanOrEqual(minimum);
}

test.describe('Garden account recovery', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
    });

    test('resends verification email and shows the correct mobile confirmation', async ({
        page,
    }) => {
        const requests = await mockRecoveryApi(page, {
            endpoint: verificationEndpoint,
            status: 200,
        });

        await page.goto(
            '/prijava/potvrda-emaila/posalji?email=farmer%40example.com',
        );

        const resendButton = page.getByRole('button', {
            name: 'Pošalji ponovno',
        });
        await expectMinimumHeight(resendButton, 44);
        await expectNoHorizontalOverflow(page);
        await resendButton.click();

        await expect(page).toHaveURL('/prijava/potvrda-emaila/poslano');
        await expect(
            page.getByText('Provjeri svoj email za potvrdu email adrese'),
        ).toBeVisible();
        await expect(page.getByText(/promjene zaporke/u)).toHaveCount(0);
        await expectMinimumHeight(
            page.getByRole('link', { name: 'Povratak' }),
            44,
        );
        await expectNoHorizontalOverflow(page);
        expect(requests).toEqual([{ email: 'farmer@example.com' }]);
    });

    test('keeps verification failures bounded and retryable', async ({
        page,
    }) => {
        await mockRecoveryApi(page, {
            endpoint: verificationEndpoint,
            status: 500,
        });

        await page.goto(
            '/prijava/potvrda-emaila/posalji?email=farmer%40example.com',
        );
        const resendButton = page.getByRole('button', {
            name: 'Pošalji ponovno',
        });
        await resendButton.click();

        await expect(
            page.getByText(errorMessages.verificationEmail),
        ).toBeVisible();
        await expect(page.getByText(rawUpstreamError)).toHaveCount(0);
        await expect(page).toHaveURL(/\/prijava\/potvrda-emaila\/posalji/u);
        await expect(resendButton).toBeEnabled();
        await expectNoHorizontalOverflow(page);
    });

    test('turns verification transport failures into the same bounded error', async ({
        page,
    }) => {
        await mockRecoveryApi(page, {
            abort: true,
            endpoint: verificationEndpoint,
            status: 0,
        });

        await page.goto(
            '/prijava/potvrda-emaila/posalji?email=farmer%40example.com',
        );
        const resendButton = page.getByRole('button', {
            name: 'Pošalji ponovno',
        });
        await resendButton.click();

        await expect(
            page.getByText(errorMessages.verificationEmail),
        ).toBeVisible();
        await expect(resendButton).toBeEnabled();
    });

    test('submits password recovery with mobile-safe input and controls', async ({
        page,
    }) => {
        const requests = await mockRecoveryApi(page, {
            endpoint: passwordResetEndpoint,
            status: 200,
        });

        await page.goto(
            '/prijava/zaboravljena-zaporka?email=farmer%40example.com',
        );

        const emailInput = page.getByLabel('Email');
        const submitButton = page.getByRole('button', {
            name: 'Pošalji email',
        });
        const inputFontSize = await emailInput.evaluate((input) =>
            Number.parseFloat(getComputedStyle(input).fontSize),
        );
        const inputControlHeight = await emailInput.evaluate(
            (input) => input.parentElement?.getBoundingClientRect().height ?? 0,
        );

        expect(inputFontSize).toBeGreaterThanOrEqual(16);
        expect(inputControlHeight).toBeGreaterThanOrEqual(44);
        await expectMinimumHeight(submitButton, 44);
        await expectNoHorizontalOverflow(page);
        await submitButton.click();

        await expect(page).toHaveURL('/prijava/zaboravljena-zaporka/poslano');
        await expect(
            page.getByText('Provjeri svoj email za nastavak promjene zaporke'),
        ).toBeVisible();
        await expectNoHorizontalOverflow(page);
        expect(requests).toEqual([{ email: 'farmer@example.com' }]);
    });

    test('shows a bounded password recovery error without leaking response details', async ({
        page,
    }) => {
        await mockRecoveryApi(page, {
            endpoint: passwordResetEndpoint,
            status: 404,
        });

        await page.goto(
            '/prijava/zaboravljena-zaporka?email=farmer%40example.com',
        );
        const submitButton = page.getByRole('button', {
            name: 'Pošalji email',
        });
        await submitButton.click();

        await expect(
            page.getByRole('alert').filter({
                hasText: errorMessages.forgotPasswordEmail,
            }),
        ).toBeVisible();
        await expect(page.getByText(rawUpstreamError)).toHaveCount(0);
        await expect(page).toHaveURL(/\/prijava\/zaboravljena-zaporka/u);
        await expect(submitButton).toBeEnabled();
        await expectNoHorizontalOverflow(page);
    });
});
