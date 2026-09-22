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

for (const tier of ['low', 'high'] as const) {
    for (const rotation of [0, 1, 2, 3]) {
        test(`reviewed autumn part surfaces on ${tier} at rotation ${rotation}`, async ({
            mount,
            page,
        }) => {
            const fixture = await mount(
                <AutumnVisualFixture
                    instanced
                    partEntities
                    partRotation={rotation}
                    stage="lateAutumn"
                    tier={tier}
                    zoom={55}
                />,
            );
            await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
            await expect(fixture).toHaveAttribute('data-canopies', /.+/);
            expect(
                Number(await fixture.getAttribute('data-entity-leaves')),
            ).toBeLessThanOrEqual(tier === 'low' ? 24 : 160);
            await expect(page.locator('canvas')).toHaveScreenshot(
                `autumn-parts-${tier}-rotation-${rotation}.png`,
                { maxDiffPixelRatio: 0.005 },
            );
        });
    }
}

for (const [weather, rain, snow] of [
    ['rain', 1, 0],
    ['partial-snow', 0, 0.5],
] as const) {
    test(`reviewed part surfaces under ${weather}`, async ({ mount, page }) => {
        const fixture = await mount(
            <AutumnVisualFixture
                instanced
                partEntities
                stage="lateAutumn"
                tier="high"
                rain={rain}
                snow={snow}
                zoom={55}
            />,
        );
        await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-parts-${weather}.png`,
            { maxDiffPixelRatio: 0.005 },
        );
    });
}

for (const [name, focus] of [
    ['bench', [-2.2, 0.45, 1.8]],
    ['table', [0, 0.67, 1.8]],
    ['closed-box', [2.2, 0.65, 1.8]],
    ['large-stone', [-2.2, 0.55, 3.3]],
    ['wooden-gate', [0, 0.55, 3.3]],
    ['stone-gate', [2.2, 0.68, 3.3]],
    ['polished-gate', [-2.2, 0.68, 4.8]],
] as const) {
    test(`reviewed ${name} face closeup`, async ({ mount, page }) => {
        const fixture = await mount(
            <AutumnVisualFixture
                instanced
                partEntities
                stage="lateAutumn"
                tier="high"
                focus={focus}
                zoom={155}
            />,
        );
        await expect(fixture).toHaveAttribute('data-entity-leaves', /^[1-9]/);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-part-${name}-closeup.png`,
            { maxDiffPixelRatio: 0.005 },
        );
    });
}

test('reviewed lids remain seated at a grazing camera angle', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <AutumnVisualFixture
            instanced
            partEntities
            stage="lateAutumn"
            tier="high"
            focus={[2.2, 0.65, 1.8]}
            cameraHeight={1.5}
            zoom={155}
        />,
    );
    await expect(fixture).toHaveAttribute('data-entity-leaves', /^[1-9]/);
    await expect(page.locator('canvas')).toHaveScreenshot(
        'autumn-part-lid-grazing.png',
        { maxDiffPixelRatio: 0.005 },
    );
});

test('closed standalone lid disappears on open and returns only after closing settles', async ({
    mount,
}) => {
    const fixture = await mount(
        <AutumnVisualFixture
            instanced
            standaloneBox
            animateSprings
            stage="lateAutumn"
            tier="high"
        />,
    );
    await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
    await fixture.getByTestId('open-autumn-box').click();
    await expect(fixture).toHaveAttribute('data-part-leaves', '0');
    await fixture.getByTestId('close-autumn-box').click();
    await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
    await fixture.getByTestId('open-autumn-box').click();
    await expect(fixture).toHaveAttribute('data-part-leaves', '0');
    await fixture.getByTestId('close-autumn-box').click();
    await fixture.getByTestId('open-autumn-box').click();
    await expect(fixture).toHaveAttribute('data-part-leaves', '0');
    await fixture.getByTestId('close-autumn-box').click();
    await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
});

