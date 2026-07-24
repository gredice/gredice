import { expect, test } from '@playwright/experimental-ct-react';
import {
    DefaultGardenMutationGateStory,
    DefaultGardenSelectionGateStory,
    GardenAccountMenuItemsStory,
    PostStartupCrossAccountSelectionStory,
    SandboxFirstGardenAccountMenuItemsStory,
    SingleRealGardenAccountMenuItemsStory,
} from './GardenAccountMenuItemsStory';

const accountGroupsWithOtherDefault = [
    {
        accountId: 'test-account',
        name: 'test@example.com račun',
        isCurrent: true,
        gardens: [
            {
                id: 1,
                name: 'Test',
                isDefault: false,
                isSandbox: false,
                createdAt: '2026-06-01T00:00:00.000Z',
            },
            {
                id: 2,
                name: 'Vrt za igru 1',
                isDefault: false,
                isSandbox: true,
                createdAt: '2026-06-01T00:00:00.000Z',
            },
        ],
    },
    {
        accountId: 'other-account',
        name: 'other@example.com račun',
        isCurrent: false,
        gardens: [
            {
                id: 3,
                name: 'Drugi vrt',
                isDefault: true,
                isSandbox: false,
                createdAt: '2026-06-01T00:00:00.000Z',
            },
        ],
    },
];

const accountGroupsWithCurrentDefault = accountGroupsWithOtherDefault.map(
    (group) => ({
        ...group,
        gardens: group.gardens.map((garden) => ({
            ...garden,
            isDefault: garden.id === 1,
        })),
    }),
);

const otherAccountGardenList = [
    {
        id: 3,
        name: 'Drugi vrt',
        isSandbox: false,
        createdAt: '2026-06-01T00:00:00.000Z',
    },
];

const otherAccountGardenDetail = {
    id: 3,
    name: 'Drugi vrt',
    isSandbox: false,
    isPublic: false,
    backgroundPalette: 'current',
    homeCamera: null,
    farmId: null,
    latitude: 45.739,
    longitude: 16.572,
    previewImage: null,
    previewSourceRevision: null,
    stacks: {},
    raisedBeds: [],
};

