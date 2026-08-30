import { type ConsoleMessage, expect, type Page, test } from '@playwright/test';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { returningUserStorageKey } from '../lib/auth/returningUser';

type GardenRenderProbeWindow = Window & {
    __gardenWebglContextRequests?: number;
};

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

const gardenOverviewListItem = {
    createdAt: '2026-07-01T00:00:00.000Z',
    id: 1,
    isSandbox: false,
    name: 'Testni vrt',
};

const gardenOverviewDetail = {
    ...gardenOverviewListItem,
    backgroundPalette: 'current',
    farmId: 1,
    homeCamera: null,
    isPublic: false,
    latitude: 45.739,
    longitude: 16.572,
    previewImage: null,
    previewSourceRevision: null,
    raisedBeds: [
        {
            abandonReason: null,
            appliedOperations: [],
            blockId: 'raised-bed-primary',
            createdAt: '2026-07-01T00:00:00.000Z',
            fields: [],
            id: 10,
            isValid: true,
            name: 'Testna gredica',
            orientation: 'vertical',
            physicalId: null,
            status: 'active',
            updatedAt: '2026-07-01T00:00:00.000Z',
            weedState: null,
        },
    ],
    structures: [],
    stacks: {
        '0': {
            '0': [
                {
                    id: 'grass-0-0',
                    name: 'Block_Grass',
                    rotation: 0,
                },
                {
                    id: 'raised-bed-primary',
                    name: 'Raised_Bed',
                    rotation: 0,
                },
            ],
            '1': [
                {
                    id: 'grass-0-1',
                    name: 'Block_Grass',
                    rotation: 0,
                },
                {
                    id: 'raised-bed-secondary',
                    name: 'Raised_Bed',
                    rotation: 0,
                },
            ],
        },
        '2': {
            '-1': [
                {
                    id: 'grass-2--1',
                    name: 'Block_Grass',
                    rotation: 0,
                },
                {
                    id: 'tree-2--1',
                    name: 'Tree',
                    rotation: 0,
                },
            ],
        },
    },
    updatedAt: '2026-07-01T00:00:00.000Z',
};

const onboardingPlantSorts = [
    [206, 'Rajčica', 'Rajčica saint pierre'],
    [216, 'Paprika', 'Paprika crvena roga'],
    [226, 'Krastavac', 'Krastavac pariški kornišon'],
    [230, 'Mrkva', 'Mrkva nantes'],
    [284, 'Špinat', 'Špinat matador'],
    [357, 'Salata', 'Salata vegorka'],
    [373, 'Luk', 'Luk Stuttgarter'],
    [353, 'Brokula', 'Brokula gea F1'],
].map(([id, plantName, sortName]) => ({
    id,
    information: {
        name: sortName,
        plant: {
            id: Number(id) + 10_000,
            information: { name: plantName },
            relationships: null,
        },
    },
    store: { availableInStore: true },
}));

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

