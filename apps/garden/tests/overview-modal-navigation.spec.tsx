import { expect, test } from '@playwright/experimental-ct-react';
import { OverviewModalStory } from './OverviewModalStory';

test('opens billing from the settings modal navigation', async ({
    mount,
    page,
}) => {
    await mount(<OverviewModalStory />);

    const billingLink = page.getByRole('link', {
        name: 'Računi i plaćanja',
    });
    await expect(billingLink).toHaveAttribute('href', '/racun/naplata');
});
