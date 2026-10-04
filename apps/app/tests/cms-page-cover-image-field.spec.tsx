import { expect, test } from '@playwright/experimental-ct-react';
import { CmsPageCoverImageFieldStory } from './CmsPageCoverImageFieldStory';

test('marks a cover image point of interest and previews the crop', async ({
    mount,
}) => {
    const component = await mount(<CmsPageCoverImageFieldStory />);
    const picker = component.locator('[data-cms-cover-poi-picker]');
    await picker.evaluate((element) => {
        element.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);
        element.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                clientX: 80,
                clientY: 20,
                pointerType: 'mouse',
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
    await expect(component.getByRole('slider')).toHaveCount(2);
    await expect(
        component.getByRole('button', {
            name: 'Odaberi točku interesa na naslovnoj slici',
        }),
    ).toHaveCount(0);
    await expect(
        component.getByRole('img', {
            name: 'Pregled izreza naslovne slike',
        }),
    ).toHaveCSS('object-position', `${pointOfInterestX}% ${pointOfInterestY}%`);
});
