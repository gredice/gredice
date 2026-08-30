import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import {
    GardenStructureBuildModeHistoryGuardStory,
    GardenStructureConflictResolutionStory,
    GardenStructureDemolitionFailureDialogStory,
} from './GardenStructureBuildModeCorrectnessStory';

async function pressSystemBackInMountedComponent(activeState: Locator) {
    await activeState.evaluate(() => window.history.back());
}

test('makes both revision-conflict resolutions actionable and explains their consequences', async ({
    mount,
    page,
}) => {
    await mount(<GardenStructureConflictResolutionStory />);

    await expect(
        page.getByText(/uključujući njezin položaj i važeću cijenu/),
    ).toBeVisible();
    await expect(page.getByText(/naplaćuje se puna cijena/)).toBeVisible();
    await expect(
        page.getByTestId('garden-structure-conflict-error'),
    ).toHaveText('Najnoviju građevinu trenutačno nije moguće učitati.');

    await page.getByTestId('garden-structure-conflict-reload').click();
    await expect(page.getByTestId('conflict-action')).toHaveText('reload');
    await page.getByTestId('garden-structure-conflict-save-draft').click();
    await expect(page.getByTestId('conflict-action')).toHaveText(
        'save-as-draft',
    );
});

test('shows demolition failures visibly inside the confirmation dialog', async ({
    mount,
    page,
}) => {
    await mount(<GardenStructureDemolitionFailureDialogStory />);

    const dialog = page.getByRole('alertdialog', {
        name: 'Srušiti građevinu?',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('alert')).toHaveText(
        'Rušenje trenutačno nije moguće dovršiti.',
    );
    await expect(dialog.getByRole('button', { name: 'Ne ruši' })).toBeFocused();
});

test('system Back unwinds confirmation and tool before blocking dirty exit, then closes acknowledged state', async ({
    mount,
    page,
}) => {
    await mount(<GardenStructureBuildModeHistoryGuardStory />);

    const activeState = page.getByTestId('history-active');
    await pressSystemBackInMountedComponent(activeState);
    await expect(page.getByTestId('history-confirmation')).toHaveText(
        'confirmation-closed',
    );
    await expect(page.getByTestId('history-active')).toHaveText('active');

    await pressSystemBackInMountedComponent(activeState);
    await expect(page.getByTestId('history-tool')).toHaveText('tool-closed');
    await expect(page.getByTestId('history-active')).toHaveText('active');

    await pressSystemBackInMountedComponent(activeState);
    await expect(page.getByTestId('history-blocked')).toHaveText(
        'exit-blocked',
    );
    await expect(page.getByTestId('history-active')).toHaveText('active');

    await page.getByRole('button', { name: 'Use acknowledged state' }).click();
    await pressSystemBackInMountedComponent(activeState);
    await expect(page.getByTestId('history-active')).toHaveText('closed');

    await page.getByRole('button', { name: 'Reopen build mode' }).click();
    await expect(page.getByTestId('history-active')).toHaveText('active');
    await page
        .getByRole('button', { name: 'Close build mode normally' })
        .click();
    await expect(page.getByTestId('history-active')).toHaveText('closed');
    await page.getByRole('button', { name: 'Reopen build mode' }).click();
    await expect(page.getByTestId('history-active')).toHaveText('active');
    await pressSystemBackInMountedComponent(activeState);
    await expect(page.getByTestId('history-active')).toHaveText('closed');
});

test('unmounting active Build Mode releases its synthetic history entry', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <GardenStructureBuildModeHistoryGuardStory />,
    );

    await expect(page.getByTestId('history-active')).toHaveText('active');
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.history.state?.__grediceGardenStructureBuildMode ??
                    null,
            ),
        )
        .not.toBeNull();

    await component.unmount();

    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.history.state?.__grediceGardenStructureBuildMode ??
                    null,
            ),
        )
        .toBeNull();
});

test('unmounting Build Mode does not pop a newer client-side route entry', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <GardenStructureBuildModeHistoryGuardStory />,
    );

    await expect(page.getByTestId('history-active')).toHaveText('active');
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.history.state?.__grediceGardenStructureBuildMode ??
                    null,
            ),
        )
        .not.toBeNull();

    await page.evaluate(() => {
        window.history.pushState(
            { routeTransition: 'destination' },
            '',
            window.location.href,
        );
    });
    await component.unmount();
    await page.waitForTimeout(100);

    await expect
        .poll(() =>
            page.evaluate(() => window.history.state?.routeTransition ?? null),
        )
        .toBe('destination');
});
