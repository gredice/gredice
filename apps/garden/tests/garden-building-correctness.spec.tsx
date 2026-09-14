import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import {
    GardenStructureAuthoringInspectorsStory,
    GardenStructureBuildModeHistoryGuardStory,
    GardenStructureConflictResolutionStory,
    GardenStructureDemolitionFailureDialogStory,
    GardenStructureDraftExitDialogStory,
    GardenStructureExistingAutosaveStory,
    GardenStructureFootprintConfirmationStory,
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

test('offers confirmed drafts separate keep, discard, and continue actions', async ({
    mount,
    page,
}) => {
    await mount(<GardenStructureDraftExitDialogStory />);

    const dialog = page.getByRole('alertdialog', {
        name: 'Nespremljene promjene',
    });
    await expect(dialog).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Nastavi uređivati' }),
    ).toBeFocused();

    await dialog.getByRole('button', { name: 'Odbaci nacrt' }).click();
    await expect(page.getByTestId('draft-exit-action')).toHaveText('discard');

    await dialog.getByRole('button', { name: 'Sačuvaj nacrt i izađi' }).click();
    await expect(page.getByTestId('draft-exit-action')).toHaveText('keep');

    await dialog.getByRole('button', { name: 'Nastavi uređivati' }).click();
    await expect(page.getByTestId('draft-exit-action')).toHaveText('continue');
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

    await page.evaluate(() => window.history.back());
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.history.state?.__grediceGardenStructureBuildMode ??
                    null,
            ),
        )
        .not.toBeNull();
    const restoredMarker = await page.evaluate(
        () => window.history.state?.__grediceGardenStructureBuildMode ?? null,
    );
    const historyLengthBeforeRemount = await page.evaluate(
        () => window.history.length,
    );

    await mount(<GardenStructureBuildModeHistoryGuardStory />);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.history.state?.__grediceGardenStructureBuildMode ??
                    null,
            ),
        )
        .toBe(restoredMarker);
    await expect
        .poll(() => page.evaluate(() => window.history.length))
        .toBe(historyLengthBeforeRemount);
});