async function mockGardenApi(
    page: Page,
    signedIn: boolean,
    {
        malformedCurrentClaims = false,
        returningUser = false,
        withBlockData = false,
        withGarden = false,
        withTemporaryOnboarding = false,
    }: {
        malformedCurrentClaims?: boolean;
        returningUser?: boolean;
        withBlockData?: boolean;
        withGarden?: boolean;
        withTemporaryOnboarding?: boolean;
    } = {},
) {
    let sessionUser: typeof currentUser | typeof temporaryUser | null = signedIn
        ? currentUser
        : null;
    let shouldReturnMalformedCurrentClaims = malformedCurrentClaims;
    let temporaryAccountRequestCount = 0;
    let dailyRewardRequestCount = 0;

    await page.route('**/api/gredice/**', async (route) => {
        const { pathname } = new URL(route.request().url());
        let body: unknown;
        let status = 200;

        if (pathname.endsWith('/api/auth/temporary')) {
            temporaryAccountRequestCount += 1;
            sessionUser = temporaryUser;
            body = temporaryUser;
            status = 201;
        } else if (pathname.endsWith('/api/auth/login')) {
            sessionUser = currentUser;
            body = { refreshToken: 'refresh-token', token: 'access-token' };
        } else if (pathname.endsWith('/api/auth/current-claims')) {
            if (shouldReturnMalformedCurrentClaims) {
                shouldReturnMalformedCurrentClaims = false;
                body = {};
            } else if (sessionUser) {
                body = sessionUser;
            } else {
                body = { error: 'Unauthorized', returningUser };
                status = 401;
            }
        } else if (pathname.endsWith('/api/auth/last-login')) {
            body = {};
        } else if (pathname.endsWith('/api/users/current')) {
            body = sessionUser;
        } else if (
            (withGarden || sessionUser?.isTemporary) &&
            pathname.endsWith('/api/gardens/1/operations')
        ) {
            body = { items: [], nextCursor: null, total: 0 };
        } else if (/\/api\/gardens\/\d+\/operations$/u.test(pathname)) {
            body = { items: [], nextCursor: null, total: 0 };
        } else if (
            (withGarden || sessionUser?.isTemporary) &&
            pathname.endsWith('/api/gardens/1/raised-bed-notifications')
        ) {
            body = { notifications: [] };
        } else if (
            (withGarden || sessionUser?.isTemporary) &&
            pathname.endsWith('/api/gardens/1/raised-beds/10/ai-history')
        ) {
            body = [];
        } else if (
            (withGarden || sessionUser?.isTemporary) &&
            pathname.endsWith('/api/gardens/1/raised-beds/10/sensors')
        ) {
            body = [];
        } else if (pathname.endsWith('/api/gardens/1')) {
            body = sessionUser?.isTemporary
                ? withTemporaryOnboarding
                    ? gardenOverviewDetail
                    : sandboxGarden
                : withGarden
                  ? gardenOverviewDetail
                  : undefined;
        } else if (pathname.endsWith('/api/gardens')) {
            body = sessionUser
                ? sessionUser.isTemporary
                    ? [
                          withTemporaryOnboarding
                              ? gardenOverviewListItem
                              : sandboxGarden,
                      ]
                    : withGarden
                      ? [gardenOverviewListItem]
                      : []
                : null;
        } else if (pathname.endsWith('/api/accounts/gardens')) {
            body = sessionUser
                ? [
                      {
                          accountId: 'test-account',
                          name: 'test@example.com račun',
                          isCurrent: true,
                          gardens: withGarden
                              ? [
                                    {
                                        ...gardenOverviewListItem,
                                        isDefault: true,
                                    },
                                ]
                              : [],
                      },
                  ]
                : null;
        } else if (pathname.endsWith('/entities/plantSort')) {
            body = onboardingPlantSorts;
        } else if (pathname.includes('/api/directories/entities/')) {
            body =
                withBlockData && pathname.endsWith('/entities/block')
                    ? getLocalSandboxBlockData()
                    : [];
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
            dailyRewardRequestCount += 1;
            body = {
                canClaim: Boolean(sessionUser?.isTemporary),
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
            body = sessionUser
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
        } else if (
            /\/api\/gardens\/\d+\/raised-bed-notifications$/u.test(pathname)
        ) {
            body = { notifications: [] };
        } else if (pathname.endsWith('/detailed-inspection-reports')) {
            body = { reports: [] };
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

    return {
        getDailyRewardRequestCount: () => dailyRewardRequestCount,
        getTemporaryAccountRequestCount: () => temporaryAccountRequestCount,
    };
}

async function expectNoImmediateRuntimeFailures(
    page: Page,
    failures: string[],
) {
    await page.waitForTimeout(1000);
    expect(failures).toEqual([]);
}

const safeAreaInsets = {
    bottom: 24,
    left: 12,
    right: 12,
    top: 32,
};

async function emulateSafeArea(page: Page) {
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setSafeAreaInsetsOverride', {
        insets: {
            bottom: safeAreaInsets.bottom,
            bottomMax: safeAreaInsets.bottom,
            left: safeAreaInsets.left,
            leftMax: safeAreaInsets.left,
            right: safeAreaInsets.right,
            rightMax: safeAreaInsets.right,
            top: safeAreaInsets.top,
            topMax: safeAreaInsets.top,
        },
    });
}

test('guest explicitly starts a temporary garden with separate login HUD and no welcome reward', async ({
    page,
}) => {
    test.setTimeout(20_000);
    const failures = collectRuntimeFailures(page);
    await page.setViewportSize({ height: 844, width: 390 });
    await emulateSafeArea(page);
    const api = await mockGardenApi(page, false, {
        withTemporaryOnboarding: true,
    });

    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/Gredice/);
    const initialLogin = page.getByRole('dialog', { name: 'Prijava' });
    await expect(initialLogin).toBeVisible();
    await expect(initialLogin).not.toContainText('privremenim vrtom');
    expect(api.getTemporaryAccountRequestCount()).toBe(0);
    const guestAction = initialLogin.getByRole('button', {
        name: 'Nastavi kao gost',
    });
    const emailAction = initialLogin.getByRole('button', {
        name: 'Nastavi s emailom',
    });
    await expect(guestAction).toBeVisible();
    await expect(guestAction.locator('svg')).toHaveCount(1);
    const [guestActionBounds, emailActionBounds] = await Promise.all([
        guestAction.boundingBox(),
        emailAction.boundingBox(),
    ]);
    if (!guestActionBounds || !emailActionBounds) {
        throw new Error('Expected guest and email action bounds');
    }
    expect(guestActionBounds.y).toBeLessThan(emailActionBounds.y);
    expect(guestActionBounds.height).toBeGreaterThan(emailActionBounds.height);
    await guestAction.click();
    await expect(page.getByTitle(/zvuk/u)).toBeVisible({ timeout: 15_000 });
    const loginHud = page.locator('[data-game-hud-temporary-auth="true"]');
    const loginButton = loginHud.getByRole('button', {
        name: 'Prijava ili registracija',
    });
    await expect(loginHud).toBeVisible();
    await expect(loginButton).toBeVisible();
    await expect(
        page
            .locator('[data-game-hud-top-left]')
            .getByRole('button', { name: 'Prijava ili registracija' }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('dialog', { name: 'Brzi plan gredice' }),
    ).toBeVisible();
    await expect(page.getByText('Kreni u avanturu')).toHaveCount(0);
    expect(api.getDailyRewardRequestCount()).toBe(0);
    expect(api.getTemporaryAccountRequestCount()).toBe(1);
    await expect(page.locator('link[rel="manifest"]').first()).toHaveAttribute(
        'href',
        '/manifest.json',
    );
    await expect(
        page.locator('meta[name="apple-mobile-web-app-title"]').first(),
    ).toHaveAttribute('content', 'Gredice');

    await loginButton.click();
    await expect(
        page.getByRole('dialog', { name: 'Prijava u postojeći vrt' }),
    ).toBeVisible();
    await expect(loginHud).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(loginButton).toBeVisible();
    await expectNoImmediateRuntimeFailures(page, failures);
});

test('rejects malformed current claims before creating a temporary account', async ({
    page,
}) => {
    const api = await mockGardenApi(page, false, {
        malformedCurrentClaims: true,
    });

    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    const loginDialog = page.getByRole('dialog', { name: 'Prijava' });
    await expect(loginDialog).toBeVisible();
    expect(api.getTemporaryAccountRequestCount()).toBe(0);
    await loginDialog.getByRole('button', { name: 'Nastavi kao gost' }).click();
    await expect(
        page.getByRole('button', { name: 'Prijava ili registracija' }),
    ).toBeVisible({ timeout: 15_000 });
    expect(api.getTemporaryAccountRequestCount()).toBe(1);
    expect(
        await page.evaluate((storageKey) => {
            return window.localStorage.getItem(storageKey);
        }, returningUserStorageKey),
    ).toBeNull();
});

test('fresh signed-out visitor can log in without creating a temporary account', async ({
    page,
}) => {
    test.setTimeout(20_000);
    const api = await mockGardenApi(page, false);

    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    const loginDialog = page.getByRole('dialog', { name: 'Prijava' });
    await expect(loginDialog).toBeVisible();
    expect(api.getTemporaryAccountRequestCount()).toBe(0);

    await loginDialog
        .getByRole('button', { name: 'Nastavi s emailom' })
        .click();
    await loginDialog.getByLabel('Email').fill('vrtlar@example.com');
    await loginDialog.getByLabel('Zaporka').fill('sigurna-zaporka');
    await loginDialog.getByRole('button', { name: 'Prijava' }).click();

    await expect(page.getByTitle(/zvuk/u)).toBeVisible({ timeout: 15_000 });
    expect(api.getTemporaryAccountRequestCount()).toBe(0);
});

test('opens and clears a cross-app temporary login request from the URL', async ({
    page,
}) => {
    await mockGardenApi(page, false);

    const response = await page.goto('/?prijava=1');

    expect(response?.ok()).toBe(true);
    await expect(
        page.getByRole('dialog', { name: 'Prijava u postojeći vrt' }),
    ).toBeVisible();
    await page
        .getByRole('dialog', { name: 'Prijava u postojeći vrt' })
        .getByRole('button', { name: 'Zatvori' })
        .click();
    await expect(page).toHaveURL('/');
});

test('returning user with an expired session sees simplified login choices before a temporary garden is created', async ({
    page,
}) => {
    test.setTimeout(20_000);
    const api = await mockGardenApi(page, false, { returningUser: true });

    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('dialog', { name: 'Prijava' })).toBeVisible();
    await expect(
        page.getByRole('dialog', { name: 'Prijava' }),
    ).not.toContainText('privremenim vrtom');
    await expect(page.getByText(/prepoznali smo ovaj uređaj/iu)).toHaveCount(0);
    expect(api.getTemporaryAccountRequestCount()).toBe(0);
    expect(
        await page.evaluate((storageKey) => {
            return window.localStorage.getItem(storageKey);
        }, returningUserStorageKey),
    ).toBe('1');

    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();
    await page.getByLabel('Email').fill('vrtlar@example.com');
    await page.getByLabel('Zaporka').fill('sigurna-zaporka');
    await page.getByRole('button', { name: 'Prijava' }).click();
    await expect(page.getByTitle(/zvuk/u)).toBeVisible({ timeout: 15_000 });
    expect(api.getTemporaryAccountRequestCount()).toBe(0);
});

test('remembered returning user sees login even when the expired account cookie is unavailable', async ({
    page,
}) => {
    await page.addInitScript((storageKey) => {
        window.localStorage.setItem(storageKey, '1');
    }, returningUserStorageKey);
    const api = await mockGardenApi(page, false);

    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('dialog', { name: 'Prijava' })).toBeVisible();
    expect(api.getTemporaryAccountRequestCount()).toBe(0);

    await page.getByRole('button', { name: 'Nastavi kao gost' }).click();
    await expect.poll(() => api.getTemporaryAccountRequestCount()).toBe(1);
    await expect(page.getByTitle(/zvuk/u)).toBeVisible({ timeout: 15_000 });
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
    await expect(
        page.getByRole('button', { name: 'Prijava', exact: true }),
    ).toHaveCount(0);
    await expectNoImmediateRuntimeFailures(page, failures);
});

