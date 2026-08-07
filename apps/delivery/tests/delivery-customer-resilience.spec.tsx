import { expect, test } from '@playwright/experimental-ct-react';
import {
    CustomerDashboardResilienceStory,
    InitialDashboardErrorStateStory,
    InitialDashboardErrorStory,
} from './CustomerDashboardResilienceStory';
import '../app/globals.css';

test('announces an initial failure and offers a truthful retry state', async ({
    mount,
    page,
}) => {
    await mount(<InitialDashboardErrorStory />);

    await expect(page.getByRole('alert')).toContainText(
        'Dostave nisu dostupne',
    );
    const retry = page.getByRole('button', { name: 'Pokušaj ponovno' });
    await retry.click();
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveAttribute('aria-busy', 'true');
    await expect(retry).toContainText('Pokušaj u tijeku');
    await expect(page.getByTestId('initial-retry-attempts')).toHaveText('1');
    await expect(retry).toBeEnabled();
});

test('keeps the initial failure alert stable while retry progress is announced politely', async ({
    mount,
    page,
}) => {
    const component = await mount(<InitialDashboardErrorStateStory />);
    const alert = page.getByRole('alert');
    const initialAlertMarkup = await alert.innerHTML();

    await component.update(<InitialDashboardErrorStateStory retrying />);

    expect(await alert.innerHTML()).toBe(initialAlertMarkup);
    await expect(
        page.getByRole('status').filter({
            hasText: 'Ponovno učitavanje dostava je u tijeku.',
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toBeDisabled();
});

test('keeps an offline initial retry truthful until connectivity returns', async ({
    mount,
    page,
}) => {
    await mount(
        <InitialDashboardErrorStateStory retryUnavailableMessage="Ponovni pokušaj bit će dostupan kada se internetska veza obnovi." />,
    );

    await expect(
        page.getByRole('button', {
            name: 'Pokušaj ponovno nije dostupan bez internetske veze',
        }),
    ).toBeDisabled();
    await expect(
        page.getByText(
            'Ponovni pokušaj bit će dostupan kada se internetska veza obnovi.',
            { exact: true },
        ),
    ).toBeVisible();
});

test('keeps last-known customer content visible with refresh failure context', async ({
    mount,
    page,
}) => {
    await mount(<CustomerDashboardResilienceStory />);

    await expect(
        page.getByText('Rajčica iz spremljenog prikaza', { exact: true }),
    ).toBeVisible();
    const warning = page.getByRole('alert');
    await expect(warning).toContainText('Prikazujemo zadnje potvrđene podatke');
    await expect(warning.locator('time')).toHaveAttribute(
        'datetime',
        '2026-07-16T09:15:00.000Z',
    );
    await expect(
        page.getByRole('button', { name: 'Osvježi podatke' }),
    ).toBeVisible();
});

test('marks an offline cached dashboard without replacing its content', async ({
    mount,
    page,
}) => {
    await mount(<CustomerDashboardResilienceStory failure="offline" />);

    await expect(
        page.getByText('Rajčica iz spremljenog prikaza', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(
        'Uređaj je izvan mreže',
    );
});

test('retries in place and focuses the recovered state after a user action', async ({
    mount,
    page,
}) => {
    await mount(<CustomerDashboardResilienceStory />);

    const retry = page.getByRole('button', { name: 'Osvježi podatke' });
    const alert = page.getByRole('alert');
    const initialAlertMarkup = await alert.innerHTML();
    await retry.click();
    await expect(retry).toBeDisabled();
    await expect(retry).toHaveAttribute('aria-busy', 'true');
    await expect(retry).toContainText('Osvježavanje');
    expect(await alert.innerHTML()).toBe(initialAlertMarkup);

    const recovered = page.getByRole('status', {
        name: 'Podaci su ponovno ažurni',
    });
    await expect(recovered).toBeVisible();
    await expect(recovered).toBeFocused();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(
        page.getByText('Rajčica iz spremljenog prikaza', { exact: true }),
    ).toBeVisible();
});

test('automatic recovery announces politely without stealing focus', async ({
    mount,
    page,
}) => {
    const component = await mount(<CustomerDashboardResilienceStory />);
    await expect(page.getByRole('alert')).toBeVisible();
    const traceLink = page.getByRole('link', {
        name: 'Otvori trag uroda: Rajčica iz spremljenog prikaza',
    });
    await traceLink.focus();
    await expect(traceLink).toBeFocused();

    await component.update(<CustomerDashboardResilienceStory failure={null} />);

    const recovered = page.getByRole('status', {
        name: 'Podaci su ponovno ažurni',
    });
    await expect(recovered).toBeVisible();
    await expect(recovered).not.toBeFocused();
    await expect(traceLink).toBeFocused();
    await expect(page.getByRole('alert')).toHaveCount(0);
});

test('failed retry leaves the cached dashboard and recovery action available', async ({
    mount,
    page,
}) => {
    await mount(<CustomerDashboardResilienceStory retrySucceeds={false} />);

    const retry = page.getByRole('button', { name: 'Osvježi podatke' });
    await retry.click();

    await expect(retry).toBeEnabled();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
        page.getByRole('status', {
            name: 'Osvježavanje nije uspjelo',
        }),
    ).toContainText('Spremljeni podaci ostaju prikazani');
    await expect(
        page.getByText('Rajčica iz spremljenog prikaza', { exact: true }),
    ).toBeVisible();
});
