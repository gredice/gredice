import { expect, test } from '@playwright/experimental-ct-react';
import { AutumnGustLeaseFixture } from '../../../packages/game/tests/AutumnGustLeaseFixture';
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
    test(`yellowing starts in August with a downward gradient when instanced=${instanced}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnVisualFixture
                instanced={instanced}
                calendarDate={[2024, 8, 21]}
            />,
        );
        await expect(fixture).toHaveAttribute('data-sprigs', /.+/);
        const summer = await fixture.getAttribute('data-sprigs');
        for (const pair of (summer ?? '').split(',')) {
            const [bottom, top] = pair.split('-');
            expect(top).toBe(bottom);
        }
        await fixture.update(
            <AutumnVisualFixture
                instanced={instanced}
                calendarDate={[2024, 8, 29]}
            />,
        );
        await expect(fixture).not.toHaveAttribute('data-sprigs', summer ?? '');
        for (const attribute of ['data-canopies', 'data-sprigs']) {
            const colors = await fixture.getAttribute(attribute);
            for (const entry of (colors ?? '').split(',')) {
                const [bottom, top] = entry.split(':')[0].split('-');
                const redToGreen = (color: string) =>
                    Number.parseInt(color.slice(0, 2), 16) /
                    Number.parseInt(color.slice(2, 4), 16);
                expect(redToGreen(top)).toBeGreaterThan(redToGreen(bottom));
            }
        }
        const augustColors = await fixture.getAttribute('data-canopies');
        await fixture.update(
            <AutumnVisualFixture
                instanced={instanced}
                calendarDate={[2024, 9, 10]}
            />,
        );
        await expect(fixture).not.toHaveAttribute(
            'data-canopies',
            augustColors ?? '',
        );
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-september-gradient-${instanced ? 'instanced' : 'individual'}.png`,
            { maxDiffPixelRatio: 0.005, threshold: 0.05 },
        );
        await fixture.update(
            <AutumnVisualFixture
                instanced={instanced}
                calendarDate={[2024, 9, 10]}
                disabled
            />,
        );
        await expect(fixture).toHaveAttribute('data-sprigs', summer ?? '');
    });

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

