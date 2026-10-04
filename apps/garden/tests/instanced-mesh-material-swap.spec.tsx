import { expect, test } from '@playwright/experimental-ct-react';
import { InstancedMeshMaterialSwapFixture } from '../../../packages/game/tests/InstancedMeshMaterialSwapFixture';

test('preserves instance transforms when the material constructor argument changes', async ({
    mount,
    page,
}) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        browserErrors.push(error.message);
    });

    const fixture = await mount(<InstancedMeshMaterialSwapFixture />);
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const result = JSON.parse(
        (await fixture
            .getByTestId('instanced-mesh-material-swap-result')
            .textContent()) ?? '{}',
    );
    expect(result).toEqual({
        positions: [
            [2, 1, 3],
            [4, 2, 5],
        ],
        status: 'ready',
    });
    expect(browserErrors).toEqual([]);
});
