import { expect, test } from '@playwright/experimental-ct-react';
import '../app/globals.css';
import { DeliveryAppHeader } from '../components/DeliveryAppHeader';

test('keeps delivery header controls inside mobile safe areas', async ({
    mount,
    page,
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
    const headerProps = {
        displayName: 'Test Driver',
        role: 'driver',
        userId: 'test-driver',
    } as const;

    await mount(<DeliveryAppHeader {...headerProps} />);

    const header = page.locator('header');
    const padding = await header.evaluate((element) => {
        const styles = window.getComputedStyle(element);
        return {
            left: Number.parseFloat(styles.paddingLeft),
            right: Number.parseFloat(styles.paddingRight),
            top: Number.parseFloat(styles.paddingTop),
        };
    });
    expect(padding.left).toBeGreaterThanOrEqual(safeArea.left + 16);
    expect(padding.right).toBeGreaterThanOrEqual(safeArea.right + 16);
    expect(padding.top).toBeGreaterThanOrEqual(safeArea.top + 12);

    const logoutBounds = await page
        .getByRole('button', { name: 'Odjavi se' })
        .boundingBox();
    expect(logoutBounds).not.toBeNull();
    expect(
        (logoutBounds?.x ?? 0) + (logoutBounds?.width ?? 0),
    ).toBeLessThanOrEqual(390 - safeArea.right);
});