test('a bench entering tree range during a spring gains leaves on its live parts', async ({
    mount,
}) => {
    const fixture = await mount(
        <AutumnVisualFixture
            instanced
            animateSprings
            movingBenchTargetX={10}
            stage="lateAutumn"
            tier="high"
        />,
    );
    await expect(fixture).toHaveAttribute('data-part-leaves', '0');
    await fixture.update(
        <AutumnVisualFixture
            instanced
            animateSprings
            movingBenchTargetX={0}
            stage="lateAutumn"
            tier="high"
        />,
    );
    await expect(fixture).toHaveAttribute('data-part-leaves', /^[1-9]/);
    await expect(fixture).toHaveAttribute('data-part-mismatch-frames', '0');
    await fixture.update(
        <AutumnVisualFixture
            instanced
            animateSprings
            movingBenchTargetX={10}
            stage="lateAutumn"
            tier="high"
        />,
    );
    await expect(fixture).toHaveAttribute('data-part-leaves', '0');
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

test('winter gusts release the render lease between windows', async ({
    mount,
    page,
}) => {
    test.setTimeout(25_000);
    const fixture = await mount(<AutumnGustLeaseFixture />);
    const readGustActivity = () =>
        page.evaluate(() => ({
            count: window.__grediceGameProfile?.autumnGustCount ?? 0,
            deadlines:
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.activeDeadlineCount ?? 0,
            leases:
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.activeRenderLeaseCount ?? 0,
        }));
    await expect.poll(readGustActivity).toEqual({
        count: 0,
        deadlines: 1,
        leases: 0,
    });
    await expect
        .poll(
            async () => {
                const activity = await readGustActivity();
                return activity.count > 0 && activity.leases > 0;
            },
            { timeout: 14_000 },
        )
        .toBe(true);
    await expect.poll(readGustActivity).toEqual({
        count: 0,
        deadlines: 1,
        leases: 0,
    });
    await fixture.unmount();
});

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

for (const instanced of [false, true]) {
    for (const stage of [
        'summer',
        'earlyAutumn',
        'midAutumn',
        'lateAutumn',
        'winter',
    ] as const) {
        test(`deciduous bushes at ${stage} when instanced=${instanced}`, async ({
            mount,
            page,
        }) => {
            const fixture = await mount(
                <AutumnVisualFixture
                    vegetation="Bush"
                    stage={stage}
                    instanced={instanced}
                    zoom={150}
                    focus={[0, 0.25, 0]}
                />,
            );
            await expect(fixture).toHaveAttribute('data-canopies', /.+/);
            if (stage === 'summer') {
                await expect(fixture).toHaveAttribute('data-sprigs', /.+/);
                expect(
                    (await fixture.getAttribute('data-canopies'))
                        ?.split(',')
                        .every((entry) => entry.endsWith(':144')),
                ).toBe(true);
            }
            if (stage === 'winter') {
                await expect(fixture).toHaveAttribute('data-sprigs', '');
                expect(
                    (await fixture.getAttribute('data-canopies'))
                        ?.split(',')
                        .every((entry) => entry.endsWith(':120')),
                ).toBe(true);
            }
            await expect(page.locator('canvas')).toHaveScreenshot(
                `autumn-bush-${stage}-${instanced ? 'instanced' : 'individual'}.png`,
                { maxDiffPixelRatio: 0.005 },
            );
        });
    }

    test(`bushes yellow downwards and restore summer when instanced=${instanced}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnVisualFixture
                vegetation="Bush"
                calendarDate={[2024, 8, 21]}
                instanced={instanced}
            />,
        );
        await expect(fixture).toHaveAttribute('data-canopies', /.+/);
        await expect(fixture).toHaveAttribute('data-sprigs', /.+/);
        const summer = await fixture.getAttribute('data-canopies');
        const summerSprigs = await fixture.getAttribute('data-sprigs');
        await fixture.update(
            <AutumnVisualFixture
                vegetation="Bush"
                calendarDate={[2024, 8, 29]}
                instanced={instanced}
            />,
        );
        await expect(fixture).not.toHaveAttribute(
            'data-canopies',
            summer ?? '',
        );
        await expect(fixture).not.toHaveAttribute(
            'data-sprigs',
            summerSprigs ?? '',
        );
        for (const attribute of ['data-canopies', 'data-sprigs']) {
            for (const entry of (
                (await fixture.getAttribute(attribute)) ?? ''
            ).split(',')) {
                const [bottom, top] = entry.split(':')[0].split('-');
                expect(top).not.toBe(bottom);
            }
        }
        await fixture.update(
            <AutumnVisualFixture
                vegetation="Bush"
                calendarDate={[2024, 9, 10]}
                instanced={instanced}
                zoom={150}
                focus={[0, 0.25, 0]}
            />,
        );
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-bush-gradient-${instanced ? 'instanced' : 'individual'}.png`,
            { maxDiffPixelRatio: 0.005 },
        );
        await fixture.update(
            <AutumnVisualFixture
                vegetation="Bush"
                stage="winter"
                instanced={instanced}
                disabled
            />,
        );
        await expect(fixture).toHaveAttribute('data-canopies', summer ?? '');
        await expect(fixture).toHaveAttribute(
            'data-sprigs',
            summerSprigs ?? '',
        );
        await fixture.update(
            <AutumnVisualFixture
                vegetation="Bush"
                calendarDate={[2025, 6, 21]}
                instanced={instanced}
            />,
        );
        await expect(fixture).toHaveAttribute('data-canopies', summer ?? '');
        await expect(fixture).toHaveAttribute(
            'data-sprigs',
            summerSprigs ?? '',
        );
    });

    test(`bushes shed leaves from bush height when instanced=${instanced}`, async ({
        mount,
    }) => {
        const fixture = await mount(
            <AutumnVisualFixture
                vegetation="Bush"
                instanced={instanced}
                leaves
            />,
        );
        await expect(fixture).toHaveAttribute('data-leaves', /^[1-9]/);
        await expect(fixture).toHaveAttribute('data-leaf-heights', /.+/);
        const heights = (
            (await fixture.getAttribute('data-leaf-heights')) ?? ''
        )
            .split(',')
            .map(Number);
        expect(heights.every((y) => y >= 0 && y <= 0.5)).toBe(true);
        expect(heights.length).toBeLessThanOrEqual(24);
        await fixture.update(
            <AutumnVisualFixture
                vegetation="Bush"
                instanced={instanced}
                leaves
                stage="summer"
            />,
        );
        await expect(fixture).toHaveAttribute('data-leaves', '0');
        await fixture.update(
            <AutumnVisualFixture
                vegetation="Bush"
                instanced={instanced}
                leaves
                disabled
            />,
        );
        await expect(fixture).toHaveAttribute('data-leaves', '0');
        await fixture.unmount();
    });

    test(`bush snow follows sparse foliage when instanced=${instanced}`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <AutumnVisualFixture
                vegetation="Bush"
                instanced={instanced}
                stage="winter"
                snow={0.7}
                zoom={150}
                focus={[0, 0.25, 0]}
            />,
        );
        await expect(fixture).toHaveAttribute('data-canopies', /.+/);
        await expect(page.locator('canvas')).toHaveScreenshot(
            `autumn-bush-snow-${instanced ? 'instanced' : 'individual'}.png`,
            { maxDiffPixelRatio: 0.005 },
        );
    });
}

test('bush previews can disable seasonal weather independently', async ({
    mount,
}) => {
    const fixture = await mount(
        <AutumnVisualFixture vegetation="Bush" stage="summer" />,
    );
    await expect(fixture).toHaveAttribute('data-canopies', /.+/);
    const summer = await fixture.getAttribute('data-canopies');
    await fixture.update(
        <AutumnVisualFixture
            vegetation="Bush"
            stage="midAutumn"
            weatherDisabled
            leaves
        />,
    );
    await expect(fixture).toHaveAttribute('data-canopies', summer ?? '');
    await expect(fixture).toHaveAttribute('data-leaves', '0');
});

test('bushes accumulate nearby ground leaves and snow covers them', async ({
    mount,
}) => {
    const fixture = await mount(
        <AutumnVisualFixture
            vegetation="Bush"
            instanced
            ground
            stage="lateAutumn"
        />,
    );
    await expect(fixture).toHaveAttribute('data-ground-leaves', /^[1-9]/);
    await fixture.update(
        <AutumnVisualFixture
            vegetation="Bush"
            instanced
            ground
            stage="lateAutumn"
            snow={1}
        />,
    );
    await expect(fixture).toHaveAttribute('data-ground-leaves', '0');
});
