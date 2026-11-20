import { expect, test } from '@playwright/experimental-ct-react';
import { SettingsLayoutStory } from './SettingsLayoutStory';

const linkSuffix = ' – odjeljak ove stranice';

test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('keeps the section links beside the content while scrolling', async ({
        mount,
        page,
    }) => {
        await mount(<SettingsLayoutStory />);

        const nav = page.getByRole('navigation', { name: 'Odjeljci postavki' });
        const general = nav.getByRole('link', {
            name: `Općenito${linkSuffix}`,
        });
        const integrations = nav.getByRole('link', {
            name: `Integracije${linkSuffix}`,
        });
        await expect(nav.getByRole('link')).toHaveCount(7);
        await expect(
            nav.getByRole('list', { name: 'Backoffice' }).getByRole('link'),
        ).toHaveCount(5);
        await expect(
            nav.getByRole('list', { name: 'Osobno' }).getByRole('link'),
        ).toHaveCount(2);
        await expect(general).toHaveAttribute('aria-current', 'location');

        const heading = page.getByRole('heading', {
            level: 2,
            name: 'Općenito',
        });
        const navBox = await nav.boundingBox();
        const headingBox = await heading.boundingBox();
        if (!navBox || !headingBox) {
            throw new Error('Expected the nav and content to be measurable');
        }
        expect(navBox.x + navBox.width).toBeLessThanOrEqual(headingBox.x);

        // Scrolling through the page moves the current link along.
        await page
            .getByRole('heading', { level: 2, name: 'Integracije' })
            .evaluate((element) => element.scrollIntoView());
        await expect(integrations).toHaveAttribute('aria-current', 'location');
        await expect(general).not.toHaveAttribute('aria-current');
        await expect(nav).toBeInViewport();
    });

    test('marks a short section near the end after jumping to it', async ({
        mount,
        page,
    }) => {
        await mount(<SettingsLayoutStory />);

        const nav = page.getByRole('navigation', { name: 'Odjeljci postavki' });
        const personal = nav.getByRole('link', {
            name: `Osobne obavijesti${linkSuffix}`,
        });
        const feedback = nav.getByRole('link', {
            name: `Povratne informacije${linkSuffix}`,
        });

        await personal.click();
        await expect(page).toHaveURL(/#personal-notification-settings$/);
        await expect(
            page.getByRole('heading', { level: 2, name: 'Osobne obavijesti' }),
        ).toBeInViewport();
        // The page is at its end, yet the section jumped to stays current.
        await expect(personal).toHaveAttribute('aria-current', 'location');
        await expect(feedback).not.toHaveAttribute('aria-current');

        await feedback.click();
        await expect(feedback).toHaveAttribute('aria-current', 'location');

        // Scrolling away by hand hands control back to the scroll position.
        await page.mouse.move(700, 450);
        await page.mouse.wheel(0, -20000);
        await expect(
            nav.getByRole('link', { name: `Općenito${linkSuffix}` }),
        ).toHaveAttribute('aria-current', 'location');
    });
});

test.describe('narrow screens', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('shows the section links as a sticky scrolling row', async ({
        mount,
        page,
    }) => {
        await mount(<SettingsLayoutStory />);

        const nav = page.getByRole('navigation', { name: 'Odjeljci postavki' });
        const heading = page.getByRole('heading', {
            level: 2,
            name: 'Općenito',
        });
        const navBox = await nav.boundingBox();
        const headingBox = await heading.boundingBox();
        if (!navBox || !headingBox) {
            throw new Error('Expected the nav and content to be measurable');
        }
        expect(navBox.y + navBox.height).toBeLessThanOrEqual(headingBox.y);

        // The page itself never scrolls sideways; only the link row does.
        const pageOverflows = await page.evaluate(
            () =>
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth,
        );
        expect(pageOverflows).toBe(false);

        const feedback = nav.getByRole('link', {
            name: `Povratne informacije${linkSuffix}`,
        });
        await expect(feedback).not.toBeInViewport();

        await page
            .getByRole('heading', { level: 2, name: 'Povratne informacije' })
            .evaluate((element) => element.scrollIntoView());

        // The row stays on screen and brings the current link into view.
        await expect(feedback).toHaveAttribute('aria-current', 'location');
        await expect(feedback).toBeInViewport();
        await expect(nav).toBeInViewport();

        // A section jumped to is not hidden behind the sticky row.
        await nav
            .getByRole('link', { name: `Kontrolna ploča${linkSuffix}` })
            .click();
        const dashboardHeading = page.getByRole('heading', {
            level: 2,
            name: 'Kontrolna ploča',
        });
        await expect(dashboardHeading).toBeInViewport();
        const stuckNavBox = await nav.boundingBox();
        const dashboardBox = await dashboardHeading.boundingBox();
        if (!stuckNavBox || !dashboardBox) {
            throw new Error('Expected the nav and heading to be measurable');
        }
        expect(dashboardBox.y).toBeGreaterThanOrEqual(
            stuckNavBox.y + stuckNavBox.height,
        );
    });
});
