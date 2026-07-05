import { expect, test } from '@playwright/experimental-ct-react';
import { GardenDisplay2DStory } from './GardenDisplay2DStory';

test.describe('GardenDisplay2D', () => {
    test('keeps offset-focused stacks in the rendered viewport', async ({
        mount,
        page,
    }) => {
        await mount(<GardenDisplay2DStory />);

        await expect(page.getByAltText('Block_Grass')).toBeVisible();
    });
});
