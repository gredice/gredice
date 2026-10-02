import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import type { AutumnShrubReviewCase } from '../../../packages/game/tests/autumnShrubReviewCases';
import { SeasonalMapleFixture } from '../../../packages/game/tests/SeasonalMapleFixture';

const stages: Record<AutumnShrubReviewCase, string[]> = {
    summer: ['full'],
    earlyAutumn: ['full'],
    autumn: ['full'],
    lateAutumn: ['thinning', 'sparse'],
    winter: ['sparse'],
    springBuds: ['sparse'],
    spring: ['thinning'],
    springFull: ['full'],
    disabled: ['full'],
    rain: ['full'],
    snow: ['sparse'],
};

async function checkShrubs(
    fixture: Locator,
    page: Page,
    scenario: AutumnShrubReviewCase,
    rotation: number,
) {
    await expect(fixture).toHaveAttribute('data-ready', /.+/);
    const data: {
        sources: number;
        shrubs: {
            id: string;
            stage: string;
            foliage: {
                name: string;
                color: string;
                colors: number[];
                firstColor: string;
                triangles: number;
                materialId: string;
            }[];
            snow: number;
            rain: number;
            rotation: number;
            minY: number;
            height: number;
            width: number;
            depth: number;
            x: number;
            y: number;
        }[];
        cached: {
            gold: string;
            russet: string;
            goldHasVertexColors: boolean;
            bush: string;
        };
        legacyBushColors: string[];
    } = JSON.parse((await fixture.getAttribute('data-ready')) ?? '{}');
    expect(data.shrubs).toHaveLength(3);
    expect(data.sources).toBe(scenario === 'disabled' ? 0 : 2);
    expect(data.cached.gold).toBe('78a447');
    expect(data.cached.goldHasVertexColors).toBe(false);
    expect(data.legacyBushColors).toHaveLength(2);
    const ownedMaterials = data.shrubs.flatMap((shrub) =>
        shrub.foliage.map((part) => part.materialId),
    );
    expect(new Set(ownedMaterials).size).toBe(ownedMaterials.length);
    for (const shrub of data.shrubs) {
        const disabled =
            shrub.id === 'shrub-disabled' || scenario === 'disabled';
        expect(disabled ? ['full'] : stages[scenario]).toContain(shrub.stage);
        expect(shrub.rotation).toBeCloseTo((rotation * Math.PI) / 2, 5);
        expect(shrub.minY).toBeCloseTo(
            shrub.id === 'shrub-table' ? 1.07 : 0.4,
            3,
        );
        expect(shrub.height).toBeGreaterThan(1.5);
        expect(shrub.height).toBeLessThanOrEqual(1.81);
        expect(shrub.width).toBeLessThanOrEqual(0.9);
        expect(shrub.depth).toBeLessThanOrEqual(0.9);
        expect(shrub.foliage).toHaveLength(1);
        const colors = shrub.foliage[0].colors;
        expect(colors.length).toBeGreaterThan(0);
        expect(shrub.foliage[0].triangles).toBeLessThanOrEqual(460);
        if (
            disabled ||
            scenario === 'summer' ||
            scenario.startsWith('spring')
        ) {
            expect(shrub.foliage[0].firstColor).toBe('78a447');
            for (let index = 3; index < colors.length; index += 3)
                expect(colors.slice(index, index + 3)).toEqual(
                    colors.slice(0, 3),
                );
        }
        if (scenario === 'autumn' && !disabled)
            expect(new Set(colors).size).toBeGreaterThan(3);
        if (disabled) {
            expect(shrub.snow).toBe(0);
            expect(shrub.rain).toBe(0);
        }
        if (scenario === 'snow' && !disabled)
            expect(shrub.snow).toBeGreaterThan(0);
        if (scenario === 'rain' && !disabled)
            expect(shrub.rain).toBeGreaterThan(0);
        await fixture
            .locator('canvas')
            .click({ position: { x: shrub.x, y: shrub.y } });
        await expect(fixture).toHaveAttribute('data-hit', shrub.id);
    }
    await page.getByRole('button', { name: 'Pregledaj rajčicu' }).click();
    return { cached: data.cached, legacyBushColors: data.legacyBushColors };
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => console.error(error.stack));
    await page.route('**/*', (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (
            !['localhost', '127.0.0.1'].includes(url.hostname) ||
            !['GET', 'HEAD'].includes(request.method())
        )
            return route.abort();
        return route.continue();
    });
});

