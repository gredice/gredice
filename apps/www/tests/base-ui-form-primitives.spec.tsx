import { Checkbox } from '@gredice/ui/Checkbox';
import { Progress } from '@gredice/ui/Progress';
import { Slider } from '@gredice/ui/Slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@gredice/ui/Tabs';
import { expect, test } from '@playwright/experimental-ct-react';
import '../app/globals.css';

test('preserves checkbox indeterminate and native form behavior', async ({
    mount,
    page,
}) => {
    await mount(
        <form data-testid="form">
            <Checkbox
                defaultChecked="indeterminate"
                label="Uključi gredicu"
                name="garden"
                required
                value="included"
            />
            <Checkbox defaultChecked label="Zaključana postavka" readOnly />
            <Checkbox disabled label="Nedostupna postavka" />
        </form>,
    );

    const checkbox = page.getByRole('checkbox', { name: 'Uključi gredicu' });
    const checkboxRoot = page.locator('[data-indeterminate]');
    const readOnly = page.getByRole('checkbox', {
        name: 'Zaključana postavka',
    });
    const disabled = page.getByRole('checkbox', {
        name: 'Nedostupna postavka',
    });

    await expect(checkboxRoot).toHaveCount(2);
    await expect(checkbox).toHaveAttribute('aria-required', 'true');
    await readOnly.click();
    await expect(readOnly).toBeChecked();
    await expect(disabled).toBeDisabled();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(page.locator('[data-indeterminate]')).toHaveCount(0);
    expect(
        await page.getByTestId('form').evaluate((form) => {
            if (!(form instanceof HTMLFormElement)) {
                return null;
            }

            return new FormData(form).get('garden');
        }),
    ).toBe('included');
});

test('exposes bounded and indeterminate progress states', async ({
    mount,
    page,
}) => {
    await mount(
        <div>
            <Progress aria-label="Dovršeno" value={140} />
            <Progress aria-label="Obrada" value={null} />
        </div>,
    );

    const complete = page.getByRole('progressbar', { name: 'Dovršeno' });
    const indeterminate = page.getByRole('progressbar', { name: 'Obrada' });

    await expect(complete).toHaveAttribute('aria-valuenow', '100');
    await expect(complete).toHaveAttribute('data-complete', '');
    await expect(indeterminate).not.toHaveAttribute('aria-valuenow');
    await expect(indeterminate).toHaveAttribute('data-indeterminate', '');
});

test('keeps slider array values and keyboard controls', async ({
    mount,
    page,
}) => {
    await mount(
        <div className="space-y-8">
            <Slider
                aria-label="Glasnoća"
                defaultValue={[40]}
                max={100}
                min={0}
                step={5}
            />
            <Slider
                aria-label="Raspon"
                defaultValue={[20, 80]}
                max={100}
                min={0}
                step={5}
            />
        </div>,
    );

    const slider = page.getByRole('slider', { name: 'Glasnoća' });
    const range = page.getByRole('slider', { name: 'Raspon' });

    await expect(range).toHaveCount(2);
    await expect(range.nth(0)).toHaveValue('20');
    await expect(range.nth(1)).toHaveValue('80');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('45');
    await page.keyboard.press('Home');
    await expect(slider).toHaveValue('0');
    await page.keyboard.press('End');
    await expect(slider).toHaveValue('100');
});