test('loads the signed-out React-only garden page behind the login prompt', async ({
    page,
}) => {
    const failures = collectRuntimeFailures(page);
    await mockGardenApi(page, false, { withBlockData: true });

    const response = await page.goto('/pregled-vrta');

    expect(response?.ok()).toBe(true);
    await expect(page.locator('[data-garden-renderer="2d"]')).toBeVisible();
    await expect(
        page
            .getByRole('dialog', { name: 'Prijava' })
            .getByRole('button', { name: 'Nastavi s emailom' }),
    ).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expectNoImmediateRuntimeFailures(page, failures);
});

test('opens the React-only garden page from the existing HUD', async ({
    context,
    page,
}) => {
    test.setTimeout(20_000);
    await context.addCookies([
        {
            domain: '127.0.0.1',
            name: 'gredice_impersonating',
            path: '/',
            value: '1',
        },
    ]);
    await mockGardenApi(page, true);

    const response = await page.goto('/?vrt=1');

    expect(response?.ok()).toBe(true);
    await expect(page.getByTitle('Profil')).toBeVisible({ timeout: 15_000 });
    await page.getByTitle('Profil').click();
    const overviewLink = page.getByRole('menuitem', {
        name: '2D prikaz vrta',
    });
    await expect(overviewLink).toHaveAttribute('href', '/pregled-vrta?vrt=1');
    await overviewLink.click();
    await expect(page).toHaveURL(/\/pregled-vrta\?vrt=1$/u);
    await expect(page.locator('[data-garden-renderer="2d"]')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
});

test('renders the shared HUD over a React-only 2D garden overview', async ({
    context,
    page,
}) => {
    test.setTimeout(20_000);
    const failures = collectRuntimeFailures(page);
    const modelRequests: string[] = [];
    let raisedBedNotificationRequestCount = 0;
    await page.setViewportSize({ height: 844, width: 390 });
    await page.addInitScript(() => {
        const probeWindow = window as GardenRenderProbeWindow;
        probeWindow.__gardenWebglContextRequests = 0;
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        const instrumentedGetContext = function (
            this: HTMLCanvasElement,
            contextId: string,
            ...args: unknown[]
        ) {
            if (contextId === 'webgl' || contextId === 'webgl2') {
                probeWindow.__gardenWebglContextRequests =
                    (probeWindow.__gardenWebglContextRequests ?? 0) + 1;
            }
            return Reflect.apply(originalGetContext, this, [
                contextId,
                ...args,
            ]);
        };
        HTMLCanvasElement.prototype.getContext =
            instrumentedGetContext as typeof originalGetContext;
    });
    page.on('request', (request) => {
        const { pathname } = new URL(request.url());
        if (pathname.endsWith('.glb')) {
            modelRequests.push(request.url());
        }
        if (pathname.endsWith('/api/gardens/1/raised-bed-notifications')) {
            raisedBedNotificationRequestCount += 1;
        }
    });
    await context.addCookies([
        {
            domain: '127.0.0.1',
            name: 'gredice_impersonating',
            path: '/',
            value: '1',
        },
    ]);
    await mockGardenApi(page, true, {
        withBlockData: true,
        withGarden: true,
    });

    const response = await page.goto('/pregled-vrta?vrt=1');

    expect(response?.ok()).toBe(true);
    await expect(page.locator('[data-garden-renderer="2d"]')).toBeVisible();
    await expect(
        page.getByRole('region', { name: 'Tlocrt vrta Testni vrt' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Otvori gredicu Testna gredica/u }),
    ).toBeVisible();
    await expect
        .poll(() => raisedBedNotificationRequestCount)
        .toBeGreaterThan(0);
    await expect(page.getByTitle('Profil')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByTitle(/zvuk/u)).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (window as GardenRenderProbeWindow)
                        .__gardenWebglContextRequests ?? 0,
            ),
        )
        .toBe(0);

    const overview = page.getByRole('region', {
        name: 'Tlocrt vrta Testni vrt',
    });
    const topDownBlockImages = overview.locator('img[src*="top-down"]');
    await expect(topDownBlockImages).toHaveCount(6);
    await expect
        .poll(() =>
            topDownBlockImages.evaluateAll((images) =>
                images.every(
                    (image) =>
                        image instanceof HTMLImageElement &&
                        image.complete &&
                        image.naturalWidth > 0,
                ),
            ),
        )
        .toBe(true);
    const overviewScrollport = page.locator('[data-garden-overview-2d]');
    await expect(overview).toHaveAttribute('data-preview-track-padding', '2');
    const initialScrollBounds = await overviewScrollport.boundingBox();
    const initialOverviewBounds = await overview.boundingBox();
    expect(initialScrollBounds).not.toBeNull();
    expect(initialOverviewBounds).not.toBeNull();
    expect(initialOverviewBounds?.x).toBeGreaterThanOrEqual(
        initialScrollBounds?.x ?? 0,
    );
    const horizontalScrollRange = await overviewScrollport.evaluate(
        (element) => {
            element.scrollLeft = element.scrollWidth - element.clientWidth;
            return element.scrollWidth - element.clientWidth;
        },
    );
    expect(horizontalScrollRange).toBeGreaterThan(0);
    const finalScrollBounds = await overviewScrollport.boundingBox();
    const finalOverviewBounds = await overview.boundingBox();
    expect(finalScrollBounds).not.toBeNull();
    expect(finalOverviewBounds).not.toBeNull();
    expect(
        (finalOverviewBounds?.x ?? 0) + (finalOverviewBounds?.width ?? 0),
    ).toBeLessThanOrEqual(
        (finalScrollBounds?.x ?? 0) + (finalScrollBounds?.width ?? 0) + 1,
    );

    const dragStartScrollLeft = await overviewScrollport.evaluate(
        (element, scrollRange) => {
            element.scrollLeft = scrollRange / 2;
            return element.scrollLeft;
        },
        horizontalScrollRange,
    );
    const panBounds = await overviewScrollport.boundingBox();
    expect(panBounds).not.toBeNull();
    const panStartX = (panBounds?.x ?? 0) + (panBounds?.width ?? 0) * 0.7;
    const panStartY = (panBounds?.y ?? 0) + (panBounds?.height ?? 0) * 0.7;
    await page.mouse.move(panStartX, panStartY);
    await page.mouse.down();
    await page.mouse.move(panStartX - 100, panStartY, { steps: 5 });
    await expect(overviewScrollport).toHaveAttribute('data-panning', 'true');
    await page.mouse.up();
    await expect
        .poll(() =>
            overviewScrollport.evaluate((element) => element.scrollLeft),
        )
        .toBeGreaterThan(dragStartScrollLeft + 60);
    await expect(overviewScrollport).toHaveAttribute('data-panning', 'false');

    const touchStartScrollLeft = await overviewScrollport.evaluate(
        (element, scrollRange) => {
            element.scrollLeft = scrollRange / 2;
            return element.scrollLeft;
        },
        horizontalScrollRange,
    );
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send('Input.dispatchTouchEvent', {
        touchPoints: [{ x: panStartX, y: panStartY }],
        type: 'touchStart',
    });
    await cdpSession.send('Input.dispatchTouchEvent', {
        touchPoints: [{ x: panStartX - 100, y: panStartY }],
        type: 'touchMove',
    });
    await expect(overviewScrollport).toHaveAttribute('data-panning', 'true');
    await cdpSession.send('Input.dispatchTouchEvent', {
        touchPoints: [],
        type: 'touchEnd',
    });
    await cdpSession.detach();
    await expect
        .poll(() =>
            overviewScrollport.evaluate((element) => element.scrollLeft),
        )
        .toBeGreaterThan(touchStartScrollLeft + 60);
    await expect(overviewScrollport).toHaveAttribute('data-panning', 'false');

    await expect(overview).toHaveAttribute('data-world-rotation', '0');
    await expect(
        overview.locator('img[src*="Raised_Bed_1"]').first(),
    ).toBeVisible();
    await page.getByTitle('Okreni desno').click();
    await expect(overview).toHaveAttribute('data-world-rotation', '1');
    await expect(
        overview.locator('img[src*="Raised_Bed_2"]').first(),
    ).toBeVisible();

    await page
        .getByRole('button', {
            name: 'Privremeno sakrij banner impersonacije',
        })
        .click();
    await page.getByTitle('Profil').click();
    await expect(
        page.getByRole('menuitem', { name: '3D prikaz vrta' }),
    ).toHaveAttribute('href', '/?vrt=1');

    await page.keyboard.press('Escape');
    await page
        .getByRole('button', { name: /Otvori gredicu Testna gredica/u })
        .click();
    await expect(page).toHaveURL(/gredica=Testna\+gredica/u);
    await expect(page.locator('[data-garden-overview-2d]')).toHaveClass(
        /opacity-0/u,
    );
    await expect(
        page.getByRole('button', {
            name: 'Podignuta gredica Testna gredica',
        }),
    ).toBeVisible();
    const raisedBedPlaceholder = page.locator(
        '[data-raised-bed-2d-placeholder]',
    );
    await expect(raisedBedPlaceholder).toBeVisible();
    await expect(
        raisedBedPlaceholder.locator('[data-raised-bed-soil]'),
    ).toBeVisible();
    await expect(
        raisedBedPlaceholder.locator('[data-raised-bed-plank]'),
    ).toHaveCount(4);
    await expectNoImmediateRuntimeFailures(page, failures);
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(modelRequests).toEqual([]);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (window as GardenRenderProbeWindow)
                        .__gardenWebglContextRequests ?? 0,
            ),
        )
        .toBe(0);
});

