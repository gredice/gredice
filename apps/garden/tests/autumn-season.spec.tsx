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
    await expect(fixture).toHaveAttribute('data-sprigs', /.+/);
    const summerSprigs = await fixture.getAttribute('data-sprigs');
    await fixture.update(<AutumnVisualFixture stage="midAutumn" disabled />);
    await expect(fixture).toHaveAttribute('data-canopies', summer ?? '');
    await expect(fixture).toHaveAttribute('data-sprigs', summerSprigs ?? '');
});

for (const instanced of [false, true]) {
    test(`full autumn tree sprigs change color when instanced=${instanced}`, async ({
        mount,
    }) => {
        const fixture = await mount(
            <AutumnVisualFixture instanced={instanced} stage="summer" />,
        );
        await expect(fixture).toHaveAttribute('data-sprigs', /.+/);
        const summerSprigs = await fixture.getAttribute('data-sprigs');
        await fixture.update(
            <AutumnVisualFixture instanced={instanced} stage="midAutumn" />,
        );
        await expect(fixture).toHaveAttribute('data-sprigs', /.+/);
        await expect(fixture).not.toHaveAttribute(
            'data-sprigs',
            summerSprigs ?? '',
        );
    });
}

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

for (const stage of ['summer', 'midAutumn', 'lateAutumn', 'winter'] as const) {
    test(`batched garden trees at ${stage}`, async ({ mount, page }) => {
        const fixture = await mount(
            <AutumnVisualFixture instanced stage={stage} />,
        );
        await expect(fixture).toHaveAttribute('data-canopies', /.+/);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-instanced-${stage}.png`,
            { maxDiffPixelRatio: 0.005 },
        );
    });
}

for (const tier of ['low', 'high'] as const) {
    test(`falling leaves render deterministically on ${tier}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnVisualFixture instanced leaves tier={tier} />,
        );
        await expect(fixture).toHaveAttribute('data-leaves', /^[1-9]/);
        expect(
            Number(await fixture.getAttribute('data-leaves')),
        ).toBeLessThanOrEqual(tier === 'low' ? 24 : 160);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-leaves-${tier}.png`,
            { maxDiffPixelRatio: 0.005 },
        );
    });
}

test('summer has no ambient leaf pool activity', async ({ mount }) => {
    const fixture = await mount(
        <AutumnVisualFixture instanced leaves stage="summer" />,
    );
    await expect(fixture).toHaveAttribute('data-canopies', /.+/);
    await expect(fixture).toHaveAttribute('data-leaves', '0');
});

for (const tier of ['low', 'high'] as const) {
    test(`ground gusts share the autumn leaf cap on ${tier}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnVisualFixture
                instanced
                ground
                leaves
                gusts
                stage="lateAutumn"
                tier={tier}
            />,
        );
        await expect(fixture).toHaveAttribute('data-gust-leaves', /^[1-9]/);
        await expect(fixture).toHaveAttribute('data-ground-leaves', /^[1-9]/);
        expect(
            Number(await fixture.getAttribute('data-leaves')),
        ).toBeLessThanOrEqual(tier === 'low' ? 24 : 160);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-gust-${tier}.png`,
            { maxDiffPixelRatio: 0.005 },
        );
    });
}

test('calm, heavy rain, snow and reduced motion silence ground gusts', async ({
    mount,
    page,
}) => {
    const base = {
        instanced: true,
        ground: true,
        leaves: true,
        gusts: true,
        stage: 'lateAutumn' as const,
    };
    const fixture = await mount(<AutumnVisualFixture {...base} wind={0} />);
    await expect(fixture).toHaveAttribute('data-canopies', /.+/);
    await expect(fixture).toHaveAttribute('data-gust-leaves', '0');
    await fixture.update(<AutumnVisualFixture {...base} rain={0.8} />);
    await expect(fixture).toHaveAttribute('data-gust-leaves', '0');
    await fixture.update(<AutumnVisualFixture {...base} snow={1} />);
    await expect(fixture).toHaveAttribute('data-gust-leaves', '0');
    await fixture.update(<AutumnVisualFixture {...base} />);
    await expect(fixture).toHaveAttribute('data-gust-leaves', /^[1-9]/);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixture.update(<AutumnVisualFixture {...base} wind={2.5} />);
    await expect(fixture).toHaveAttribute('data-gust-leaves', '0');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    expect(
        await page.evaluate(
            () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        ),
    ).toBe(false);
    await fixture.update(<AutumnVisualFixture {...base} wind={3} />);
    await expect(fixture).toHaveAttribute('data-gust-leaves', /^[1-9]/);
    await fixture.unmount();
    expect(
        await page.evaluate(() => window.__grediceGameProfile?.autumnGustCount),
    ).toBe(0);
});

for (const tier of ['low', 'high'] as const) {
    test(`settled ground leaves on flat and rotated sloped blocks at ${tier}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnVisualFixture
                instanced
                ground
                stage="lateAutumn"
                tier={tier}
            />,
        );
        await expect(fixture).toHaveAttribute('data-ground-leaves', /^[1-9]/);
        await expect(fixture).toHaveAttribute('data-canopies', /.+/);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-ground-${tier}.png`,
            { maxDiffPixelRatio: 0.005 },
        );
        await fixture.update(
            <AutumnVisualFixture instanced ground stage="summer" tier={tier} />,
        );
        await expect(fixture).toHaveAttribute('data-ground-leaves', '0');
        await fixture.update(
            <AutumnVisualFixture
                instanced
                ground
                stage="lateAutumn"
                snow={1}
                tier={tier}
            />,
        );
        await expect(fixture).toHaveAttribute('data-ground-leaves', '0');
    });
}

for (const tier of ['low', 'high'] as const) {
    test(`static entity leaf surfaces at ${tier}`, async ({ mount, page }) => {
        const fixture = await mount(
            <AutumnVisualFixture
                instanced
                entities
                stage="lateAutumn"
                tier={tier}
                zoom={65}
            />,
        );
        await expect(fixture).toHaveAttribute('data-entity-leaves', /^[1-9]/);
        await expect(fixture).toHaveAttribute('data-canopies', /.+/);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-entities-${tier}.png`,
            { maxDiffPixelRatio: 0.002 },
        );
        await fixture.update(
            <AutumnVisualFixture
                instanced
                entities
                stage="summer"
                tier={tier}
                zoom={65}
            />,
        );
        await expect(fixture).toHaveAttribute('data-entity-leaves', '0');
        await fixture.update(
            <AutumnVisualFixture
                instanced
                entities
                stage="lateAutumn"
                snow={1}
                tier={tier}
                zoom={65}
            />,
        );
        await expect(fixture).toHaveAttribute('data-entity-leaves', '0');
    });
}