test('preserves inverted slider values for accessibility and forms', async ({
    mount,
    page,
}) => {
    await mount(
        <form data-testid="inverted-form">
            <Slider
                aria-label="Obrnuti raspon"
                defaultValue={[20, 80]}
                inverted
                name="horizontal"
                step={5}
            />
            <div className="h-56">
                <Slider
                    aria-label="Obrnuta visina"
                    defaultValue={[20]}
                    inverted
                    name="vertical"
                    orientation="vertical"
                    step={5}
                />
            </div>
        </form>,
    );

    const horizontal = page.getByRole('slider', {
        name: 'Obrnuti raspon',
    });
    const vertical = page.getByRole('slider', { name: 'Obrnuta visina' });

    await expect(horizontal).toHaveCount(2);
    await expect(horizontal.nth(0)).toHaveAttribute('aria-valuenow', '20');
    await expect(horizontal.nth(1)).toHaveAttribute('aria-valuenow', '80');
    await expect(vertical).toHaveAttribute('aria-valuenow', '20');
    expect(
        await page.getByTestId('inverted-form').evaluate((form) => {
            if (!(form instanceof HTMLFormElement)) {
                return null;
            }

            const data = new FormData(form);
            return {
                horizontal: data.getAll('horizontal'),
                vertical: data.getAll('vertical'),
            };
        }),
    ).toEqual({ horizontal: ['20', '80'], vertical: ['20'] });

    await horizontal.nth(0).focus();
    await page.keyboard.press('ArrowRight');
    await expect(horizontal.nth(0)).toHaveAttribute('aria-valuenow', '15');

    await vertical.focus();
    await page.keyboard.press('ArrowUp');
    await expect(vertical).toHaveAttribute('aria-valuenow', '15');
    expect(
        await page.getByTestId('inverted-form').evaluate((form) => {
            if (!(form instanceof HTMLFormElement)) {
                return null;
            }

            const data = new FormData(form);
            return {
                horizontal: data.getAll('horizontal'),
                vertical: data.getAll('vertical'),
            };
        }),
    ).toEqual({ horizontal: ['15', '80'], vertical: ['15'] });
});

test('keeps automatic and manual tabs activation plus mounted panels', async ({
    mount,
    page,
}) => {
    await mount(
        <div className="space-y-8">
            <Tabs defaultValue="overview">
                <TabsList aria-label="Automatski tabovi">
                    <TabsTrigger value="overview">Pregled</TabsTrigger>
                    <TabsTrigger value="calendar">Kalendar</TabsTrigger>
                    <TabsTrigger disabled value="history">
                        Povijest
                    </TabsTrigger>
                </TabsList>
                <TabsContent forceMount value="overview">
                    Sadržaj pregleda
                </TabsContent>
                <TabsContent forceMount value="calendar">
                    Sadržaj kalendara
                </TabsContent>
            </Tabs>
            <Tabs activationMode="manual" defaultValue="one">
                <TabsList aria-label="Ručni tabovi">
                    <TabsTrigger value="one">Jedan</TabsTrigger>
                    <TabsTrigger value="two">Dva</TabsTrigger>
                </TabsList>
                <TabsContent value="one">Prvi sadržaj</TabsContent>
                <TabsContent value="two">Drugi sadržaj</TabsContent>
            </Tabs>
        </div>,
    );

    const automaticTabs = page.getByRole('tablist', {
        name: 'Automatski tabovi',
    });
    const overview = automaticTabs.getByRole('tab', { name: 'Pregled' });
    const calendar = automaticTabs.getByRole('tab', { name: 'Kalendar' });

    await overview.focus();
    await expect(automaticTabs.getByRole('presentation')).toHaveCount(1);
    await expect(automaticTabs.getByRole('presentation')).not.toHaveAttribute(
        'hidden',
    );
    await page.keyboard.press('ArrowRight');
    await expect(calendar).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Sadržaj pregleda')).toBeHidden();
    await expect(page.getByText('Sadržaj kalendara')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(calendar).toHaveAttribute('aria-selected', 'true');
    await expect(
        automaticTabs.getByRole('tab', { name: 'Povijest' }),
    ).toHaveAttribute('aria-selected', 'false');

    const manualTabs = page.getByRole('tablist', { name: 'Ručni tabovi' });
    const one = manualTabs.getByRole('tab', { name: 'Jedan' });
    const two = manualTabs.getByRole('tab', { name: 'Dva' });

    await one.focus();
    await page.keyboard.press('ArrowRight');
    await expect(two).toBeFocused();
    await expect(one).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(two).toHaveAttribute('aria-selected', 'true');
});
