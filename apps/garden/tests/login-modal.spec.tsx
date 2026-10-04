import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page, Route } from '@playwright/test';
import { LoginModalStory } from './LoginModalStory';

type AuthResponse = {
    body: unknown;
    status: number;
};

type AuthApiOptions = {
    login?: AuthResponse;
    register?: AuthResponse;
};

async function fulfillJson(route: Route, response: AuthResponse) {
    await route.fulfill({
        body: JSON.stringify(response.body),
        contentType: 'application/json',
        status: response.status,
    });
}

async function mockAuthApi(page: Page, options: AuthApiOptions = {}) {
    const loginRequests: unknown[] = [];
    const registerRequests: unknown[] = [];

    await page.route('**/api/gredice/**', async (route) => {
        const request = route.request();
        const { pathname } = new URL(request.url());

        if (pathname.endsWith('/api/auth/last-login')) {
            await fulfillJson(route, { body: {}, status: 200 });
            return;
        }

        if (pathname.endsWith('/api/auth/login')) {
            loginRequests.push(request.postDataJSON());
            await fulfillJson(
                route,
                options.login ?? { body: {}, status: 200 },
            );
            return;
        }

        if (pathname.endsWith('/api/auth/register')) {
            registerRequests.push(request.postDataJSON());
            await fulfillJson(
                route,
                options.register ?? { body: {}, status: 201 },
            );
            return;
        }

        throw new Error(`Unexpected authentication request: ${pathname}`);
    });

    return { loginRequests, registerRequests };
}

async function inspectEnterAnimation(locator: Locator) {
    return locator.evaluate((element) => {
        if (!(element instanceof HTMLElement)) {
            throw new Error('Expected an HTML transition element');
        }

        const animation = element.getAnimations()[0];
        if (!animation) {
            throw new Error('Expected an active content transition');
        }

        animation.pause();
        animation.currentTime = 0;

        const timing = animation.effect?.getTiming();
        const duration = Number(timing?.duration ?? 0);
        const initialStyle = window.getComputedStyle(element);
        const initialTransform = initialStyle.transform;
        const initialTranslateY =
            initialTransform === 'none'
                ? 0
                : new DOMMatrix(initialTransform).m42;
        const initialOpacity = Number(initialStyle.opacity);

        animation.currentTime = duration;

        const finalStyle = window.getComputedStyle(element);
        const finalTransform = finalStyle.transform;
        const finalTranslateY =
            finalTransform === 'none' ? 0 : new DOMMatrix(finalTransform).m42;

        return {
            duration,
            easing: initialStyle.animationTimingFunction,
            finalOpacity: Number(finalStyle.opacity),
            finalTranslateY,
            initialOpacity,
            initialTranslateY,
        };
    });
}

async function inspectKeyboardFocus(locator: Locator) {
    return locator.evaluate((element) => {
        if (!(element instanceof HTMLElement)) {
            throw new Error('Expected an HTML focus target');
        }

        const clippingAncestors: string[] = [];
        let ancestor = element.parentElement;

        while (ancestor && ancestor.getAttribute('role') !== 'dialog') {
            const style = window.getComputedStyle(ancestor);
            if (
                style.overflowX === 'hidden' ||
                style.overflowX === 'clip' ||
                style.overflowY === 'hidden' ||
                style.overflowY === 'clip'
            ) {
                clippingAncestors.push(
                    ancestor.getAttribute('data-testid') ??
                        ancestor.className ??
                        ancestor.tagName,
                );
            }
            ancestor = ancestor.parentElement;
        }

        return {
            clippingAncestors,
            focused: document.activeElement === element,
        };
    });
}

function centerY(bounds: { height: number; y: number } | null) {
    if (!bounds) {
        throw new Error('Expected modal bounds');
    }

    return bounds.y + bounds.height / 2;
}

test.beforeEach(async ({ page }) => {
    await mockAuthApi(page);
});

