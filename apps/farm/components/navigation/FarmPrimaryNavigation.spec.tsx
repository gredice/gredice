import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { FarmAuthenticatedShellHarness } from '../../playwright/FarmAuthenticatedShellHarness';
import { FarmShellAuthTransitionHarness } from '../../playwright/FarmShellAuthTransitionHarness';
import { FarmPrimaryNavigation } from './FarmPrimaryNavigation';

const phoneViewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

const expectedDestinations = [
    'today',
    'raised_beds',
    'greenhouse',
    'notifications',
    'schedule',
] as const;

const expectedLabels = [
    'Danas',
    'Gredice',
    'Staklenik',
    'Obavijesti',
    'Raspored',
] as const;

const nextNavigationRouter = {
    back: () => undefined,
    bfcacheId: 'farm-navigation-test',
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
} satisfies AppRouterInstance;

function navigation({
    hasUnreadNotifications = true,
    pathname = '/raised-beds/42',
}: {
    hasUnreadNotifications?: boolean;
    pathname?: string;
} = {}) {
    return (
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <FarmPrimaryNavigation
                hasUnreadNotifications={hasUnreadNotifications}
                pathname={pathname}
            />
        </AppRouterContext.Provider>
    );
}

function visibleNavigation(component: Locator) {
    return component.getByRole('navigation', {
        name: 'Glavna navigacija farme',
    });
}

async function expectOrderedDestinationsAndLabels(navigationElement: Locator) {
    const links = navigationElement.getByRole('link');

    await expect(links).toHaveCount(expectedDestinations.length);
    expect(
        await links.evaluateAll((elements) =>
            elements.map((element) =>
                element.getAttribute('data-farm-navigation-destination'),
            ),
        ),
    ).toEqual(expectedDestinations);

    for (const [index, label] of expectedLabels.entries()) {
        await expect(links.nth(index)).toContainText(label);
    }
}

async function expectMinimumTargetSize(navigationElement: Locator) {
    const targetSizes = await navigationElement
        .getByRole('link')
        .evaluateAll((elements) =>
            elements.map((element) => {
                const bounds = element.getBoundingClientRect();
                return {
                    height: bounds.height,
                    label: element.textContent?.trim() ?? '',
                    width: bounds.width,
                };
            }),
        );

    for (const target of targetSizes) {
        expect(target.width, target.label).toBeGreaterThanOrEqual(44);
        expect(target.height, target.label).toBeGreaterThanOrEqual(44);
    }
}

async function expectNoHorizontalOverflow(navigationElement: Locator) {
    expect(
        await navigationElement.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return (
                bounds.left >= 0 &&
                bounds.right <= window.innerWidth &&
                element.scrollWidth <= element.clientWidth &&
                document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth
            );
        }),
    ).toBe(true);

    const linksFit = await navigationElement
        .getByRole('link')
        .evaluateAll((elements) =>
            elements.every((element) => {
                const bounds = element.getBoundingClientRect();
                const label = element.querySelector('span:not([aria-hidden])');
                const labelBounds = label?.getBoundingClientRect();

                return (
                    bounds.left >= 0 &&
                    bounds.right <= window.innerWidth &&
                    element.scrollWidth <= element.clientWidth &&
                    (!label ||
                        !labelBounds ||
                        (labelBounds.left >= bounds.left &&
                            labelBounds.right <= bounds.right &&
                            label.scrollWidth <= label.clientWidth))
                );
            }),
        );

    expect(linksFit).toBe(true);
}

async function expectActiveState(navigationElement: Locator) {
    const activeLink = navigationElement.getByRole('link', {
        name: 'Gredice',
    });
    await expect(activeLink).toHaveAttribute('aria-current', 'page');
    await expect(
        navigationElement.locator('a[aria-current="page"]'),
    ).toHaveCount(1);

    const marker = activeLink.locator('span[aria-hidden]').first();
    await expect(marker).toBeVisible();
    expect(
        await marker.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            const backgroundColor = getComputedStyle(element).backgroundColor;
            return (
                bounds.width > 0 &&
                bounds.height >= 2 &&
                backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                backgroundColor !== 'transparent'
            );
        }),
    ).toBe(true);
}

async function expectUnreadState(navigationElement: Locator) {
    await expect(
        navigationElement.getByRole('link', {
            name: 'Obavijesti, ima nepročitanih',
        }),
    ).toBeVisible();
    await expect(
        navigationElement.getByText('Novo', { exact: true }),
    ).toBeVisible();
    await expect(
        navigationElement.getByText('Novo', { exact: true }),
    ).toHaveCount(1);
}

