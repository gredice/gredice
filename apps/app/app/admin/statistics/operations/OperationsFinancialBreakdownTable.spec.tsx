import { expect, test } from '@playwright/experimental-ct-react';
import { OperationsFinancialBreakdownTable } from './OperationsFinancialBreakdownTable';

test.use({ viewport: { width: 390, height: 844 } });

test('renders task financial totals in a horizontally scrollable mobile table', async ({
    mount,
}) => {
    const component = await mount(
        <OperationsFinancialBreakdownTable
            data={{
                rows: [
                    {
                        key: 'operation:12',
                        label: 'Zalijevanje',
                        taskCount: 2,
                        totalDurationMinutes: 80,
                        farmerCost: 1.5,
                        materialCost: 0.75,
                        userCost: 4,
                        estimatedEarnings: 1.75,
                        missingFarmerPriceCount: 0,
                        missingUserPriceCount: 0,
                        incompleteEarningsCount: 0,
                    },
                ],
                totals: {
                    taskCount: 2,
                    totalDurationMinutes: 80,
                    farmerCost: 1.5,
                    materialCost: 0.75,
                    userCost: 4,
                    estimatedEarnings: 1.75,
                    missingFarmerPriceCount: 0,
                    missingUserPriceCount: 0,
                    incompleteEarningsCount: 0,
                },
            }}
        />,
    );

    await expect(
        component.getByRole('heading', {
            name: 'Radnje i sijanja po vrsti',
        }),
    ).toBeVisible();
    await expect(
        component.getByRole('columnheader', { name: 'Broj zadataka' }),
    ).toBeVisible();
    await expect(
        component.getByRole('columnheader', { name: 'Trošak materijala' }),
    ).toBeVisible();
    await expect(
        component.getByRole('cell', { name: 'Zalijevanje' }),
    ).toBeVisible();
    await expect(
        component.getByRole('row', { name: /Ukupno 2 1 h 20 min 1\.50€/ }),
    ).toBeAttached();

    const overflow = await component.locator('table').evaluate((table) => {
        const scrollContainer = table.parentElement;
        return {
            clientWidth: scrollContainer?.clientWidth ?? 0,
            scrollWidth: scrollContainer?.scrollWidth ?? 0,
        };
    });
    expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
});

test('shows incomplete pricing warnings and an empty state', async ({
    mount,
}) => {
    const incomplete = await mount(
        <OperationsFinancialBreakdownTable
            data={{
                rows: [
                    {
                        key: 'sowing',
                        label: 'Sijanje (direktno)',
                        taskCount: 1,
                        totalDurationMinutes: 5,
                        farmerCost: 0,
                        materialCost: 0,
                        userCost: 1.25,
                        estimatedEarnings: 0,
                        missingFarmerPriceCount: 1,
                        missingUserPriceCount: 0,
                        incompleteEarningsCount: 1,
                    },
                ],
                totals: {
                    taskCount: 1,
                    totalDurationMinutes: 5,
                    farmerCost: 0,
                    materialCost: 0,
                    userCost: 1.25,
                    estimatedEarnings: 0,
                    missingFarmerPriceCount: 1,
                    missingUserPriceCount: 0,
                    incompleteEarningsCount: 1,
                },
            }}
        />,
    );

    await expect(incomplete.getByText('1 zadatak bez cijene')).toHaveCount(2);
    await expect(
        incomplete.getByText('1 zadatak bez potpunog izračuna'),
    ).toHaveCount(2);

    await incomplete.unmount();
    const empty = await mount(
        <OperationsFinancialBreakdownTable
            data={{
                rows: [],
                totals: {
                    taskCount: 0,
                    totalDurationMinutes: 0,
                    farmerCost: 0,
                    materialCost: 0,
                    userCost: 0,
                    estimatedEarnings: 0,
                    missingFarmerPriceCount: 0,
                    missingUserPriceCount: 0,
                    incompleteEarningsCount: 0,
                },
            }}
        />,
    );

    await expect(
        empty.getByText(
            'Nema završenih radnji ni verificiranih sijanja u odabranom razdoblju.',
        ),
    ).toBeVisible();
});
