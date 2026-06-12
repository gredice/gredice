import { expect, test } from '@playwright/experimental-ct-react';
import { UserBirthdayCardStory } from './UserBirthdayCardStory';

test.describe('User birthday card', () => {
    test('sizes birthday inputs across the profile modal width', async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 1000, height: 700 });
        await mount(<UserBirthdayCardStory />);

        const dayBox = await page.getByLabel('Dan').boundingBox();
        const monthBox = await page.getByLabel('Mjesec').boundingBox();
        const yearBox = await page
            .getByLabel('Godina (nije obavezna)')
            .boundingBox();
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
});