test.describe('Garden account menu items', () => {
    test('switches gardens in both directions before account queries refresh', async ({
        mount,
        page,
    }) => {
        const accountSwitchRequests: string[] = [];
        await page.route(
            '**/api/gredice/api/accounts/switch',
            async (route) => {
                accountSwitchRequests.push(route.request().postData() ?? '');
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        accountId: 'other-account',
                    }),
                });
            },
        );
        await mount(<GardenAccountMenuItemsStory />);

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();
        await page
            .getByRole('menuitem', { name: 'Drugi vrt', exact: true })
            .click();

        await expect(page.getByTestId('selected-garden-id')).toHaveText('3', {
            timeout: 1_000,
        });

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();
        await page.getByRole('menuitem', { name: 'Test', exact: true }).click();

        await expect(page.getByTestId('selected-garden-id')).toHaveText('1', {
            timeout: 1_000,
        });
        expect(accountSwitchRequests).toEqual([
            JSON.stringify({ accountId: 'other-account' }),
            JSON.stringify({ accountId: 'test-account' }),
        ]);
    });

    test('shows sandbox gardens inline on mobile', async ({ mount, page }) => {
        await page.setViewportSize({ width: 600, height: 800 });
        await mount(<GardenAccountMenuItemsStory />);

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();

        await expect(page.getByText('Vrtovi za igru')).toBeVisible();
        await expect(page.getByText('Vrt za igru 1')).toBeVisible();
        await expect(
            page.getByRole('menuitem', { name: /Računi/ }),
        ).toHaveAttribute('href', '/racun/naplata');
        await expect(page.getByText('Kreiraj vrt za igru')).toBeVisible();

        const sandboxGardenBox = await page
            .getByText('Vrt za igru 1')
            .boundingBox();
        expect(sandboxGardenBox).not.toBeNull();
        expect(
            (sandboxGardenBox?.x ?? 0) + (sandboxGardenBox?.width ?? 0),
        ).toBeLessThanOrEqual(600);
    });

    test('switches from a raw-first sandbox to a real garden', async ({
        mount,
        page,
    }) => {
        await mount(<SandboxFirstGardenAccountMenuItemsStory />);

        await expect(page.getByTestId('current-garden-id')).toHaveText('2');
        await expect(page.getByTestId('current-garden-kind')).toHaveText(
            'sandbox',
        );

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();
        await page.getByRole('menuitem', { name: /^Test$/ }).click();

        await expect(page.getByTestId('selected-garden-id')).toHaveText('1');
        await expect(page.getByTestId('current-garden-id')).toHaveText('1');
        await expect(page.getByTestId('current-garden-kind')).toHaveText(
            'real',
        );
    });

    test('switches from a sandbox to a real garden on another account', async ({
        mount,
        page,
    }) => {
        const accountSwitchRequests: string[] = [];
        const gardenDetailRequests: string[] = [];
        let completeAccountSwitch: () => void = () => undefined;
        const accountSwitchCanComplete = new Promise<void>((resolve) => {
            completeAccountSwitch = resolve;
        });
        await page.route(
            '**/api/gredice/api/accounts/switch',
            async (route) => {
                accountSwitchRequests.push(route.request().postData() ?? '');
                await accountSwitchCanComplete;
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        accountId: 'other-account',
                    }),
                });
            },
        );
        await page.route('**/api/gredice/api/gardens/3', async (route) => {
            gardenDetailRequests.push(route.request().url());
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(otherAccountGardenDetail),
            });
        });
        await page.route('**/api/gredice/api/gardens', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(otherAccountGardenList),
            });
        });
        await mount(<SandboxFirstGardenAccountMenuItemsStory />);

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();
        await page
            .getByRole('menuitem', { name: 'Drugi vrt', exact: true })
            .click();

        await expect.poll(() => accountSwitchRequests.length).toBe(1);
        await expect(page.getByTestId('selected-garden-id')).toHaveText('2');
        await expect(page.getByTestId('current-garden-id')).toHaveText('2');
        expect(gardenDetailRequests).toEqual([]);

        completeAccountSwitch();

        await expect(page.getByTestId('selected-garden-id')).toHaveText('3');
        await expect(page.getByTestId('current-garden-id')).toHaveText('3');
        await expect(page.getByTestId('current-garden-kind')).toHaveText(
            'real',
        );
        await expect.poll(() => gardenDetailRequests.length).toBe(1);
        expect(accountSwitchRequests).toEqual([
            JSON.stringify({ accountId: 'other-account' }),
        ]);
    });

    test('marks only real gardens as default without switching gardens', async ({
        mount,
        page,
    }) => {
        const defaultGardenRequests: string[] = [];
        const accountSwitchRequests: string[] = [];
        await page.route(
            '**/api/gredice/api/accounts/gardens/default',
            async (route) => {
                defaultGardenRequests.push(route.request().postData() ?? '');
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        accountId: 'other-account',
                        gardenId: 3,
                    }),
                });
            },
        );
        await page.route(
            '**/api/gredice/api/accounts/gardens',
            async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify(accountGroupsWithOtherDefault),
                });
            },
        );
        await page.route(
            '**/api/gredice/api/accounts/switch',
            async (route) => {
                accountSwitchRequests.push(route.request().postData() ?? '');
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        accountId: 'other-account',
                    }),
                });
            },
        );
        await mount(<SandboxFirstGardenAccountMenuItemsStory />);

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();
        await expect(
            page.getByTitle('Postavi Test kao zadani vrt'),
        ).toBeVisible();
        await expect(
            page.getByTitle('Postavi Drugi vrt kao zadani vrt'),
        ).toBeVisible();
        await expect(
            page.getByTitle(/Postavi Vrt za igru 1 kao zadani vrt/),
        ).toHaveCount(0);

        await page.getByTitle('Postavi Drugi vrt kao zadani vrt').click();

        await expect
            .poll(() => defaultGardenRequests)
            .toEqual([JSON.stringify({ gardenId: 3 })]);
        expect(accountSwitchRequests).toEqual([]);
        await expect(page.getByTestId('selected-garden-id')).toHaveText('2');
        await expect(page.getByTestId('current-garden-id')).toHaveText('2');
        await expect(
            page.getByTitle('Drugi vrt je zadani vrt'),
        ).toHaveAttribute('data-default-garden', 'true');
    });

    test('reaches a default-garden action with menu keyboard navigation', async ({
        mount,
        page,
    }) => {
        const defaultGardenRequests: string[] = [];
        await page.route(
            '**/api/gredice/api/accounts/gardens/default',
            async (route) => {
                defaultGardenRequests.push(route.request().postData() ?? '');
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        accountId: 'test-account',
                        gardenId: 1,
                    }),
                });
            },
        );
        await page.route(
            '**/api/gredice/api/accounts/gardens',
            async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify(accountGroupsWithCurrentDefault),
                });
            },
        );
        await mount(<GardenAccountMenuItemsStory />);

        const trigger = page.getByRole('button', {
            name: 'Otvori izbornik',
        });
        await trigger.focus();
        await page.keyboard.press('Enter');
        await expect(
            page.getByRole('menuitem', { name: 'Test', exact: true }),
        ).toBeFocused();

        await page.keyboard.press('ArrowDown');
        await expect(
            page.getByTitle('Postavi Test kao zadani vrt'),
        ).toBeFocused();
        await page.keyboard.press('Enter');

        await expect
            .poll(() => defaultGardenRequests)
            .toEqual([JSON.stringify({ gardenId: 1 })]);
    });

    test('keeps the current garden open while changing the default', async ({
        mount,
        page,
    }) => {
        const defaultGardenRequests: string[] = [];
        const accountSwitchRequests: string[] = [];
        await page.route(
            '**/api/gredice/api/accounts/gardens/default',
            async (route) => {
                defaultGardenRequests.push(route.request().postData() ?? '');
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        accountId: 'other-account',
                        gardenId: 3,
                    }),
                });
            },
        );
        await page.route(
            '**/api/gredice/api/accounts/gardens',
            async (route) => {
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify(accountGroupsWithOtherDefault),
                });
            },
        );
        await page.route(
            '**/api/gredice/api/accounts/switch',
            async (route) => {
                accountSwitchRequests.push(route.request().postData() ?? '');
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        accountId: 'other-account',
                    }),
                });
            },
        );

        await mount(<DefaultGardenMutationGateStory />);
        await expect(page.getByTestId('selected-garden-id')).toHaveText(
            'default',
        );
        await expect(page.getByTestId('current-garden-id')).toHaveText('1');

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();
        await page.getByTitle('Postavi Drugi vrt kao zadani vrt').click();

        await expect(page.getByTestId('selected-garden-id')).toHaveText('1');
        await expect(page.getByTestId('current-garden-id')).toHaveText('1');
        await expect
            .poll(() => defaultGardenRequests)
            .toEqual([JSON.stringify({ gardenId: 3 })]);
        expect(accountSwitchRequests).toEqual([]);
    });

    test('hides default controls when only one real garden is accessible', async ({
        mount,
        page,
    }) => {
        await mount(<SingleRealGardenAccountMenuItemsStory />);

        await page.getByRole('button', { name: 'Otvori izbornik' }).click();

        await expect(page.getByTitle(/zadani vrt/)).toHaveCount(0);
    });

    test('switches accounts before opening a cross-account default garden', async ({
        mount,
        page,
    }) => {
        const accountSwitchRequests: string[] = [];
        const gardenDetailRequests: string[] = [];
        let completeAccountSwitch: () => void = () => undefined;
        const accountSwitchCanComplete = new Promise<void>((resolve) => {
            completeAccountSwitch = resolve;
        });
        let completeGardenListRefresh: () => void = () => undefined;
        const gardenListRefreshCanComplete = new Promise<void>((resolve) => {
            completeGardenListRefresh = resolve;
        });
        await page.route(
            '**/api/gredice/api/accounts/switch',
            async (route) => {
                accountSwitchRequests.push(route.request().postData() ?? '');
                await accountSwitchCanComplete;
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        accountId: 'other-account',
                    }),
                });
            },
        );
        await page.route('**/api/gredice/api/gardens/3', async (route) => {
            gardenDetailRequests.push(route.request().url());
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(otherAccountGardenDetail),
            });
        });
        await page.route('**/api/gredice/api/gardens', async (route) => {
            await gardenListRefreshCanComplete;
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(otherAccountGardenList),
            });
        });

        await mount(<DefaultGardenSelectionGateStory />);

        await expect.poll(() => accountSwitchRequests.length).toBe(1);
        await expect(page.getByTestId('default-garden-ready')).toHaveCount(0);
        expect(gardenDetailRequests).toEqual([]);

        completeAccountSwitch();

        await expect(page.getByTestId('default-garden-ready')).toBeVisible();
        await expect(page.getByTestId('current-garden-id')).toHaveText('3');
        await expect.poll(() => gardenDetailRequests.length).toBe(1);
        completeGardenListRefresh();
        expect(accountSwitchRequests).toEqual([
            JSON.stringify({ accountId: 'other-account' }),
        ]);
    });

    test('switches accounts after a post-startup cross-account URL change', async ({
        mount,
        page,
    }) => {
        const accountSwitchRequests: string[] = [];
        const gardenDetailRequests: string[] = [];
        let completeAccountSwitch: () => void = () => undefined;
        const accountSwitchCanComplete = new Promise<void>((resolve) => {
            completeAccountSwitch = resolve;
        });
        await page.route(
            '**/api/gredice/api/accounts/switch',
            async (route) => {
                accountSwitchRequests.push(route.request().postData() ?? '');
                await accountSwitchCanComplete;
                await route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        success: true,
                        accountId: 'other-account',
                    }),
                });
            },
        );
        await page.route('**/api/gredice/api/gardens/3', async (route) => {
            gardenDetailRequests.push(route.request().url());
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(otherAccountGardenDetail),
            });
        });
        await page.route('**/api/gredice/api/gardens', async (route) => {
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(otherAccountGardenList),
            });
        });

        await mount(<PostStartupCrossAccountSelectionStory />);
        await expect(
            page.getByTestId('post-startup-selection-ready'),
        ).toBeVisible();
        await expect(page.getByTestId('current-garden-id')).toHaveText('1');

        await page
            .getByRole('button', { name: 'Otvori drugi vrt putem URL-a' })
            .click();

        await expect.poll(() => accountSwitchRequests.length).toBe(1);
        await expect(
            page.getByTestId('post-startup-selection-ready'),
        ).toHaveCount(0);
        expect(gardenDetailRequests).toEqual([]);

        completeAccountSwitch();

        await expect(
            page.getByTestId('post-startup-selection-ready'),
        ).toBeVisible();
        await expect(page.getByTestId('selected-garden-id')).toHaveText('3');
        await expect(page.getByTestId('current-garden-id')).toHaveText('3');
        await expect.poll(() => gardenDetailRequests.length).toBe(1);
        expect(accountSwitchRequests).toEqual([
            JSON.stringify({ accountId: 'other-account' }),
        ]);
    });
});
