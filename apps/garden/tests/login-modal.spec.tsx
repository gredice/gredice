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
            boxShadow: window.getComputedStyle(element).boxShadow,
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
    await expect(content).toHaveAttribute('data-auth-content', 'providers');
    await expect(
        page.getByRole('button', { name: 'Google prijava' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Facebook prijava' }),
    ).toBeVisible();
    expect(
        await content.evaluate((element) => element.getAnimations().length),
    ).toBe(0);

    await page.waitForTimeout(220);
    const modalCenterBefore = centerY(await dialog.boundingBox());

    await page.getByRole('button', { name: 'Email prijava' }).click();

    await expect(content).toHaveAttribute('data-auth-content', 'email');
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

test('animates back to registration providers and into registration email', async ({
    mount,
    page,
}) => {
    await mount(<LoginModalStory />);

    const content = page.getByTestId('auth-content-transition');
    await page.getByRole('button', { name: 'Email prijava' }).click();
    await expect(page.getByLabel('Email')).toBeFocused();

    await page.getByRole('tab', { name: 'Registracija' }).click();

    await expect(content).toHaveAttribute('data-auth-content', 'providers');
    const googleRegistration = page.getByRole('button', {
        name: 'Google registracija',
    });
    await expect(googleRegistration).toBeVisible();
    expect(await inspectEnterAnimation(content)).toMatchObject({
        duration: 200,
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
        finalOpacity: 1,
        finalTranslateY: 0,
        initialOpacity: 0,
        initialTranslateY: -8,
    });

    await page.keyboard.press('Tab');
    const focusPresentation = await inspectKeyboardFocus(googleRegistration);
    expect(focusPresentation.focused).toBe(true);
    expect(focusPresentation.boxShadow).not.toBe('none');
    expect(focusPresentation.clippingAncestors).toEqual([]);

    await page.getByRole('button', { name: 'Email registracija' }).click();

    await expect(content).toHaveAttribute('data-auth-content', 'email');
    await expect(page.getByLabel('Email')).toBeFocused();
    await expect(page.getByLabel('Ponovi zaporku')).toBeVisible();
    expect(await inspectEnterAnimation(content)).toMatchObject({
        duration: 200,
        initialOpacity: 0,
        initialTranslateY: 8,
    });
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

    await page.getByRole('button', { name: 'Email prijava' }).click();
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

    await page.getByRole('tab', { name: 'Registracija' }).click();
    await page.getByRole('button', { name: 'Email registracija' }).click();
    await page.getByLabel('Email').fill('nova@example.com');
    await page.getByLabel('Zaporka').fill('sigurna-zaporka');
    await page.getByLabel('Ponovi zaporku').fill('sigurna-zaporka');
    await page.getByRole('button', { name: 'Registriraj se' }).click();

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
    await page.getByRole('button', { name: 'Email prijava' }).click();

    expect(await inspectEnterAnimation(content)).toMatchObject({
        duration: 120,
        easing: 'cubic-bezier(0, 0, 0.2, 1)',
        finalOpacity: 1,
        finalTranslateY: 0,
        initialOpacity: 0,
        initialTranslateY: 0,
    });

    await page.getByRole('tab', { name: 'Registracija' }).click();

    await expect(content).toHaveAttribute('data-auth-content', 'providers');
    expect(await inspectEnterAnimation(content)).toMatchObject({
        duration: 120,
        initialOpacity: 0,
        initialTranslateY: 0,
    });
});