test('renders the whole game edge to edge while keeping HUD controls safe', async ({
    context,
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await emulateSafeArea(page);
    await context.addCookies([
        {
            domain: '127.0.0.1',
            name: 'gredice_impersonating',
            path: '/',
            value: '1',
        },
    ]);
    await mockGardenApi(page, true);

    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    await expect(page.getByTitle(/zvuk/u)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Impersonacija je aktivna.')).toBeVisible();

    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveCount(1);
    await expect(viewportMeta).toHaveAttribute(
        'content',
        /viewport-fit=cover/u,
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
        'content',
        '#2e6f40',
    );

    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();

    const gameCanvas = page.locator('canvas').first();
    await expect
        .poll(async () => (await gameCanvas.boundingBox())?.width)
        .toBe(viewportSize?.width);
    const canvasBounds = await gameCanvas.boundingBox();
    expect(canvasBounds).not.toBeNull();
    expect(canvasBounds?.x).toBe(0);
    expect(canvasBounds?.y).toBe(0);
    expect(canvasBounds?.width).toBe(viewportSize?.width);
    expect(canvasBounds?.height).toBe(viewportSize?.height);

    const topLeftBounds = await page
        .locator('[data-game-hud-top-left]')
        .boundingBox();
    expect(topLeftBounds).not.toBeNull();
    expect(topLeftBounds?.x).toBeGreaterThanOrEqual(safeAreaInsets.left);
    expect(topLeftBounds?.y).toBeGreaterThanOrEqual(safeAreaInsets.top);

    const topRightBounds = await page
        .locator('[data-game-hud-top-right]')
        .boundingBox();
    expect(topRightBounds).not.toBeNull();
    expect(
        (topRightBounds?.x ?? 0) + (topRightBounds?.width ?? 0),
    ).toBeLessThanOrEqual((viewportSize?.width ?? 0) - safeAreaInsets.right);
    expect(topRightBounds?.y).toBeGreaterThanOrEqual(safeAreaInsets.top);

    const bottomControlsBounds = await page
        .locator('[data-game-hud-bottom-controls]')
        .boundingBox();
    expect(bottomControlsBounds).not.toBeNull();
    expect(
        (bottomControlsBounds?.y ?? 0) + (bottomControlsBounds?.height ?? 0),
    ).toBeLessThanOrEqual((viewportSize?.height ?? 0) - safeAreaInsets.bottom);

    const impersonationBannerBounds = await page
        .getByText('Impersonacija je aktivna.')
        .locator('..')
        .boundingBox();
    expect(impersonationBannerBounds).not.toBeNull();
    expect(impersonationBannerBounds?.x).toBeGreaterThanOrEqual(
        safeAreaInsets.left,
    );
    expect(impersonationBannerBounds?.y).toBeGreaterThanOrEqual(
        safeAreaInsets.top,
    );

    const overflow = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight - window.innerHeight,
        width: document.documentElement.scrollWidth - window.innerWidth,
    }));
    expect(overflow.width).toBeLessThanOrEqual(0);
    expect(overflow.height).toBeLessThanOrEqual(0);
});

