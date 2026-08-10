import { expect, test } from '@playwright/experimental-ct-react';
import { ActorSpeechBubbleFixture } from './ActorSpeechBubbleFixture';

test('shows a fresh speech bubble above a hovered actor without stealing pointer events', async ({
    mount,
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

    await canvas.hover({ position: { x: 10, y: 10 } });
    await expect(bubble).toHaveCount(0);

    await canvas.hover({ position: actorPosition });
    await expect(bubble).toBeVisible();
    await expect(bubble).not.toHaveText(firstMessage ?? '');
});
