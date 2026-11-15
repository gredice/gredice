import { expect, test } from '@playwright/experimental-ct-react';
import { AutomationDetailLayoutStory } from './AutomationDetailLayoutStory';

test.describe('narrow screens', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('switches between the editor and executions with tabs', async ({
        mount,
        page,
    }) => {
        await mount(<AutomationDetailLayoutStory />);

        const editorTab = page.getByRole('tab', { name: 'Uređivač' });
        const runsTab = page.getByRole('tab', { name: 'Izvršavanja' });

        await expect(editorTab).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByTestId('editor')).toBeVisible();
        await expect(page.getByTestId('runs')).toBeHidden();

        await runsTab.click();

        await expect(runsTab).toHaveAttribute('aria-selected', 'true');
        await expect(
            page.getByRole('tabpanel', { name: 'Izvršavanja' }),
        ).toBeVisible();
        await expect(page.getByTestId('runs')).toBeVisible();
        await expect(page.getByTestId('editor')).toBeHidden();
        // The editor stays mounted so unsaved graph state survives the switch.
        await expect(page.getByTestId('editor')).toHaveCount(1);
    });

    test('editor slide panels still open while executions are shown', async ({
        mount,
        page,
    }) => {
        const component = await mount(<AutomationDetailLayoutStory />);

        await page.getByRole('tab', { name: 'Izvršavanja' }).click();
        await expect(page.getByTestId('editor')).toBeHidden();

        await component.update(<AutomationDetailLayoutStory editorPanelOpen />);

        await expect(page.getByText('Postavke automatizacije')).toBeVisible();
    });
});

test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('shows executions beside the editor at the editor height', async ({
        mount,
        page,
    }) => {
        await mount(<AutomationDetailLayoutStory />);

        await expect(page.getByRole('tablist')).toBeHidden();

        const editor = page.getByTestId('editor');
        const runs = page.getByTestId('runs');
        await expect(editor).toBeVisible();
        await expect(runs).toBeVisible();

        const editorBox = await editor.boundingBox();
        const runsBox = await runs.boundingBox();
        if (!editorBox || !runsBox) {
            throw new Error('Expected both panels to be measurable');
        }

        expect(runsBox.x).toBeGreaterThanOrEqual(editorBox.x + editorBox.width);
        expect(Math.abs(runsBox.y - editorBox.y)).toBeLessThan(1);
        expect(runsBox.height).toBeLessThanOrEqual(editorBox.height + 1);

        const runsList = page.getByTestId('runs-list');
        const scrolls = await runsList.evaluate(
            (element) => element.scrollHeight > element.clientHeight,
        );
        expect(scrolls).toBe(true);
    });
});