for (const night of [false, true]) {
    for (const rotation of [0, 1, 2, 3]) {
        test(`seasonal maple ${night ? 'night' : 'day'} ${rotation}`, async ({
            mount,
            page,
        }) => {
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            const fixture = await mount(
                <SeasonalMapleFixture rotation={rotation} night={night} />,
            );
            await checkShrubs(fixture, page, 'autumn', rotation);
            await expect(fixture).toHaveAttribute('data-plant-clicks', '1');
            await expect(fixture).toHaveScreenshot(
                `${night ? 'night' : 'day'}-${rotation}.png`,
                { maxDiffPixels: night ? 20 : 0 },
            );
            expect(errors).toEqual([]);
        });
    }
}

for (const scenario of [
    'summer',
    'earlyAutumn',
    'lateAutumn',
    'winter',
    'springBuds',
    'spring',
    'springFull',
    'disabled',
    'rain',
    'snow',
] satisfies AutumnShrubReviewCase[]) {
    test(`seasonal maple ${scenario} contract`, async ({ mount, page }) => {
        const fixture = await mount(
            <SeasonalMapleFixture rotation={0} scenario={scenario} />,
        );
        await checkShrubs(fixture, page, scenario, 0);
        // Animated weather is inspected as an attached capture; precipitation positions are not golden pixels.
        if (scenario === 'rain' || scenario === 'snow') {
            await fixture.screenshot({
                path: `../../docs/seasonal-maple-2026/${scenario}.png`,
            });
        } else {
            await expect(fixture).toHaveScreenshot(`${scenario}.png`);
        }
    });
}

test('seasonal maple stays readable on a small low-quality canvas', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<SeasonalMapleFixture rotation={0} small />);
    await checkShrubs(fixture, page, 'autumn', 0);
    await expect(fixture).toHaveScreenshot('small.png');
});

test('seasonal maple follows shared clock and disable toggles without changing cached assets or the existing bush', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <SeasonalMapleFixture rotation={0} scenario="summer" />,
    );
    const initial = await checkShrubs(fixture, page, 'summer', 0);
    for (const scenario of [
        'autumn',
        'winter',
        'springBuds',
        'spring',
        'springFull',
        'disabled',
        'winter',
        'summer',
    ] satisfies AutumnShrubReviewCase[]) {
        await fixture.update(
            <SeasonalMapleFixture rotation={0} scenario={scenario} />,
        );
        expect(await checkShrubs(fixture, page, scenario, 0)).toEqual(initial);
    }
});

for (const small of [false, true])
    test(`seasonal maple dense mixed grove ${small ? 'low' : 'high'}`, async ({
        mount,
    }) => {
        const fixture = await mount(
            <SeasonalMapleFixture
                rotation={0}
                scenario="autumn"
                dense
                small={small}
            />,
        );
        await expect(fixture).toHaveAttribute('data-ready', /.+/);
        const data = JSON.parse(
            (await fixture.getAttribute('data-ready')) ?? '{}',
        );
        expect(data.sources).toBe(66);
        expect(data.leaves).toBeGreaterThan(0);
        expect(data.leaves).toBeLessThanOrEqual(small ? 24 : 160);
        expect(data.draws).toBeLessThan(400);
        expect(data.triangles).toBeLessThan(150000);
        console.log(
            'Dense mixed grove',
            small ? 'low' : 'high',
            JSON.stringify({
                sources: data.sources,
                leaves: data.leaves,
                draws: data.draws,
                triangles: data.triangles,
            }),
        );
    });
