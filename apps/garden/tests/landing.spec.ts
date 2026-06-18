import { type ConsoleMessage, expect, type Page, test } from '@playwright/test';

const currentUser = {
    avatarUrl: null,
    birthday: null,
    birthdayLastRewardAt: null,
    birthdayLastUpdatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    displayName: 'Test User',
    email: 'test@example.com',
    id: 'test-user',
    isTemporary: false,
    userName: 'test-user',
};

const temporaryUser = {
    ...currentUser,
    displayName: 'Mali Suncokret 4821',
    id: 'temporary-user',
    isTemporary: true,
    userName: 'Mali Suncokret 4821',
};

const sandboxGarden = {
    backgroundPalette: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    farmId: 1,
    id: 1,
    isSandbox: true,
    latitude: 45.739,
    longitude: 16.572,
    name: 'Vrt za igru',
    raisedBeds: [],
    stacks: {
        '0': {
            '0': [
                {
                    id: 'block-1',
                    name: 'Block_Grass',
                    rotation: 0,
                },
            ],
        },
    },
};

const adventCalendar = {
    calendarId: 'calendar-2025',
    days: Array.from({ length: 24 }, (_, index) => ({
        day: index + 1,
        opened: false,
    })),
    description: '',
    nextDay: 1,
    openedCount: 0,
    remaining: 24,
    totalDays: 24,
    year: 2025,
};

const tutorialChecklist = {
    groups: [],
    totals: {
        availableSunflowers: 0,
        claimableCount: 0,
        completedCount: 0,
        earnedSunflowers: 0,
        totalCount: 0,
    },
};

const crashPatterns = [
    /Maximum update depth exceeded/u,
    /The result of getSnapshot should be cached/u,
    /Hydration failed/u,
    /There was an error while hydrating/u,
    /Minified React error/u,
];

function shouldFailOnConsoleMessage(message: ConsoleMessage) {
    const text = message.text();
    return crashPatterns.some((pattern) => pattern.test(text));
}

function collectRuntimeFailures(page: Page) {
    const failures: string[] = [];

    page.on('pageerror', (error) => {
        failures.push(`pageerror: ${error.message}`);
    });
    page.on('console', (message) => {
        if (shouldFailOnConsoleMessage(message)) {
            failures.push(`console.${message.type()}: ${message.text()}`);
        }
    });

    return failures;
}

async function mockGardenApi(page: Page, signedIn: boolean) {
    let sessionUser: typeof currentUser | typeof temporaryUser | null = signedIn
        ? currentUser
        : null;

    await page.route('**/api/gredice/**', async (route) => {
        const { pathname } = new URL(route.request().url());
        let body: unknown;
        let status = 200;

        if (pathname.endsWith('/api/auth/temporary')) {
            sessionUser = temporaryUser;
            body = temporaryUser;
            status = 201;
        } else if (pathname.endsWith('/api/auth/current-claims')) {
            body = sessionUser;
        } else if (pathname.endsWith('/api/auth/last-login')) {
            body = {};
        } else if (pathname.endsWith('/api/users/current')) {
            body = sessionUser;
        } else if (pathname.endsWith('/api/gardens')) {
            body = sessionUser ? [sandboxGarden] : null;
        } else if (pathname.endsWith('/api/gardens/1')) {
            body = sandboxGarden;
        } else if (pathname.endsWith('/api/gardens/1/operations')) {
            body = { items: [], nextCursor: null, total: 0 };
        } else if (pathname.endsWith('/api/accounts/gardens')) {
            body = sessionUser
                ? [
                      {
                          accountId: 'test-account',
                          name: 'test@example.com račun',
                          isCurrent: true,
                          gardens: [],
                      },
                  ]
                : null;
        } else if (pathname.includes('/api/directories/entities/')) {
            body = [];
        } else if (pathname.endsWith('/api/data/weather/now')) {
            body = {
                cloudy: 0,
                foggy: 0,
                measuredTemperature: null,
                rain: 0,
                rainy: 0,
                snowAccumulation: 0,
                symbol: null,
                temperature: 20,
                windDirection: null,
                windSpeed: 0,
            };
        } else if (pathname.endsWith('/api/data/weather/history/range')) {
            body = { from: null, to: null };
        } else if (pathname.endsWith('/api/data/weather/history')) {
            body = [];
        } else if (pathname.endsWith('/api/data/weather')) {
            body = [];
        } else if (pathname.endsWith('/api/news/changelog')) {
            body = { items: [] };
        } else if (
            pathname.endsWith('/api/accounts/current/sunflowers/daily')
        ) {
            body = {
                current: { amount: 0, day: 1 },
                next: { amount: 1, day: 2 },
            };
        } else if (
            pathname.includes('/api/accounts/current/sunflowers/drops/gardens/')
        ) {
            body = null;
        } else if (pathname.endsWith('/api/occasions/advent/calendar-2025')) {
            body = adventCalendar;
        } else if (pathname.endsWith('/api/accounts/current/sunflowers')) {
            body = { amount: 0 };
        } else if (
            pathname.endsWith('/api/accounts/current/tutorial-checklist')
        ) {
            body = tutorialChecklist;
        } else if (pathname.endsWith('/api/accounts/current')) {
            body = signedIn
                ? { id: 'test-account', name: 'Test Account' }
                : null;
        } else if (pathname.endsWith('/api/shopping-cart')) {
            body = {
                hasDeliverableItems: false,
                id: 'test-cart',
                items: [],
                total: 0,
                totalSunflowers: 0,
            };
        } else if (pathname.endsWith('/api/inventory')) {
            body = { items: [] };
        } else if (pathname.endsWith('/api/outlet/offers')) {
            body = { items: [] };
        } else if (pathname.endsWith('/api/notifications/preferences')) {
            body = { preferences: [] };
        } else if (pathname.endsWith('/api/notifications/devices')) {
            body = { devices: [] };
        } else if (pathname.endsWith('/api/notifications/push-status')) {
            body = { hasDevices: false, status: 'unsubscribed' };
        } else if (pathname.endsWith('/api/notifications')) {
            body = [];
        }

        if (body === undefined) {
            throw new Error(`Unexpected garden API request: ${pathname}`);
        }

        await route.fulfill({
            body: JSON.stringify(body),
            contentType: 'application/json',
            status,
        });
    });
}

async function expectNoImmediateRuntimeFailures(
    page: Page,
    failures: string[],
) {
    await page.waitForTimeout(1000);
    expect(failures).toEqual([]);
}

test('signed-out landing creates a temporary account and shows the playable HUD', async ({
    page,
}) => {
    const failures = collectRuntimeFailures(page);
    await mockGardenApi(page, false);

    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/Gredice/);
    await expect(page.getByTitle(/zvuk/u)).toBeVisible({ timeout: 15_000 });
    await expect(
        page.getByRole('button', { name: 'Prijava' }).first(),
    ).toBeHidden();
    await expectNoImmediateRuntimeFailures(page, failures);
});

test('loads signed-in landing page HUD without immediate runtime failures', async ({
    page,
}) => {
    const failures = collectRuntimeFailures(page);
    await mockGardenApi(page, true);

    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/Gredice/);
    await expect(page.getByTitle(/zvuk/u)).toBeVisible({ timeout: 15_000 });
    await expectNoImmediateRuntimeFailures(page, failures);
});
