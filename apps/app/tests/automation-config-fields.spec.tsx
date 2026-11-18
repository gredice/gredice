import { expect, test } from '@playwright/experimental-ct-react';
import { AutomationConfigFieldHarness } from '../playwright/AutomationConfigFieldHarness';

test('keeps a JSON draft while typing and applies it explicitly', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <AutomationConfigFieldHarness
            initialConfig={{ operations: [{ entityId: 1 }] }}
        />,
    );
    const config = component.getByTestId('config');
    const textarea = component.getByLabel('Operations');

    await textarea.fill('[\n  { "entityId": 2 },');
    await expect(textarea).toHaveValue('[\n  { "entityId": 2 },');
    await expect(component.getByRole('alert')).toHaveCount(0);
    await expect(config).toContainText('"entityId":1');

    await textarea.blur();
    await expect(component.getByRole('alert')).toContainText(
        'JSON nije valjan',
    );
    await expect(textarea).toHaveAttribute('aria-invalid', 'true');
    await expect(config).toContainText('"entityId":1');

    await component.getByRole('button', { name: 'Vrati spremljeno' }).click();
    await expect(component.getByRole('alert')).toHaveCount(0);

    await textarea.fill('[{ "entityId": 3 }]');
    await component.getByRole('button', { name: 'Primijeni' }).click();
    await expect(config).toContainText('"operations":[{"entityId":3}]');
    await expect(textarea).toHaveValue('[\n  {\n    "entityId": 3\n  }\n]');

    await textarea.fill('[]');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(config).toContainText('"operations":[]');
});

test('keeps an invalid JSON draft and its error when the panel reopens', async ({
    mount,
}) => {
    const component = await mount(
        <AutomationConfigFieldHarness
            initialConfig={{ operations: [{ entityId: 1 }] }}
        />,
    );
    const config = component.getByTestId('config');
    const draft = '[\n  { "entityId": 2 },';

    await component.getByLabel('Operations').fill(draft);
    await component.getByRole('button', { name: 'Zatvori panel' }).click();
    await expect(component.getByLabel('Operations')).toHaveCount(0);
    await expect(config).toContainText('"entityId":1');

    await component.getByRole('button', { name: 'Otvori panel' }).click();
    await expect(component.getByLabel('Operations')).toHaveValue(draft);
    await expect(component.getByRole('alert')).toContainText(
        'JSON nije valjan',
    );

    await component.getByRole('button', { name: 'Vrati spremljeno' }).click();
    await component.getByRole('button', { name: 'Zatvori panel' }).click();
    await component.getByRole('button', { name: 'Otvori panel' }).click();
    await expect(component.getByLabel('Operations')).toHaveValue(
        '[\n  {\n    "entityId": 1\n  }\n]',
    );
    await expect(component.getByRole('alert')).toHaveCount(0);
});

test('edits multiselect values with checkboxes and keeps aliases', async ({
    mount,
}) => {
    const component = await mount(
        <AutomationConfigFieldHarness
            initialConfig={{ daysOfWeek: ['Wednesday', 'fri'] }}
        />,
    );

    await expect(
        component.getByRole('checkbox', { name: 'Wednesday' }),
    ).toBeChecked();
    await expect(
        component.getByRole('checkbox', { name: 'Friday' }),
    ).toBeChecked();
    await expect(
        component.getByRole('checkbox', { name: 'Monday' }),
    ).not.toBeChecked();

    await component.getByRole('checkbox', { name: 'Tuesday' }).click();
    await expect(component.getByTestId('config')).toContainText(
        '"daysOfWeek":["tuesday","wednesday","friday"]',
    );
});

test('renders date, time, datetime and time zone inputs', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <AutomationConfigFieldHarness
            initialConfig={{
                anchorDate: '2026-01-05',
                timeZone: 'Europe/Zagreb',
            }}
        />,
    );
    const config = component.getByTestId('config');

    await expect(component.getByLabel('Start time')).toHaveAttribute(
        'type',
        'time',
    );
    await expect(component.getByLabel('Starts at')).toHaveAttribute(
        'type',
        'datetime-local',
    );
    await component.getByLabel('Start time').fill('08:30');
    await expect(config).toContainText('"startTime":"08:30"');

    const datePicker = component.getByRole('button', { name: /^Anchor date/ });
    await expect(datePicker).toContainText(/05\.\s?01\.\s?2026/);
    await datePicker.click();
    await expect(
        page.getByRole('table', { name: 'Dani u mjesecu' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Očisti datum' }).click();
    await expect(config).not.toContainText('anchorDate');

    await expect(component.getByText('Europe/Zagreb').first()).toBeVisible();
});
