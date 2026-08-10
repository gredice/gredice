import { expect, test } from '@playwright/experimental-ct-react';
import { ActorSpeechBubbleFixture } from './ActorSpeechBubbleFixture';

test('keeps one speech bubble attached to the actor and refreshes its lifetime', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<ActorSpeechBubbleFixture />);
    const canvas = fixture.locator('canvas');
    const bubble = fixture.locator('[data-actor-speech-bubble]');
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) {
        return;
    }

    const actorPosition = {
        x: canvasBox.width / 2,
        y: canvasBox.height / 2,
    };
    await canvas.hover({ position: actorPosition });
    await expect(fixture).not.toHaveAttribute('data-message', '');
    await expect(bubble).toBeVisible();
    const firstMessage = await bubble.textContent();
    const firstBubbleBox = await bubble.boundingBox();
    expect(firstBubbleBox).not.toBeNull();

    await canvas.hover({ position: { x: 10, y: 10 } });
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveText(firstMessage ?? '');

    await fixture.getByTestId('move-actor').click();
    await expect(fixture).toHaveAttribute('data-actor-x', '0.75');
    if (firstBubbleBox) {
        await expect
            .poll(async () => (await bubble.boundingBox())?.x)
            .toBeGreaterThan(firstBubbleBox.x + 40);
    }
    await fixture.getByTestId('move-actor').click();
    await expect(fixture).toHaveAttribute('data-actor-x', '0');

    await page.waitForTimeout(1_800);
    await canvas.hover({ position: actorPosition });
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveText(firstMessage ?? '');

    await page.waitForTimeout(1_800);
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveCount(0, { timeout: 2_000 });
});
