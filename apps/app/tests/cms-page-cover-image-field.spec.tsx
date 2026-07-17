import { expect, test } from '@playwright/experimental-ct-react';
import { CmsPageCoverImageFieldStory } from './CmsPageCoverImageFieldStory';

test('marks a cover image point of interest and previews the crop', async ({
    mount,
}) => {
    const component = await mount(<CmsPageCoverImageFieldStory />);
    const picker = component.getByRole('button', {
        name: 'Odaberi točku interesa na naslovnoj slici',
    });
    await picker.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        element.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                clientX: bounds.left + bounds.width * 0.8,
                clientY: bounds.top + bounds.height * 0.2,
                detail: 1,
            }),
        );
    });

    const pointOfInterestX = await component
        .locator('input[name="metaImagePoiX"]')
        .inputValue();
    const pointOfInterestY = await component
        .locator('input[name="metaImagePoiY"]')
        .inputValue();
    expect(Number(pointOfInterestX)).toBeGreaterThan(50);
    await expect(
        component.getByRole('img', {
            name: 'Pregled izreza naslovne slike',
        }),
    ).toHaveCSS('object-position', `${pointOfInterestX}% ${pointOfInterestY}%`);
});
