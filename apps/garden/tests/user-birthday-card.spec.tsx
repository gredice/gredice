import { expect, test } from '@playwright/experimental-ct-react';
import { UserBirthdayCardStory } from './UserBirthdayCardStory';

test.describe('User birthday card', () => {
    test('sizes birthday inputs across the profile modal width', async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 1000, height: 700 });
        await mount(<UserBirthdayCardStory />);

        const dayBox = await page.getByLabel('Dan *').boundingBox();
        const monthBox = await page.getByLabel('Mjesec *').boundingBox();
        const yearBox = await page.getByLabel('Godina').boundingBox();
        const frameBox = await page
            .getByTestId('birthday-card-frame')
            .boundingBox();

        expect(dayBox).not.toBeNull();
        expect(monthBox).not.toBeNull();
        expect(yearBox).not.toBeNull();
        expect(frameBox).not.toBeNull();

        if (!dayBox || !monthBox || !yearBox || !frameBox) {
            throw new Error('Birthday card fields did not render.');
        }

        expect(dayBox.width).toBeGreaterThanOrEqual(100);
        expect(monthBox.width).toBeGreaterThanOrEqual(100);
        expect(yearBox.width).toBeGreaterThanOrEqual(200);
        expect(yearBox.x + yearBox.width).toBeLessThanOrEqual(
            frameBox.x + frameBox.width,
        );
    });

    test('keeps birthday inputs in one row on mobile and marks required fields', async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 700 });
        await mount(<UserBirthdayCardStory />);

        const dayInput = page.getByLabel('Dan *');
        const monthInput = page.getByLabel('Mjesec *');
        const yearInput = page.getByLabel('Godina');
        const [dayBox, monthBox, yearBox, frameBox] = await Promise.all([
            dayInput.boundingBox(),
            monthInput.boundingBox(),
            yearInput.boundingBox(),
            page.getByTestId('birthday-card-frame').boundingBox(),
        ]);

        expect(dayBox).not.toBeNull();
        expect(monthBox).not.toBeNull();
        expect(yearBox).not.toBeNull();
        expect(frameBox).not.toBeNull();
        expect(await dayInput.getAttribute('required')).not.toBeNull();
        expect(await monthInput.getAttribute('required')).not.toBeNull();
        expect(await yearInput.getAttribute('required')).toBeNull();

        if (!dayBox || !monthBox || !yearBox || !frameBox) {
            throw new Error('Birthday card fields did not render.');
        }

        expect(Math.abs(dayBox.y - monthBox.y)).toBeLessThan(1);
        expect(Math.abs(dayBox.y - yearBox.y)).toBeLessThan(1);
        expect(dayBox.x).toBeLessThan(monthBox.x);
        expect(monthBox.x).toBeLessThan(yearBox.x);
        expect(yearBox.x + yearBox.width).toBeLessThanOrEqual(
            frameBox.x + frameBox.width,
        );
    });
});
