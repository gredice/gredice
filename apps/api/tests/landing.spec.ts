import { expect, test } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gredice API/);
});

test('keeps the API header inside mobile safe areas', async ({
    page,
    request,
}) => {
    const safeArea = { bottom: 24, left: 12, right: 12, top: 32 };
    await page.setViewportSize({ height: 844, width: 390 });
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setSafeAreaInsetsOverride', {
        insets: {
            bottom: safeArea.bottom,
            bottomMax: safeArea.bottom,
            left: safeArea.left,
            leftMax: safeArea.left,
            right: safeArea.right,
            rightMax: safeArea.right,
            top: safeArea.top,
            topMax: safeArea.top,
        },
    });

    await page.goto('/');

    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
        'content',
        /viewport-fit=cover/u,
    );
    const logoBounds = await page
        .getByRole('img', { name: 'Gredice Logotype' })
        .boundingBox();
    expect(logoBounds).not.toBeNull();
    expect(logoBounds?.x).toBeGreaterThanOrEqual(safeArea.left);
    expect(logoBounds?.y).toBeGreaterThanOrEqual(safeArea.top);
    expect((logoBounds?.x ?? 0) + (logoBounds?.width ?? 0)).toBeLessThanOrEqual(
        390 - safeArea.right,
    );

    const firstApiLinkBounds = await page
        .locator('a[href="/test"]')
        .boundingBox();
    expect(firstApiLinkBounds).not.toBeNull();
    expect(firstApiLinkBounds?.x).toBeGreaterThanOrEqual(safeArea.left + 16);

    await page.goto('/docs/auth');
    await expect(page.getByTestId('api-reference')).toHaveCSS(
        '--scalar-custom-header-height',
        `calc(62px + ${safeArea.top}px)`,
    );

    const manifestResponse = await request.get('/manifest.json');
    expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json();
    expect(manifest).toMatchObject({
        background_color: '#111111',
        display: 'minimal-ui',
        start_url: '/',
        theme_color: '#111111',
    });
});

test('links to MCP test console', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/test"]')).toContainText('/api/mcp');
});

test('serves MCP test console', async ({ page }) => {
    await page.goto('/test');
    await expect(
        page.getByRole('heading', {
            name: 'Gredice MCP docs and test console',
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /public read tool/ }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /authenticated read tool/ }),
    ).toBeVisible();
});