async function expectNoFarmSelector(navigationElement: Locator) {
    await expect(navigationElement.getByRole('combobox')).toHaveCount(0);
    await expect(navigationElement.locator('select')).toHaveCount(0);
    await expect(
        navigationElement.getByText(/Sve farme|Moje farme|Odaberi farmu/i),
    ).toHaveCount(0);
}

for (const viewport of phoneViewports) {
    test(`keeps the complete mobile navigation usable at ${viewport.width}x${viewport.height}`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize(viewport);
        const component = await mount(navigation());
        const navigationElement = visibleNavigation(component);

        await expect(navigationElement).toHaveCount(1);
        await expect(navigationElement).toHaveAttribute(
            'data-farm-navigation',
            'mobile',
        );
        await expectOrderedDestinationsAndLabels(navigationElement);
        await expectMinimumTargetSize(navigationElement);
        await expectNoHorizontalOverflow(navigationElement);
        await expectActiveState(navigationElement);
        await expectUnreadState(navigationElement);
        await expectNoFarmSelector(navigationElement);
    });
}

test('keeps one compact desktop navigation with the same order and states', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const component = await mount(navigation());
    const navigationElement = visibleNavigation(component);

    await expect(navigationElement).toHaveCount(1);
    await expect(navigationElement).toHaveAttribute(
        'data-farm-navigation',
        'desktop',
    );
    await expectOrderedDestinationsAndLabels(navigationElement);
    await expectMinimumTargetSize(navigationElement);
    await expectNoHorizontalOverflow(navigationElement);
    await expectActiveState(navigationElement);
    await expectUnreadState(navigationElement);
    await expectNoFarmSelector(navigationElement);
});

test('removes both visible and accessible unread wording when there is no unread work', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(phoneViewports[0]);
    const component = await mount(
        navigation({ hasUnreadNotifications: false }),
    );
    const navigationElement = visibleNavigation(component);

    await expect(
        navigationElement.getByRole('link', {
            name: 'Obavijesti',
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        navigationElement.getByText('Novo', { exact: true }),
    ).toHaveCount(0);
    await expect(navigationElement.getByText(/nepročitan/i)).toHaveCount(0);
});

test('keeps keyboard focus in the visible navigation order', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(phoneViewports[0]);
    const component = await mount(navigation());
    const navigationElement = visibleNavigation(component);
    const links = navigationElement.getByRole('link');

    await page.keyboard.press('Tab');
    for (let index = 0; index < expectedDestinations.length; index += 1) {
        await expect(links.nth(index)).toBeFocused();
        if (index < expectedDestinations.length - 1) {
            await page.keyboard.press('Tab');
        }
    }
});

test('honors overridden mobile safe-area insets without moving targets under the screen edge', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(phoneViewports[0]);
    await page.evaluate(() => {
        document.documentElement.style.setProperty(
            '--farm-safe-area-bottom',
            '24px',
        );
        document.documentElement.style.setProperty(
            '--farm-safe-area-left',
            '12px',
        );
        document.documentElement.style.setProperty(
            '--farm-safe-area-right',
            '12px',
        );
    });

    const component = await mount(navigation());
    const navigationElement = visibleNavigation(component);
    const links = navigationElement.getByRole('link');

    expect(
        await navigationElement.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
                bottom: style.paddingBottom,
                left: style.paddingLeft,
                right: style.paddingRight,
            };
        }),
    ).toEqual({ bottom: '24px', left: '12px', right: '12px' });

    const firstBounds = await links.first().boundingBox();
    const lastBounds = await links.last().boundingBox();
    expect(firstBounds).not.toBeNull();
    expect(lastBounds).not.toBeNull();
    if (!firstBounds || !lastBounds) {
        throw new Error('Expected safe-area navigation links to render.');
    }

    expect(firstBounds.x).toBeGreaterThanOrEqual(12);
    expect(lastBounds.x + lastBounds.width).toBeLessThanOrEqual(
        phoneViewports[0].width - 12,
    );
    await expectMinimumTargetSize(navigationElement);
    await expectNoHorizontalOverflow(navigationElement);
});

test('keeps the final content action above the fixed navigation and safe area', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(phoneViewports[0]);
    await page.evaluate(() => {
        document.documentElement.style.setProperty(
            '--farm-safe-area-bottom',
            '24px',
        );
    });

    const component = await mount(
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <FarmAuthenticatedShellHarness />
        </AppRouterContext.Provider>,
    );
    const navigationElement = visibleNavigation(component);
    const finalAction = component.locator('[data-final-content-action]');

    await finalAction.scrollIntoViewIfNeeded();

    const navigationBounds = await navigationElement.boundingBox();
    const actionBounds = await finalAction.boundingBox();
    expect(navigationBounds).not.toBeNull();
    expect(actionBounds).not.toBeNull();
    if (!navigationBounds || !actionBounds) {
        throw new Error(
            'Expected shell navigation and final action to render.',
        );
    }

    expect(actionBounds.y + actionBounds.height).toBeLessThanOrEqual(
        navigationBounds.y,
    );
});