test('animates login providers into the email form and focuses email', async ({
    mount,
    page,
}) => {
    await mount(<LoginModalStory />);

    const dialog = page.getByRole('dialog', { name: 'Prijava' });
    const content = page.getByTestId('auth-content-transition');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zatvori' })).toHaveCount(0);
    await expect(content).toHaveAttribute('data-auth-content', 'providers');
    await expect(page.getByRole('tab', { name: 'Prijava' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Registracija' })).toHaveCount(
        0,
    );
    await expect(
        page.getByRole('button', { name: 'Nastavi sa Google' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Nastavi sa Facebook' }),
    ).toBeVisible();
    expect(
        await content.evaluate((element) => element.getAnimations().length),
    ).toBe(0);

    await page.waitForTimeout(220);
    const modalCenterBefore = centerY(await dialog.boundingBox());

    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();

    await expect(content).toHaveAttribute('data-auth-content', 'email');
    await expect(page.getByRole('tab', { name: 'Prijava' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Registracija' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeFocused();
    expect(await inspectEnterAnimation(content)).toMatchObject({
        duration: 200,
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
        finalOpacity: 1,
        finalTranslateY: 0,
        initialOpacity: 0,
        initialTranslateY: 8,
    });
    expect(centerY(await dialog.boundingBox())).toBeCloseTo(
        modalCenterBefore,
        0,
    );
});

test('keeps login and registration inside email and restores provider focus on back', async ({
    mount,
    page,
}) => {
    await mount(<LoginModalStory />);

    const content = page.getByTestId('auth-content-transition');
    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();
    await expect(page.getByLabel('Email')).toBeFocused();

    await page.getByRole('tab', { name: 'Registracija' }).click();

    await expect(content).toHaveAttribute('data-auth-content', 'email');
    await expect(page.getByLabel('Ponovi zaporku')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Registriraj se' }),
    ).toBeVisible();

    await page
        .getByRole('button', { name: 'Natrag na druge načine prijave' })
        .click();

    await expect(content).toHaveAttribute('data-auth-content', 'providers');
    await expect(
        page.getByRole('button', { name: 'Nastavi sa Google' }),
    ).toBeVisible();
    expect(await inspectEnterAnimation(content)).toMatchObject({
        duration: 200,
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
        finalOpacity: 1,
        finalTranslateY: 0,
        initialOpacity: 0,
        initialTranslateY: -8,
    });

    const emailTrigger = page.getByRole('button', {
        name: 'Nastavi s emailom',
    });
    const focusPresentation = await inspectKeyboardFocus(emailTrigger);
    expect(focusPresentation.focused).toBe(true);
    expect(focusPresentation.clippingAncestors).toEqual([]);
});

test('keeps a registration default hidden until email is selected', async ({
    mount,
    page,
}) => {
    await mount(<LoginModalStory defaultTab="register" />);

    await expect(page.getByRole('tab', { name: 'Registracija' })).toHaveCount(
        0,
    );
    await expect(
        page.getByRole('button', { name: 'Nastavi sa Google' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();

    await expect(
        page.getByRole('tab', { name: 'Registracija' }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Ponovi zaporku')).toBeVisible();
});

test('preserves login submission and error feedback', async ({
    mount,
    page,
}) => {
    await page.unrouteAll({ behavior: 'wait' });
    const recorded = await mockAuthApi(page, {
        login: {
            body: { errorCode: 'invalid_credentials', leftAttempts: 2 },
            status: 401,
        },
    });
    await mount(<LoginModalStory />);

    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();
    await page.getByLabel('Email').fill('vrtlar@example.com');
    await page.getByLabel('Zaporka').fill('pogresna-zaporka');
    await page.getByRole('button', { name: 'Prijava' }).click();

    await expect(
        page.getByText('Prijava nije uspjela. Preostalo pokušaja: 2.'),
    ).toBeVisible();
    expect(recorded.loginRequests).toEqual([
        { email: 'vrtlar@example.com', password: 'pogresna-zaporka' },
    ]);
});

test('preserves registration submission and error feedback', async ({
    mount,
    page,
}) => {
    await page.unrouteAll({ behavior: 'wait' });
    const recorded = await mockAuthApi(page, {
        register: { body: {}, status: 500 },
    });
    await mount(<LoginModalStory />);

    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();
    const registrationTab = page.getByRole('tab', { name: 'Registracija' });
    await registrationTab.click();
    await expect(registrationTab).toHaveAttribute('aria-selected', 'true');

    const registrationPanel = page.getByRole('tabpanel');
    const registrationButton = registrationPanel.getByRole('button', {
        name: 'Registriraj se',
    });
    const registrationEmail = registrationPanel.getByLabel('Email');
    const registrationPassword = registrationPanel.getByLabel('Zaporka', {
        exact: true,
    });
    const registrationRepeatPassword =
        registrationPanel.getByLabel('Ponovi zaporku');
    await expect(registrationEmail).toBeFocused();
    await registrationEmail.fill('nova@example.com');
    await registrationPassword.fill('sigurna-zaporka');
    await registrationRepeatPassword.fill('sigurna-zaporka');
    await expect(registrationEmail).toHaveValue('nova@example.com');
    await expect(registrationPassword).toHaveValue('sigurna-zaporka');
    await expect(registrationRepeatPassword).toHaveValue('sigurna-zaporka');
    await expect(registrationButton).toBeEnabled();
    await registrationButton.click();

    await expect(
        page.getByText('Registracija nije uspjela. Pokušaj ponovno.'),
    ).toBeVisible();
    expect(recorded.registerRequests).toEqual([
        { email: 'nova@example.com', password: 'sigurna-zaporka' },
    ]);
    await expect(page.getByTestId('last-router-push')).toHaveText('none');
});

test('uses opacity-only 120 ms transitions with reduced motion in both directions', async ({
    mount,
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(<LoginModalStory />);

    const content = page.getByTestId('auth-content-transition');
    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();

    expect(await inspectEnterAnimation(content)).toMatchObject({
        duration: 120,
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
        finalOpacity: 1,
        finalTranslateY: 0,
        initialOpacity: 0,
        initialTranslateY: 0,
    });

    await page
        .getByRole('button', { name: 'Natrag na druge načine prijave' })
        .click();

    await expect(content).toHaveAttribute('data-auth-content', 'providers');
    expect(await inspectEnterAnimation(content)).toMatchObject({
        duration: 120,
        initialOpacity: 0,
        initialTranslateY: 0,
    });
});

test('supports a controlled dismissible mode without changing the legacy default', async ({
    mount,
    page,
}) => {
    await mount(<LoginModalStory controlled dismissible />);

    await page.getByRole('button', { name: 'Zatvori' }).click();

    await expect(page.getByRole('dialog', { name: 'Prijava' })).toBeHidden();
    await expect(page.getByTestId('login-modal-open-state')).toHaveText(
        'closed',
    );
    await expect(page.getByTestId('login-modal-open-change-count')).toHaveText(
        '1',
    );
    await expect(page.locator('a[href="https://www.gredice.com"]')).toHaveCount(
        0,
    );
});

test('closes controlled mode and reports successful password authentication once', async ({
    mount,
    page,
}) => {
    await page.unrouteAll({ behavior: 'wait' });
    const recorded = await mockAuthApi(page);
    await mount(<LoginModalStory controlled dismissible />);

    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();
    await page.getByLabel('Email').fill('vrtlar@example.com');
    await page.getByLabel('Zaporka').fill('sigurna-zaporka');
    await page.getByRole('button', { name: 'Prijava' }).click();

    await expect(page.getByTestId('login-modal-open-state')).toHaveText(
        'closed',
    );
    await expect(page.getByTestId('login-modal-open-change-count')).toHaveText(
        '1',
    );
    await expect(
        page.getByTestId('login-modal-authenticated-count'),
    ).toHaveText('1');
    expect(recorded.loginRequests).toEqual([
        { email: 'vrtlar@example.com', password: 'sigurna-zaporka' },
    ]);
});

for (const provider of ['google', 'facebook'] as const) {
    test(`starts ${provider} OAuth with a provider-matched Outlet continuation`, async ({
        mount,
        page,
    }) => {
        let requestedUrl: string | undefined;
        const gardenOrigin = new URL(page.url()).origin;
        await page.route(`**/api/auth/${provider}**`, async (route) => {
            requestedUrl = route.request().url();
            await route.abort('aborted');
        });
        await mount(
            <LoginModalStory
                controlled
                dismissible
                returnTo="/outlet?rezervacija=1&ponuda=302"
            />,
        );

        await page
            .getByRole('button', {
                name: `Nastavi sa ${provider === 'google' ? 'Google' : 'Facebook'}`,
            })
            .click();
        await expect.poll(() => requestedUrl).not.toBeUndefined();

        const authUrl = new URL(requestedUrl ?? 'https://invalid.local');
        const callbackUrl = new URL(
            authUrl.searchParams.get('redirect') ?? 'https://invalid.local',
        );
        expect(authUrl.pathname).toBe(`/api/auth/${provider}`);
        expect(callbackUrl.origin).toBe(gardenOrigin);
        expect(callbackUrl.pathname).toBe(
            `/prijava/${provider}-prijava/povratak`,
        );
        expect(callbackUrl.searchParams.getAll('returnTo')).toEqual([
            '/outlet?ponuda=302&rezervacija=1',
        ]);
        expect(callbackUrl.hash).toBe('');
    });
}
