import { expect, test } from '@playwright/experimental-ct-react';
import { FallenLogRotationFixture } from '../../../packages/game/tests/FallenLogRotationFixture';

test('fallen-log local rotation persists every legal quarter turn', async ({
    mount,
    page,
}) => {
    await mount(<FallenLogRotationFixture />);
    for (const rotation of [1, 2, 3, 4]) {
        await page.getByRole('button', { name: 'Okreni deblo' }).click();
        await expect(page.getByTestId('rotation')).toHaveText(String(rotation));
        await expect(page.getByTestId('rotation-error')).toBeEmpty();
        expect(
            await page.evaluate(() => {
                const stored = JSON.parse(
                    localStorage.getItem('fallen-log-rotation-clear') ?? '{}',
                );
                return stored.stacks
                    .flatMap(
                        (stack: {
                            blocks: { id: string; rotation: number }[];
                        }) => stack.blocks,
                    )
                    .find((block: { id: string }) => block.id === 'log')
                    ?.rotation;
            }),
        ).toBe(rotation);
    }
});

for (const obstacle of ['crate', 'raised'] satisfies ('crate' | 'raised')[]) {
    test(`fallen-log rotation preserves state when the second cell is ${obstacle}`, async ({
        mount,
        page,
    }) => {
        await mount(<FallenLogRotationFixture obstacle={obstacle} />);
        await page.getByRole('button', { name: 'Okreni deblo' }).click();
        await expect(page.getByTestId('rotation-error')).toContainText(
            'dva slobodna polja',
        );
        await expect(page.getByTestId('rotation')).toHaveText('0');
        expect(
            await page.evaluate(
                (key) => localStorage.getItem(key),
                `fallen-log-rotation-${obstacle}`,
            ),
        ).toBeNull();
    });
}
