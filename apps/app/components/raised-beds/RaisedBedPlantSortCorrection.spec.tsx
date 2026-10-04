import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedPlantSortCorrectionHarness } from '../../playwright/RaisedBedPlantSortCorrectionHarness';

for (const selected of [false, true]) {
    test(`corrects ${selected ? 'selected' : 'legacy'} variety with pending feedback and exact identity`, async ({
        mount,
        page,
    }) => {
        await mount(
            <RaisedBedPlantSortCorrectionHarness selected={selected} />,
        );
        await page
            .getByRole('button', {
                name: 'Ispravi biljku ili sortu: Rajčica cherry',
            })
            .click();
        const save = page.getByRole('button', { name: 'Spremi ispravak' });
        await expect(save).toBeDisabled();
        await page.getByRole('combobox').click();
        await page
            .getByRole('option', { name: 'Rajčica saint pierre' })
            .click();
        await save.click();
        await expect(save).toBeDisabled();
        await expect(
            page.getByRole('button', { name: 'Odustani' }),
        ).toBeDisabled();
        const args = await page.evaluate(() =>
            JSON.parse(
                document.documentElement.dataset.plantSortCorrection ?? 'null',
            ),
        );
        expect(args[0]).toEqual(
            selected
                ? {
                      kind: 'selected',
                      plantingId: 7,
                      expectedPlantSortId: 50,
                      expectedLifecycleVersionEventId: 3,
                  }
                : {
                      kind: 'legacy',
                      raisedBedId: 12,
                      positionIndex: 13,
                      expectedPlantSortId: 50,
                      expectedPlantCycleEventId: 1,
                      expectedPlantCycleVersionEventId: 3,
                  },
        );
        expect(args[1]).toBe(51);
        await page.evaluate(() =>
            document.dispatchEvent(new Event('finish-correction')),
        );
        await expect(save).not.toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.dataset.correctionRefreshed,
            ),
        ).toBe('true');
    });
}

test('failed correction keeps the chosen sort and error available for retry', async ({
    mount,
    page,
}) => {
    await mount(<RaisedBedPlantSortCorrectionHarness />);
    await page.evaluate(() => {
        document.documentElement.dataset.failCorrection = 'true';
    });
    await page
        .getByRole('button', {
            name: 'Ispravi biljku ili sortu: Rajčica cherry',
        })
        .click();
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Bosiljak' }).click();
    await page.getByRole('button', { name: 'Spremi ispravak' }).click();
    await page.evaluate(() =>
        document.dispatchEvent(new Event('finish-correction')),
    );
    await expect(page.getByRole('alert')).toContainText(
        'Biljka se u međuvremenu promijenila.',
    );
    await expect(page.getByRole('combobox')).toContainText('Bosiljak');
    await expect(
        page.getByRole('button', { name: 'Spremi ispravak' }),
    ).toBeEnabled();
});