test('keeps landscape game dialogs inside the safe area', async ({ page }) => {
    const landscapeSafeArea = { bottom: 18, left: 47, right: 21, top: 0 };
    await page.setViewportSize({ height: 390, width: 844 });
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setSafeAreaInsetsOverride', {
        insets: {
            bottom: landscapeSafeArea.bottom,
            bottomMax: landscapeSafeArea.bottom,
            left: landscapeSafeArea.left,
            leftMax: landscapeSafeArea.left,
            right: landscapeSafeArea.right,
            rightMax: landscapeSafeArea.right,
            top: landscapeSafeArea.top,
            topMax: landscapeSafeArea.top,
        },
    });
    await mockGardenApi(page, true);

    const response = await page.goto('/?pregled=generalno');

    expect(response?.ok()).toBe(true);
    const dialog = page.getByRole('dialog', { name: 'Profil' });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toHaveCSS(
        'padding-left',
        `${landscapeSafeArea.left + 24}px`,
    );
    await expect(dialog).toHaveCSS(
        'padding-right',
        `${landscapeSafeArea.right + 24}px`,
    );

    const closeBounds = await dialog
        .getByRole('button', { name: 'Zatvori' })
        .boundingBox();
    expect(closeBounds).not.toBeNull();
    expect(closeBounds?.x).toBeGreaterThanOrEqual(landscapeSafeArea.left);
    expect(
        (closeBounds?.x ?? 0) + (closeBounds?.width ?? 0),
    ).toBeLessThanOrEqual(844 - landscapeSafeArea.right);
});

