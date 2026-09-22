import AxeBuilder from '@axe-core/playwright';
import {
    getAchievementDefinitions,
    getAchievementProgress,
} from '@gredice/js/achievements';
import { expect, test } from '@playwright/experimental-ct-react';
import { ExperienceGuide } from '../app/iskustvo-i-razine/ExperienceGuide';

for (const width of [320, 768, 1280]) {
    test(`XP guide matches progression and stays accessible at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await mount(
            <main className="mx-auto max-w-6xl p-4 sm:p-8">
                <ExperienceGuide />
            </main>,
        );
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            'XP i razine u Gredicama',
        );
        await expect(
            page.getByRole('link', {
                name: 'Pogledaj sva postignuća, uvjete i nagrade',
            }),
        ).toHaveAttribute('href', '/postignuca');
        const rows = page.locator('tbody tr');
        const thresholds = Array.from(
            { length: getAchievementDefinitions().length + 1 },
            (_, count) => getAchievementProgress(count),
        ).filter(({ xp, levelXp }) => xp === levelXp);
        await expect(rows).toHaveCount(thresholds.length);
        for (const [index, progress] of thresholds.entries()) {
            await expect(rows.nth(index).getByRole('img')).toHaveAccessibleName(
                `Razina ${progress.level}`,
            );
            await expect(rows.nth(index).getByRole('cell').nth(0)).toHaveText(
                `${progress.xp.toLocaleString('hr-HR')} XP`,
            );
            await expect(rows.nth(index).getByRole('cell').nth(1)).toHaveText(
                String(progress.achievementCount),
            );
            if (progress.achievementCount > 0) {
                expect(
                    getAchievementProgress(progress.achievementCount - 1).level,
                ).toBe(progress.level - 1);
            }
        }
        const example = page.getByRole('complementary', {
            name: 'Primjer napretka',
        });
        await expect(example).toContainText('Razina 3 · 500 XP');
        await expect(example.getByRole('progressbar')).toHaveAttribute(
            'aria-valuetext',
            'Još 100 XP do razine 4',
        );
        await expect(
            page.getByRole('link', { name: 'Kako funkcioniraju suncokreti' }),
        ).toHaveAttribute('href', '/suncokreti');
        await expect(
            page.getByRole('link', { name: 'Pogledaj ljestvicu vrtlara' }),
        ).toHaveAttribute('href', '/korisnici');
        await page.keyboard.press('Tab');
        await expect(
            page.getByRole('link', { name: 'Moja postignuća u vrtu' }),
        ).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(
            page.getByRole('link', { name: 'Pogledaj pragove razina' }),
        ).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/#pragovi$/);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
        await page.screenshot({
            path: `/tmp/gredice-xp-guide-${width}.png`,
            fullPage: true,
        });
    });
}
