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
    userName: 'test-user',
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
    await page.route('**/api/gredice/**', async (route) => {
        const { pathname } = new URL(route.request().url());
        let body: unknown;

        if (pathname.endsWith('/api/auth/current-claims')) {
            body = signedIn ? currentUser : null;
        } else if (pathname.endsWith('/api/auth/last-login')) {
            body = {};
        } else if (pathname.endsWith('/api/users/current')) {
            body = signedIn ? currentUser : null;
        } else if (pathname.endsWith('/api/gardens')) {
            body = signedIn ? [] : null;
        } else if (pathname.endsWith('/api/accounts/gardens')) {
            body = signedIn
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
            status: 200,
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

test('loads signed-out landing page without immediate runtime failures', async ({
    page,
}) => {
    const failures = collectRuntimeFailures(page);
    await page.setViewportSize({ height: 844, width: 390 });
    await emulateSafeArea(page);
    await mockGardenApi(page, false);

    const response = await page.goto('/');

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/Gredice/);
    await expect(
        page.getByRole('button', { name: 'Prijava' }).first(),
    ).toBeVisible();
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
        'href',
        '/manifest.json',
    );
    await expect(
        page.locator('meta[name="apple-mobile-web-app-title"]'),
    ).toHaveAttribute('content', 'Gredice');
    const loginBannerBounds = await page
        .getByText('Posjeti gredice.com')
        .locator('..')
        .boundingBox();
    expect(loginBannerBounds).not.toBeNull();
    expect(loginBannerBounds?.y).toBeGreaterThanOrEqual(safeAreaInsets.top);
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

test('keeps edge-to-edge viewport behavior scoped to the game route', async ({
    request,
}) => {
    const gameResponse = await request.get('/');
    const documentResponse = await request.get('/pozivnica');

    expect(gameResponse.ok()).toBe(true);
    expect(documentResponse.ok()).toBe(true);

    const gameHtml = await gameResponse.text();
    const documentHtml = await documentResponse.text();

    expect(gameHtml.match(/name="viewport"/gu)).toHaveLength(1);
    expect(gameHtml).toContain('viewport-fit=cover');
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
