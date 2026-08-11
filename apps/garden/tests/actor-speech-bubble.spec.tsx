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

test('allows an actor speech bubble to open its action', async ({ mount }) => {
    const fixture = await mount(<ActorSpeechBubbleFixture interactive />);
    const canvas = fixture.locator('canvas');
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) {
        return;
    }

    await canvas.hover({
        position: {
            x: canvasBox.width / 2,
            y: canvasBox.height / 2,
        },
    });
    const bubble = fixture.getByRole('button', { name: 'Otvori poruku' });
    await bubble.click();
    await expect(fixture).toHaveAttribute('data-bubble-clicks', '1');
});

test('gives long interactive advice a wider readable bubble', async ({
    mount,
}) => {
    const fixture = await mount(
        <ActorSpeechBubbleFixture
            interactive
            messages={[
                'Pregledao sam gredice. Imam nekoliko bilješki za tebe...',
            ]}
            wide
        />,
    );
    const canvas = fixture.locator('canvas');
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) {
        return;
    }

    await canvas.hover({
        position: {
            x: canvasBox.width / 2,
            y: canvasBox.height / 2,
        },
    });
    const bubble = fixture.getByRole('button', { name: 'Otvori poruku' });
    await expect(bubble).toHaveText(
        'Pregledao sam gredice. Imam nekoliko bilješki za tebe...',
    );
    const bubbleBox = await bubble.boundingBox();
    expect(bubbleBox?.width).toBeGreaterThan(240);
});

test('keeps the bubble body above its head anchor when zoomed out', async ({
    mount,
}) => {
    const cameraZoom = 30;
    const fixture = await mount(
        <ActorSpeechBubbleFixture cameraZoom={cameraZoom} />,
    );
    const canvas = fixture.locator('canvas');
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) {
        return;
    }

    await canvas.hover({
        position: {
            x: canvasBox.width / 2,
            y: canvasBox.height / 2,
        },
    });
    const bubble = fixture.locator('[data-actor-speech-bubble]');
    await expect(bubble).toBeVisible();

    const bubbleBox = await bubble.boundingBox();
    expect(bubbleBox).not.toBeNull();
    if (!bubbleBox) {
        return;
    }

    const headAnchorY = canvasBox.y + canvasBox.height / 2 - 1.2 * cameraZoom;
    expect(bubbleBox.y + bubbleBox.height).toBeLessThan(headAnchorY - 3);
});
