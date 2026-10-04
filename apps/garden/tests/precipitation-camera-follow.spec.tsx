import { expect, test } from '@playwright/experimental-ct-react';
import { PrecipitationCameraFollowFixture } from '../../../packages/game/tests/PrecipitationCameraFollowFixture';

test('keeps global precipitation on the character camera and local magic snow on its block', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<PrecipitationCameraFollowFixture />);

    await expect(fixture).toHaveAttribute('data-rain-position', '[2,0,3]');
    await expect(fixture).toHaveAttribute('data-snow-position', '[2,0,3]');
    await expect(fixture).toHaveAttribute(
        'data-local-snow-position',
        '[0,0,0]',
    );

    await page.getByRole('button', { name: 'Enter character mode' }).click();
    await expect(fixture).toHaveAttribute(
        'data-active-camera-position',
        '[10,3,-6]',
    );
    await expect(fixture).toHaveAttribute('data-rain-position', '[10,0,-6]');
    await expect(fixture).toHaveAttribute('data-snow-position', '[10,0,-6]');

    await page.getByRole('button', { name: 'Move character camera' }).click();
    await expect(fixture).toHaveAttribute(
        'data-active-camera-position',
        '[22,3,14]',
    );
    await expect(fixture).toHaveAttribute('data-rain-position', '[22,0,14]');
    await expect(fixture).toHaveAttribute('data-snow-position', '[22,0,14]');
    await expect(fixture).toHaveAttribute(
        'data-local-snow-position',
        '[0,0,0]',
    );
});
