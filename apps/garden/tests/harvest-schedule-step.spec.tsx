import { expect, test } from '@playwright/experimental-ct-react';
import { HarvestScheduleStepStory } from './HarvestScheduleStepStory';

test('shows the summary and lets a valid flexible date be changed again', async ({
    mount,
    page,
}) => {
    await mount(<HarvestScheduleStepStory />);

    const carrotDate = page.getByLabel('Datum branja za Berba mrkve');
    const editDates = page.getByRole('button', { name: 'Uredi datume' });

    await expect(
        page.getByText(
            'Svi datumi branja usklađeni su s odabranim terminom dostave.',
        ),
    ).toBeVisible();
    await expect(carrotDate).toHaveCount(0);
    await expect(editDates).toBeVisible();

    await editDates.click();

    await expect(carrotDate).toHaveValue('2026-07-22');
    await expect(page.getByLabel('Datum branja za Berba salate')).toHaveCount(
        0,
    );
    await carrotDate.fill('2026-07-23');
    await page.getByRole('button', { name: 'Završi uređivanje' }).click();

    await expect(carrotDate).toHaveCount(0);
    await expect(
        page.getByText('Planirano branje: 23. srpnja 2026.'),
    ).toBeVisible();
    await expect(editDates).toBeVisible();
});

test('applies a suggested date and keeps it available for another manual edit', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await mount(<HarvestScheduleStepStory invalid />);

    const carrotDate = page.getByLabel('Datum branja za Berba mrkve');
    const confirm = page.getByRole('button', { name: 'Potvrdi i plati' });
    const output = page.getByLabel('Odabrani datumi branja');

    await expect(
        page.getByText('Provjeri označene datume prije plaćanja.', {
            exact: false,
        }),
    ).toBeVisible();
    await expect(carrotDate).toHaveValue('2026-07-20');
    await expect(
        page.getByText('Predloženi datum branja: 21. srpnja 2026.'),
    ).toBeVisible();
    await expect(
        page.getByText('Ispravi datume branja kako bi mogao nastaviti.'),
    ).toHaveCount(0);
    await expect(confirm).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Uredi datume' }),
    ).toHaveCount(0);
    await expect(page.getByLabel('Datum branja za Berba salate')).toHaveCount(
        0,
    );
    await expect(output).toContainText(
        '"cartItemId":71,"scheduledDate":"2026-07-24"',
    );

    await page
        .getByRole('button', {
            name: 'Primijeni predloženi datum za Berba mrkve',
        })
        .click();

    await expect(
        page.getByText(
            'Svi datumi branja usklađeni su s odabranim terminom dostave.',
        ),
    ).toBeVisible();
    await expect(carrotDate).toHaveCount(0);
    await expect(confirm).toBeEnabled();
    await expect(output).toContainText(
        '"cartItemId":72,"scheduledDate":"2026-07-21"',
    );

    await page.getByRole('button', { name: 'Uredi datume' }).click();

    await expect(carrotDate).toHaveValue('2026-07-21');
    await carrotDate.fill('2026-07-20');
    await expect(
        page.getByRole('button', { name: 'Završi uređivanje' }),
    ).toBeDisabled();
    await page
        .getByRole('button', {
            name: 'Primijeni predloženi datum za Berba mrkve',
        })
        .click();
    await expect(carrotDate).toHaveValue('2026-07-21');
    await carrotDate.fill('2026-07-23');
    await expect(output).toContainText(
        '"cartItemId":72,"scheduledDate":"2026-07-23"',
    );
    await page.getByRole('button', { name: 'Završi uređivanje' }).click();

    await expect(carrotDate).toHaveCount(0);
    await expect(
        page.getByText('Planirano branje: 23. srpnja 2026.'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Uredi datume' }),
    ).toBeVisible();
});

test('renders the existing checkout action when provided', async ({
    mount,
    page,
}) => {
    await mount(<HarvestScheduleStepStory withConfirmAction />);

    await expect(
        page.getByRole('button', { name: 'Postojeće plaćanje' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Potvrdi i plati' }),
    ).toHaveCount(0);
});