test('keeps content before the fixed mobile navigation in reading and focus order', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(phoneViewports[0]);
    const component = await mount(
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <FarmAuthenticatedShellHarness />
        </AppRouterContext.Provider>,
    );
    const navigationElement = visibleNavigation(component);
    const finalAction = component.locator('[data-final-content-action]');

    expect(
        await component
            .locator(
                '[data-farm-shell-content], [data-farm-navigation="mobile"]',
            )
            .evaluateAll((elements) =>
                elements.map((element) =>
                    element.hasAttribute('data-farm-shell-content')
                        ? 'content'
                        : 'navigation',
                ),
            ),
    ).toEqual(['content', 'navigation']);

    await page.keyboard.press('Tab');
    await expect(finalAction).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(navigationElement.getByRole('link').first()).toBeFocused();
});

test('keeps page content clear of top and landscape safe areas', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(phoneViewports[0]);
    await page.evaluate(() => {
        document.documentElement.style.setProperty(
            '--farm-safe-area-top',
            '20px',
        );
        document.documentElement.style.setProperty(
            '--farm-safe-area-left',
            '12px',
        );
        document.documentElement.style.setProperty(
            '--farm-safe-area-right',
            '16px',
        );
    });

    const component = await mount(
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <FarmAuthenticatedShellHarness />
        </AppRouterContext.Provider>,
    );
    const content = component.locator('[data-farm-shell-content]');

    expect(
        await content.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
                left: style.paddingLeft,
                right: style.paddingRight,
                top: style.paddingTop,
            };
        }),
    ).toEqual({ left: '12px', right: '16px', top: '20px' });
});

test('keeps the desktop navigation visually above content while preserving DOM order', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.evaluate(() => {
        document.documentElement.style.setProperty(
            '--farm-safe-area-bottom',
            '24px',
        );
    });
    const component = await mount(
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <FarmAuthenticatedShellHarness />
        </AppRouterContext.Provider>,
    );
    const navigationElement = visibleNavigation(component);
    const content = component.locator('[data-farm-shell-content]');
    const navigationBounds = await navigationElement.boundingBox();
    const contentBounds = await content.boundingBox();

    expect(navigationBounds).not.toBeNull();
    expect(contentBounds).not.toBeNull();
    if (!navigationBounds || !contentBounds) {
        throw new Error('Expected desktop shell regions to render.');
    }

    expect(navigationBounds.y + navigationBounds.height).toBeLessThanOrEqual(
        contentBounds.y,
    );
    await expect(content).toHaveCSS('padding-bottom', '24px');
});

test('does not remount or recount Today when authentication resolves', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(phoneViewports[0]);
    await page.route('**/api/gredice/api/notifications**', async (route) => {
        await route.fulfill({ json: [], status: 200 });
    });
    const component = await mount(
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <FarmShellAuthTransitionHarness />
        </AppRouterContext.Provider>,
    );
    const mountProbe = component.locator('[data-today-mount-marker]');
    const viewCount = component.locator('[data-today-view-count]');

    await expect(mountProbe).toBeVisible();
    await expect(viewCount).toHaveText('1');
    const mountMarker = await mountProbe.getAttribute(
        'data-today-mount-marker',
    );
    await page.waitForFunction(
        () => typeof window.__resolveFarmShellAuth === 'function',
    );
    await page.evaluate(() => window.__resolveFarmShellAuth?.());
    await expect(visibleNavigation(component)).toBeVisible();

    await expect(mountProbe).toHaveAttribute(
        'data-today-mount-marker',
        mountMarker ?? '',
    );
    await expect(viewCount).toHaveText('1');
});

test('keeps the farm shell hidden from signed-in users without a farm role', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(phoneViewports[0]);
    const component = await mount(
        <AppRouterContext.Provider value={nextNavigationRouter}>
            <FarmShellAuthTransitionHarness userRole="customer" />
        </AppRouterContext.Provider>,
    );

    await page.waitForFunction(
        () => typeof window.__resolveFarmShellAuth === 'function',
    );
    await page.evaluate(() => window.__resolveFarmShellAuth?.());
    await expect(component.locator('[data-auth-resolution]')).toHaveText(
        'resolved',
    );
    await expect(visibleNavigation(component)).toHaveCount(0);
});
