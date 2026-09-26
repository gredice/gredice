import { expect, test } from '@playwright/experimental-ct-react';
import { AutumnBlanketBenchRotationFixture } from '../../../packages/game/tests/AutumnBlanketBenchRotationFixture';

test('autumn-blanket-bench local rotation persists every legal quarter turn', async ({
    mount,
    page,
}) => {
    await mount(<AutumnBlanketBenchRotationFixture />);
    for (const rotation of [1, 2, 3, 4]) {
        await page.getByRole('button', { name: 'Okreni klupu' }).click();
        await expect(page.getByTestId('rotation')).toHaveText(String(rotation));
        await expect(page.getByTestId('rotation-error')).toBeEmpty();
        expect(
            await page.evaluate(() => {
                const stored = JSON.parse(
                    localStorage.getItem(
                        'autumn-blanket-bench-rotation-clear',
                    ) ?? '{}',
                );
                return stored.stacks
                    .flatMap(
                        (stack: {
                            blocks: { id: string; rotation: number }[];
                        }) => stack.blocks,
                    )
                    .find((block: { id: string }) => block.id === 'bench')
                    ?.rotation;
            }),
        ).toBe(rotation);
    }
});

for (const obstacle of ['crate', 'raised'] satisfies ('crate' | 'raised')[]) {
    test(`autumn-blanket-bench rotation preserves state when the second cell is ${obstacle}`, async ({
        mount,
        page,
    }) => {
        await mount(<AutumnBlanketBenchRotationFixture obstacle={obstacle} />);
        await page.getByRole('button', { name: 'Okreni klupu' }).click();
        await expect(page.getByTestId('rotation-error')).toContainText(
            'dva slobodna polja',
        );
        await expect(page.getByTestId('rotation')).toHaveText('0');
        expect(
            await page.evaluate(
                (key) => localStorage.getItem(key),
                `autumn-blanket-bench-rotation-${obstacle}`,
            ),
        ).toBeNull();
    });
}
