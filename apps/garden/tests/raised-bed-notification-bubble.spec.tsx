import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedNotificationBubbleFixture } from './RaisedBedNotificationBubbleFixture';

test('renders notification media edge-to-edge and follows its raised-bed anchor', async ({
    mount,
}) => {
    const fixture = await mount(<RaisedBedNotificationBubbleFixture />);
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const bubble = fixture.getByRole('button', {
        name: 'Otvori obavijest za gredicu: Nova fotografija gredice Sjever',
    });
    const image = fixture.getByAltText('Nova fotografija gredice Sjever');
    await expect(image).toBeVisible();
    await expect(bubble).toHaveCSS('padding', '0px');
    await expect(image).toHaveCSS('object-fit', 'cover');
    await expect(
        fixture.locator('[data-raised-bed-notification-arrow] path'),
    ).toHaveAttribute('d', 'M1 0.5h18L10 9.5Z');

    const bubbleBox = await bubble.boundingBox();
    const imageBox = await image.boundingBox();
    expect(bubbleBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    if (!bubbleBox || !imageBox) {
        return;
    }
    expect(Math.abs(bubbleBox.width - imageBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(bubbleBox.height - imageBox.height)).toBeLessThanOrEqual(2);

    await fixture.getByTestId('move-notification-anchor').click();
    await expect(fixture).toHaveAttribute('data-position-x', '1');
    await expect
        .poll(async () => (await bubble.boundingBox())?.x)
        .toBeGreaterThan(bubbleBox.x + 40);
});

test('opens notification images in the viewer, clears the bubble, and does not activate the bed', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 400, height: 320 });
    const fixture = await mount(<RaisedBedNotificationBubbleFixture />);
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const bubble = fixture.getByRole('button', {
        name: 'Otvori obavijest za gredicu: Nova fotografija gredice Sjever',
    });

    const topElementIsBubble = await bubble.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return Boolean(
            document
                .elementFromPoint(
                    bounds.left + bounds.width / 2,
                    bounds.top + bounds.height / 2,
                )
                ?.closest('[data-raised-bed-notification-bubble]'),
        );
    });
    expect(topElementIsBubble).toBe(true);

    await bubble.click();
    await expect(fixture).toHaveAttribute('data-image-open-count', '1');
    await expect(fixture).toHaveAttribute('data-bubble-open-count', '0');
    await expect(fixture).toHaveAttribute('data-raised-bed-click-count', '0');
    await expect(bubble).toHaveCount(0);
    await expect(
        page.getByRole('dialog', { name: 'Pregled slike' }),
    ).toBeVisible();
});

test('shows operation context and dismisses from the small close control without opening', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 400, height: 320 });
    const fixture = await mount(
        <RaisedBedNotificationBubbleFixture imageUrl={null} />,
    );
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const bubble = fixture.locator('[data-raised-bed-notification-bubble]');
    await expect(bubble).toContainText('Održavajuća rezidba');
    await expect(bubble).toContainText('Danas je na gredici Sjever odrađena');

    const dismissButton = fixture.getByRole('button', {
        name: 'Odbaci obavijest: Održavajuća rezidba',
    });
    await dismissButton.click();

    await expect(fixture).toHaveAttribute('data-dismiss-count', '1');
    await expect(fixture).toHaveAttribute('data-bubble-open-count', '0');
    await expect(fixture).toHaveAttribute('data-raised-bed-click-count', '0');
    await expect(bubble).toHaveCount(0);
});

test('falls back to a readable text bubble when notification media fails', async ({
    mount,
}) => {
    const fixture = await mount(
        <RaisedBedNotificationBubbleFixture imageUrl="/missing-notification-image.webp" />,
    );
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const bubble = fixture.getByRole('button', {
        name: 'Otvori obavijest za gredicu: Nova fotografija gredice Sjever',
    });
    await expect(bubble).toContainText('Nova fotografija gredice Sjever');
    await expect(
        fixture.locator('[data-raised-bed-notification-image]'),
    ).toHaveCount(0);
});