test('part clusters stay attached during animated root rotation', async ({
    mount,
}) => {
    const fixture = await mount(
        <AutumnVisualFixture
            instanced
            partEntities
            animateSprings
            stage="lateAutumn"
            tier="high"
        />,
    );
    await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
    await expect(fixture).toHaveAttribute('data-part-mismatch-frames', '0');
    await fixture.update(
        <AutumnVisualFixture
            instanced
            partEntities
            animateSprings
            partRotation={1}
            stage="lateAutumn"
            tier="high"
        />,
    );
    await expect(fixture).toHaveAttribute('data-part-motion-samples', /^[2-9]/);
    await expect(fixture).toHaveAttribute('data-part-mismatch-frames', '0');
});

test('bench leaves follow a real drop spring while props rotate and the lid opens', async ({
    mount,
}) => {
    const fixture = await mount(
        <AutumnVisualFixture
            instanced
            partEntities
            standaloneBox
            motionDrop
            animateSprings
            stage="lateAutumn"
            tier="high"
        />,
    );
    await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
    await fixture.getByTestId('start-autumn-combined-motion').click();
    await fixture.update(
        <AutumnVisualFixture
            instanced
            partEntities
            standaloneBox
            motionDrop
            animateSprings
            partRotation={1}
            stage="lateAutumn"
            tier="high"
        />,
    );
    await expect(fixture).toHaveAttribute('data-drop-motion-samples', /^[1-9]/);
    await expect(fixture).toHaveAttribute('data-part-motion-samples', /^[2-9]/);
    await expect(fixture).toHaveAttribute('data-part-mismatch-frames', '0');
});

test('summer and full snow leave reviewed part surfaces clear', async ({
    mount,
}) => {
    const fixture = await mount(
        <AutumnVisualFixture instanced partEntities stage="summer" />,
    );
    await expect(fixture).toHaveAttribute('data-part-leaves', '0');
    await fixture.update(
        <AutumnVisualFixture
            instanced
            partEntities
            stage="lateAutumn"
            snow={1}
        />,
    );
    await expect(fixture).toHaveAttribute('data-part-leaves', '0');
});

test('reduced motion still restores the settled standalone lid', async ({
    mount,
}) => {
    const fixture = await mount(
        <AutumnVisualFixture
            instanced
            standaloneBox
            stage="lateAutumn"
            tier="high"
        />,
    );
    await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
    await fixture.getByTestId('open-autumn-box').click();
    await expect(fixture).toHaveAttribute('data-part-leaves', '0');
    await fixture.getByTestId('close-autumn-box').click();
    await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
});

test('separate canvas roots do not retain another root’s part registrations', async ({
    mount,
}) => {
    const fixture = await mount(
        <div>
            <AutumnVisualFixture
                instanced
                standaloneBox
                stage="lateAutumn"
                tier="high"
            />
            <AutumnVisualFixture
                instanced
                standaloneBox
                stage="lateAutumn"
                tier="high"
            />
        </div>,
    );
    const scenes = fixture.getByTestId('autumn-scene');
    await expect(scenes).toHaveCount(2);
    await expect(scenes.nth(0)).toHaveAttribute('data-part-leaves', /^[1-9]/);
    await expect(scenes.nth(1)).toHaveAttribute('data-part-leaves', /^[1-9]/);
    await fixture.update(
        <div>
            <AutumnVisualFixture
                instanced
                standaloneBox
                stage="lateAutumn"
                tier="high"
            />
        </div>,
    );
    await expect(fixture.getByTestId('autumn-scene')).toHaveCount(1);
    await expect(fixture.getByTestId('autumn-scene')).toHaveAttribute(
        'data-part-leaves',
        /^[1-9]/,
    );
});

test('summer has no ambient leaf pool activity', async ({ mount }) => {
    const fixture = await mount(
        <AutumnVisualFixture instanced leaves stage="summer" />,
    );
    await expect(fixture).toHaveAttribute('data-canopies', /.+/);
    await expect(fixture).toHaveAttribute('data-leaves', '0');
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
