import { expect, test } from '@playwright/experimental-ct-react';
import { BulkAssignRaisedBedHarness } from '../playwright/BulkAssignRaisedBedHarness';

// Matches the event the harness listens to for replacing its targets.
const bulkAssignTargetsEvent = 'bulk-assign-harness:operations';

const aleks = {
    id: 'aleks',
    userName: 'aleks@example.com',
    displayName: 'Aleks',
    avatarUrl: null,
};
const vesna = {
    id: 'vesna',
    userName: 'vesna@example.com',
    displayName: 'Vesna',
    avatarUrl: null,
};

function operation(id: number, assignmentRequired = false) {
    return {
        id,
        expectedEntityId: 10,
        expectedTaskVersionEventId: 20,
        farmUsers: [aleks, vesna],
        assignmentRequired,
    };
}

test('blocks saving when a selected user stops being eligible', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <BulkAssignRaisedBedHarness
            initialOperations={[operation(1), operation(2)]}
        />,
    );

    await component
        .getByRole('button', { name: 'Dodijeli korisnika svim zadacima' })
        .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: /Vesna/ }).check({
        force: true,
    });
    const save = dialog.getByRole('button', { name: 'Spremi dodjelu' });
    await expect(save).toBeEnabled();

    await page.evaluate(
        ({ eventName, operations }) =>
            window.dispatchEvent(
                new CustomEvent(eventName, { detail: operations }),
            ),
        {
            eventName: bulkAssignTargetsEvent,
            operations: [operation(1), { ...operation(2), farmUsers: [aleks] }],
        },
    );

    await expect(
        dialog.getByText('Neki odabrani korisnici više nisu dostupni'),
    ).toBeVisible();
    await expect(
        dialog.getByText('Više nije dostupan za sve zadatke. Ukloni odabir.'),
    ).toBeVisible();
    await expect(save).toBeDisabled();

    // Unchecking removes the unavailable row, so click rather than uncheck().
    await dialog.getByRole('checkbox', { name: /Vesna/ }).click({
        force: true,
    });
    await expect(dialog.getByRole('checkbox', { name: /Vesna/ })).toHaveCount(
        0,
    );
    await dialog.getByRole('checkbox', { name: /Aleks/ }).check({
        force: true,
    });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(component.getByTestId('submitted')).toHaveText('[aleks]');
});

test('requires a user when the group includes confirmed tasks', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <BulkAssignRaisedBedHarness
            initialOperations={[operation(1), operation(2, true)]}
        />,
    );

    await component
        .getByRole('button', { name: 'Dodijeli korisnika svim zadacima' })
        .click();
    const dialog = page.getByRole('dialog');
    await expect(
        dialog.getByText(
            'Potvrđeni zadaci (1) moraju ostati dodijeljeni, pa odaberi barem jednog korisnika.',
            { exact: false },
        ),
    ).toBeVisible();
    const save = dialog.getByRole('button', { name: 'Spremi dodjelu' });
    await expect(save).toBeDisabled();

    await dialog.getByRole('checkbox', { name: /Aleks/ }).check({
        force: true,
    });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(component.getByTestId('submitted')).toHaveText('[aleks]');
});

test('allows clearing all assignments when no task is confirmed', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <BulkAssignRaisedBedHarness
            initialOperations={[operation(1), operation(2)]}
        />,
    );

    await component
        .getByRole('button', { name: 'Dodijeli korisnika svim zadacima' })
        .click();
    const dialog = page.getByRole('dialog');
    await expect(
        dialog.getByText('Bez odabira se uklanjaju sve dodjele.', {
            exact: false,
        }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Spremi dodjelu' }).click();
    await expect(component.getByTestId('submitted')).toHaveText('[]');
});