test('keeps edge-to-edge viewport behavior scoped to garden experience routes', async ({
    request,
}) => {
    const gameResponse = await request.get('/');
    const overviewResponse = await request.get('/pregled-vrta');
    const documentResponse = await request.get('/pozivnica');

    expect(gameResponse.ok()).toBe(true);
    expect(overviewResponse.ok()).toBe(true);
    expect(documentResponse.ok()).toBe(true);

    const gameHtml = await gameResponse.text();
    const overviewHtml = await overviewResponse.text();
    const documentHtml = await documentResponse.text();

    expect(gameHtml.match(/name="viewport"/gu)).toHaveLength(1);
    expect(gameHtml).toContain('viewport-fit=cover');
    expect(overviewHtml.match(/name="viewport"/gu)).toHaveLength(1);
    expect(overviewHtml).toContain('viewport-fit=cover');
    expect(documentHtml).not.toContain('viewport-fit=cover');
});

test('preserves the published Garden Android app contract', async ({
    request,
}) => {
    const manifestResponse = await request.get('/manifest.json');
    const assetLinksResponse = await request.get(
        '/.well-known/assetlinks.json',
    );

    expect(manifestResponse.ok()).toBe(true);
    expect(assetLinksResponse.ok()).toBe(true);

    const manifest = await manifestResponse.json();
    expect(manifest).toMatchObject({
        background_color: '#2e6f40',
        display: 'fullscreen',
        display_override: ['window-controls-overlay', 'standalone', 'browser'],
        id: '/',
        related_applications: [
            {
                id: 'com.gredice.vrt.twa',
                platform: 'play',
            },
        ],
        scope: 'https://vrt.gredice.com',
        start_url: '/',
        theme_color: '#2e6f40',
    });

    const assetLinks = await assetLinksResponse.json();
    expect(assetLinks).toEqual([
        {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
                namespace: 'android_app',
                package_name: 'com.gredice.vrt.twa',
                sha256_cert_fingerprints: [
                    '33:8A:CB:39:A4:46:2F:AD:42:1B:97:63:F2:76:CE:2E:91:47:01:E0:79:37:61:C2:55:3E:EE:E3:DD:39:77:F2',
                ],
            },
        },
    ]);
});
