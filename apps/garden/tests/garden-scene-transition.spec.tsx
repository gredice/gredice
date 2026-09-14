import { expect, test } from '@playwright/experimental-ct-react';
import { GardenSceneTransitionFixture } from './GardenSceneTransitionFixture';

test('animates a garden switch without replacing the canvas', async ({
    mount,
}) => {
    const fixture = await mount(<GardenSceneTransitionFixture />);
    const transition = fixture.getByTestId('garden-scene-transition');
    const canvas = fixture.getByTestId('garden-canvas');

    await expect(fixture).toHaveAttribute('data-garden-id', '1');
    await canvas.evaluate((element) => {
        Reflect.set(window, '__grediceGameGardenCanvas', element);
    });

    await fixture.getByRole('button', { name: 'Promijeni vrt' }).click();

    await expect(transition).toHaveAttribute('data-scene-visible', 'false');
    await expect(transition).toHaveClass(/opacity-35/);
    await expect(fixture).toHaveAttribute('data-garden-id', '1');
    await expect(fixture).toHaveAttribute('data-garden-id', '2', {
        timeout: 1_000,
    });
    await expect(transition).toHaveAttribute('data-scene-garden-id', '2');
    await expect(transition).toHaveAttribute('data-scene-visible', 'true');
    await expect
        .poll(() =>
            canvas.evaluate(
                (element) =>
                    Reflect.get(window, '__grediceGameGardenCanvas') ===
                    element,
            ),
        )
        .toBe(true);

    await fixture.getByRole('button', { name: 'Vrati prvi vrt' }).click();

    await expect(transition).toHaveAttribute('data-scene-visible', 'false');
    await expect(fixture).toHaveAttribute('data-garden-id', '1', {
        timeout: 1_000,
    });
    await expect(transition).toHaveAttribute('data-scene-garden-id', '1');
    await expect(transition).toHaveAttribute('data-scene-visible', 'true');
    await expect
        .poll(() =>
            canvas.evaluate(
                (element) =>
                    Reflect.get(window, '__grediceGameGardenCanvas') ===
                    element,
            ),
        )
        .toBe(true);
});

test('switches immediately when reduced motion is preferred', async ({
    mount,
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixture = await mount(<GardenSceneTransitionFixture />);
    const transition = fixture.getByTestId('garden-scene-transition');

    await fixture.getByRole('button', { name: 'Promijeni vrt' }).click();

    await expect(fixture).toHaveAttribute('data-garden-id', '2');
    await expect(transition).toHaveAttribute('data-scene-visible', 'true');
});