test('shows exact footprint impact and exposes explicit confirm and cancel controls', async ({
    mount,
    page,
}) => {
    await mount(<GardenStructureFootprintConfirmationStory />);

    const dialog = page.getByRole('alertdialog', {
        name: 'Potvrditi promjenu tlocrta?',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('63 / 100')).toBeVisible();
    await expect(dialog.getByText('9 × 8 / 20')).toBeVisible();
    await expect(dialog.getByText('3.150 🌻')).toBeVisible();
    await expect(dialog.getByText('550 🌻')).toBeVisible();
    await expect(dialog.getByText('0 🌻', { exact: true })).toBeVisible();

    await dialog.getByRole('button', { name: 'Potvrdi promjenu' }).click();
    await expect(page.getByTestId('footprint-confirmation-action')).toHaveText(
        'confirm',
    );
    await dialog.getByRole('button', { name: 'Vrati tlocrt' }).click();
    await expect(page.getByTestId('footprint-confirmation-action')).toHaveText(
        'cancel',
    );
});

test('shows only the selected authoring category and provides accessible prop target actions', async ({
    mount,
    page,
}) => {
    await mount(<GardenStructureAuthoringInspectorsStory />);

    await expect(page.getByText('Pod', { exact: true })).toBeVisible();
    await expect(page.getByText('Rubovi', { exact: true })).toBeVisible();
    await expect(page.getByText('Krov', { exact: true })).toHaveCount(0);
    await expect(
        page
            .getByRole('group', { name: 'Materijal poda' })
            .locator('img')
            .first(),
    ).toHaveAttribute('src', /\/v1\/catalog\/materials\//);
    await expect(
        page
            .getByRole('group', { name: 'Sjever rub polja' })
            .locator('img')
            .first(),
    ).toHaveAttribute('src', /\/v1\/catalog\/parts\//);

    await page.getByRole('button', { name: 'roof' }).click();
    await expect(page.getByText('Krov', { exact: true })).toBeVisible();
    await expect(page.getByText('Pod', { exact: true })).toHaveCount(0);
    await expect(
        page.getByRole('group', { name: 'Stil krova' }).locator('img').first(),
    ).toHaveAttribute('src', /\/v1\/catalog\/parts\//);
    await expect(
        page
            .getByRole('group', { name: 'Materijal krova' })
            .locator('img')
            .first(),
    ).toHaveAttribute('src', /\/v1\/catalog\/materials\//);
    const rotateRoof = page.getByRole('button', {
        name: 'Zakreni krov s 0 na 90 stupnjeva',
    });
    await expect(rotateRoof).toBeEnabled();
    expect(
        await rotateRoof.evaluate(
            (element) => element.getBoundingClientRect().height,
        ),
    ).toBeGreaterThanOrEqual(44);
    await rotateRoof.click();
    await expect(page.getByTestId('authoring-action')).toHaveText(
        'set-roof:1|1:1',
    );

    await page.getByRole('button', { name: 'interior' }).click();
    await expect(
        page.getByText('Namještaj i predmeti', { exact: true }),
    ).toBeVisible();
    await expect(
        page
            .getByRole('group', { name: 'Predmet', exact: true })
            .locator('img')
            .first(),
    ).toHaveAttribute('src', /\/v1\/catalog\/parts\//);
    await page
        .getByRole('group', { name: 'Predmet', exact: true })
        .locator('label:has(input[value$=":part:prop.planter"])')
        .click();
    await page
        .getByRole('button', { name: 'Zamijeni Table odabranim predmetom' })
        .click();
    await expect(page.getByTestId('authoring-action')).toHaveText(
        'replace:prop-table:prop.planter',
    );
    await page.getByRole('button', { name: 'Zakreni Table' }).click();
    await expect(page.getByTestId('authoring-action')).toHaveText(
        'rotate:prop-table:1',
    );

    await page.getByRole('button', { name: 'Dupliciraj Table' }).click();
    await expect(
        page.getByText('Odaberite prazno ciljno polje za kopiju predmeta.'),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Odustani od odabira cilja' })
        .click();
    await expect(
        page.getByText('Odaberite prazno ciljno polje za kopiju predmeta.'),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Dupliciraj Table' }).click();
    await page.getByLabel('Odabrano polje').selectOption('0|0');
    await expect(page.getByTestId('authoring-action')).toHaveText(
        'duplicate:prop-table:0|0',
    );
    await page.getByLabel('Odabrano polje').selectOption('1|1');
    await page.getByRole('button', { name: 'Premjesti Table' }).click();
    await expect(
        page.getByText(
            'Odaberite drugo ciljno polje za premještanje predmeta.',
        ),
    ).toBeVisible();
    await page.getByLabel('Odabrano polje').selectOption('0|0');
    await expect(page.getByTestId('authoring-action')).toHaveText(
        'move:prop-table:0|0',
    );

    await page.getByRole('button', { name: 'footprint' }).click();
    await expect(
        page.getByRole('region', { name: 'Uređivanje tlocrta' }),
    ).toBeVisible();
    await page
        .getByRole('button', { name: /Dodaj unutarnje polje/ })
        .first()
        .click();
    await expect(page.getByTestId('authoring-action')).toContainText('add:');
});

test('debounces existing-structure autosave to the latest exact snapshot', async ({
    mount,
    page,
}) => {
    await mount(<GardenStructureExistingAutosaveStory />);

    const edit = page.getByRole('button', { name: 'Promijeni položaj' });
    await edit.click();
    await edit.click();
    await expect(page.getByTestId('autosave-attempts')).toHaveText('2');
});

test('uses the latest committed autosave callback while a save is pending', async ({
    mount,
    page,
}) => {
    await mount(<GardenStructureExistingAutosaveStory />);

    await page.getByRole('button', { name: 'Promijeni položaj' }).click();
    await page
        .getByRole('button', { name: 'Promijeni autosave obradu' })
        .click();
    await expect(page.getByTestId('autosave-attempts')).toHaveText('1');
    await expect(page.getByTestId('autosave-callback-revision')).toHaveText(
        '1',
    );
});

test('cancels a pending autosave when the editor session changes to a new draft', async ({
    mount,
    page,
}) => {
    await mount(<GardenStructureExistingAutosaveStory />);

    await page.getByRole('button', { name: 'Promijeni položaj' }).click();
    await page.getByRole('button', { name: 'Otvori novi nacrt' }).click();
    await page.waitForTimeout(150);
    await expect(page.getByTestId('autosave-attempts')).toHaveText('none');
});
