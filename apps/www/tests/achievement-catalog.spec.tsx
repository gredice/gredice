import AxeBuilder from '@axe-core/playwright';
import {
    achievementXp,
    getAchievementDefinitions,
    getAchievementFamilies,
} from '@gredice/js/achievements';
import { expect, test } from '@playwright/experimental-ct-react';
import { AchievementCatalog } from '../app/postignuca/AchievementCatalog';

for (const width of [320, 768, 1280]) {
    test(`all achievements and rewards are accessible at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await mount(
            <main className="mx-auto max-w-6xl p-4">
                <AchievementCatalog now="2026-09-22T12:00:00Z" />
            </main>,
        );
        await expect(
            page.getByRole('link', {
                name: 'Kako skupljati XP i napredovati kroz razine',
            }),
        ).toHaveAttribute('href', '/iskustvo-i-razine');
        const cards = page.locator('[data-catalog-achievement]');
        await expect(cards).toHaveCount(getAchievementDefinitions().length);
        for (const definition of getAchievementDefinitions()) {
            const card = page.locator(
                `[data-catalog-achievement="${definition.key}"]`,
            );
            await expect(card.getByRole('heading')).toHaveText(
                definition.title.trim(),
            );
            await expect(card).toContainText(definition.description);
            await expect(card).toContainText(
                `${definition.rewardSunflowers.toLocaleString('hr-HR')} suncokreta`,
            );
            await expect(card).toContainText(`+${achievementXp} XP`);
        }
        await expect(
            page.locator('[data-catalog-achievement="season_2026_spring"]'),
        ).toContainText('Sezona je završila');
        await expect(
            page.locator('[data-catalog-achievement="season_2026_autumn"]'),
        ).toContainText('Dostupno ove sezone');
        const navigation = page.getByRole('navigation', {
            name: 'Zbirke postignuća',
        });
        for (const family of getAchievementFamilies([])) {
            const link = navigation.getByRole('link', {
                name: `${family.label} (${family.levels.length})`,
                exact: true,
            });
            await expect(link).toHaveAttribute('href', `#${family.key}`);
            await link.click();
            await expect(page.locator(`#${family.key}`)).toBeInViewport();
        }
        await expect(
            page.getByRole('link', { name: 'Moja postignuća u vrtu' }),
        ).toHaveAttribute(
            'href',
            'https://vrt.gredice.com/?pregled=postignuca',
        );
        const imagesLoaded = await cards
            .locator('svg image')
            .evaluateAll(async (images) =>
                Promise.all(
                    images.map(async (element) => {
                        const image = new Image();
                        image.src = element.getAttribute('href') ?? '';
                        await image.decode();
                        return image.naturalWidth > 0;
                    }),
                ),
            );
        expect(imagesLoaded.every(Boolean)).toBe(true);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
            path: `/tmp/gredice-achievements-${width}.png`,
        });
    });
}
