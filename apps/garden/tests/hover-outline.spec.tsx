import { expect, test } from '@playwright/experimental-ct-react';
import { HoverOutlineVisualFixture } from './HoverOutlineVisualFixture';

test('preserves outside-only grouped outlines and priority compositing at DPR 2', async ({
    mount,
    page,
}) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        browserErrors.push(error.message);
    });

    const fixture = await mount(<HoverOutlineVisualFixture />);
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const canvas = fixture.locator('canvas');
    await expect(canvas).toHaveAttribute('height', '480');
    await expect(canvas).toHaveAttribute('width', '720');

    const pngDataUrl = await canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) {
            throw new Error('Expected the fixture to render a canvas element');
        }

        return element.toDataURL('image/png');
    });
    const pngDataUrlPrefix = 'data:image/png;base64,';
    expect(pngDataUrl.startsWith(pngDataUrlPrefix)).toBe(true);
    const drawingBufferPng = Buffer.from(
        pngDataUrl.slice(pngDataUrlPrefix.length),
        'base64',
    );

    expect(drawingBufferPng).toMatchSnapshot('hover-outline-legacy.png', {
        maxDiffPixels: 0,
    });
    expect(browserErrors).toEqual([]);
});
