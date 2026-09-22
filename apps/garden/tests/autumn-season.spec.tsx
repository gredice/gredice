import { expect, test } from '@playwright/experimental-ct-react';
import { AutumnVisualFixture } from '../../../packages/game/tests/AutumnVisualFixture';

for (const stage of [
    'summer',
    'earlyAutumn',
    'midAutumn',
    'lateAutumn',
    'winter',
] as const) {
    test(`deciduous trees at ${stage}`, async ({ mount, page }) => {
        const fixture = await mount(<AutumnVisualFixture stage={stage} />);
        await expect(fixture).toHaveAttribute('data-canopies', /.+/);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-${stage}.png`,
            { maxDiffPixelRatio: 0.005 },
        );
    });
}

test('disabled seasonal weather keeps summer color', async ({ mount }) => {
    const fixture = await mount(<AutumnVisualFixture stage="summer" />);
    await expect(fixture).toHaveAttribute('data-canopies', /.+/);
    const summer = await fixture.getAttribute('data-canopies');
    await fixture.update(<AutumnVisualFixture stage="midAutumn" disabled />);
    await expect(fixture).toHaveAttribute('data-canopies', summer ?? '');
});

for (const lighting of ['twilight', 'cloudy'] as const) {
    test(`autumn colors under ${lighting} at far zoom`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnVisualFixture lighting={lighting} zoom={60} />,
        );
        await expect(fixture).toHaveAttribute('data-canopies', /.+/);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-${lighting}.png`,
            { maxDiffPixelRatio: 0.005 },
        );
    });
}

test('winter canopy preserves snow layering', async ({ mount, page }) => {
    const fixture = await mount(
        <AutumnVisualFixture stage="winter" snow={0.7} />,
    );
    await expect(fixture).toHaveAttribute('data-canopies', /.+/);
    await expect(page.locator('canvas')).toHaveScreenshot('autumn-snow.png', {
        maxDiffPixelRatio: 0.005,
    });
});
