import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { FaqSectionView } from '../components/faq/FaqSectionView';
import { faqTestEntries } from '../components/faq/faqTestEntries';

for (const width of [390, 768, 1280]) {
    test(`shared FAQ is keyboard accessible with working Markdown links at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mount(
            <FaqSectionView
                title="Pitanja o dostavi"
                entries={faqTestEntries}
            />,
        );
        const section = page.getByRole('region', { name: 'Pitanja o dostavi' });
        const trigger = section.getByRole('button', { name: 'Prvo pitanje' });
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(
            section.getByRole('link', { name: 'poveznicom na dostavu' }),
        ).toHaveCount(0);
        await trigger.focus();
        await page.keyboard.press('Enter');
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const answer = page.locator(
            `[id="${await trigger.getAttribute('aria-controls')}"]`,
        );
        await expect(
            answer.getByRole('link', { name: 'poveznicom na dostavu' }),
        ).toBeVisible();
        await expect(answer.getByRole('link')).toHaveAttribute(
            'href',
            '/dostava',
        );
        // Check contrast once the expanding answer has finished fading in.
        await expect(
            answer.locator('xpath=ancestor::*[@data-collapse-state][1]'),
        ).toHaveCSS('opacity', '1');
        await expect(
            section.getByRole('link', { name: 'Kako Gredice funkcioniraju' }),
        ).toHaveAttribute('href', '/cesta-pitanja#service');
        await expect(
            section.getByRole('link', { name: 'Zatraži pomoć' }),
        ).toHaveAttribute('href', '/kontakt');
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        expect(
            (
                await new AxeBuilder({ page })
                    .include('[data-testid="related-faq"]')
                    .analyze()
            ).violations,
        ).toEqual([]);
    });
}

test('missing published entries leave no empty FAQ section', async ({
    mount,
    page,
}) => {
    await mount(<FaqSectionView title="Pitanja o dostavi" entries={[]} />);
    await expect(page.getByTestId('related-faq')).toHaveCount(0);
});
