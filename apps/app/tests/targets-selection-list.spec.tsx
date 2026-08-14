import { expect, test } from '@playwright/experimental-ct-react';
import { TargetsSelectionList } from '../app/admin/operations/TargetsSelectionList';

const gardens = [{ id: 7, name: 'Moj vrt', accountId: 'account-1' }];
const raisedBeds = [
    {
        id: 18,
        name: 'Sjeverna gredica',
        physicalId: '18',
        accountId: 'account-1',
        gardenId: 7,
        fields: [
            {
                id: 181,
                positionIndex: 0,
                hasActiveSelectedPlanting: false,
            },
            {
                id: 182,
                positionIndex: 1,
                hasActiveSelectedPlanting: true,
            },
        ],
    },
];

test('collapses raised beds by default for plant-field targets', async ({
    mount,
}) => {
    const component = await mount(
        <TargetsSelectionList
            farms={[]}
            gardens={gardens}
            raisedBeds={raisedBeds}
            mode="plant"
        />,
    );

    const raisedBedToggle = component.getByRole('button', {
        name: /Prikaži polja gredice 18/,
    });
    await expect(raisedBedToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(
        component.getByRole('checkbox', { name: 'Polje 1' }),
    ).not.toBeVisible();

    await raisedBedToggle.click();

    await expect(
        component.getByRole('button', {
            name: /Sakrij polja gredice 18/,
        }),
    ).toHaveAttribute('aria-expanded', 'true');
    await expect(
        component.getByRole('checkbox', { name: 'Polje 1' }),
    ).toBeVisible();
    await expect(
        component.getByRole('checkbox', {
            name: /Polje 2 Napredna sjetva/,
        }),
    ).toBeDisabled();
});

test('keeps raised-bed fields collapsible while allowing multiple targets', async ({
    mount,
}) => {
    const component = await mount(
        <TargetsSelectionList
            farms={[]}
            gardens={gardens}
            raisedBeds={raisedBeds}
        />,
    );

    const firstField = component.getByRole('checkbox', { name: 'Polje 1' });
    const secondField = component.getByRole('checkbox', {
        name: /Polje 2/,
    });
    const firstFieldInput = component.locator(
        'input[value="account-1|7|18|181"]',
    );
    await expect(firstField).toBeVisible();
    await expect(secondField).toBeVisible();

    await firstField.check();
    await secondField.check();
    await expect(firstField).toBeChecked();
    await expect(secondField).toBeChecked();

    const collapseButton = component.getByRole('button', {
        name: 'Sakrij polja gredice 18',
    });
    await collapseButton.click();
    await expect(firstField).not.toBeVisible();
    await expect(firstFieldInput).toBeChecked();
    await expect(
        component.getByRole('button', {
            name: 'Prikaži polja gredice 18',
        }),
    ).toHaveAttribute('aria-expanded', 'false');
});
