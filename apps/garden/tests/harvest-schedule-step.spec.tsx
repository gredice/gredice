import { expect, test } from '@playwright/experimental-ct-react';
import { HarvestScheduleStepStory } from './HarvestScheduleStepStory';

test('shows only the summary when every date is already valid', async ({
    mount,
    page,
}) => {
    await mount(<HarvestScheduleStepStory />);

    await expect(
        page.getByText(
            'Svi datumi branja usklađeni su s odabranim terminom dostave.',
        ),
    ).toBeVisible();
    await expect(page.getByLabel('Datum branja za Berba mrkve')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Uredi datume' }),
    ).toHaveCount(0);
});

test('collects invalid flexible dates, keeps same-day crops fixed, and returns to summary', async ({
    mount,
    page,
}) => {
    await mount(<HarvestScheduleStepStory invalid />);

    await expect(
        page.getByText('Provjeri označene datume prije plaćanja.', {
            exact: false,
        }),
    ).toBeVisible();
    await expect(page.getByLabel('Datum branja za Berba mrkve')).toHaveValue(
        '2026-07-20',
    );
    await expect(page.getByLabel('Datum branja za Berba salate')).toHaveCount(
        0,
    );
    await expect(
        page.getByRole('button', { name: 'Uredi datume' }),
    ).toBeVisible();
    await expect(page.getByLabel('Odabrani datumi branja')).toContainText(
        '"cartItemId":71,"scheduledDate":"2026-07-24"',
    );

    await page.getByLabel('Datum branja za Berba mrkve').fill('2026-07-22');

    await expect(
        page.getByText(
            'Svi datumi branja usklađeni su s odabranim terminom dostave.',
        ),
    ).toBeVisible();
    await expect(page.getByLabel('Datum branja za Berba mrkve')).toHaveCount(0);
    await expect(page.getByLabel('Odabrani datumi branja')).toContainText(
        '"cartItemId":72,"scheduledDate":"2026-07-22"',
    );
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
