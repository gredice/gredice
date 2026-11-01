import { expect, test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import { RigidFaunaBatchFixture } from '../../../packages/game/tests/RigidFaunaBatchFixture';
import {
    getAppByName,
    getPlaywrightBaseUrl,
} from '../../../scripts/app-registry';

const appBaseUrl = getPlaywrightBaseUrl(getAppByName('garden'));

const qualities: NonNullable<
    Parameters<typeof RigidFaunaBatchFixture>[0]['quality']
>[] = ['low', 'medium', 'high', 'auto'];

function readReceipt(raw: string | null) {
    const value: unknown = JSON.parse(raw ?? '{}');
    if (
        !value ||
        typeof value !== 'object' ||
        !('calls' in value) ||
        typeof value.calls !== 'number' ||
        !('batchCount' in value) ||
        typeof value.batchCount !== 'number' ||
        !('shadowCount' in value) ||
        typeof value.shadowCount !== 'number'
    )
        throw new Error('Missing submitted rigid fauna receipt');
    return {
        calls: value.calls,
        batchCount: value.batchCount,
        shadowCount: value.shadowCount,
    };
}

for (const quality of qualities) {
    test(`${quality} rigid fauna preserves authored pixels through articulated poses`, async ({
        mount,
        page,
    }, testInfo) => {
        test.setTimeout(60_000);
        await page.route(`${appBaseUrl}/assets/**`, async (route) => {
            const response = await route.fetch();
            await route.fulfill({
                response,
                headers: {
                    ...response.headers(),
                    'access-control-allow-origin': '*',
                },
            });
        });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const component = await mount(
            <RigidFaunaBatchFixture
                appBaseUrl={appBaseUrl}
                batch={false}
                quality={quality}
            />,
        );
        for (const { pose, night } of [
            { pose: 0, night: false },
            { pose: 1, night: false },
            { pose: 2, night: true },
        ]) {
            await component.update(
                <RigidFaunaBatchFixture
                    appBaseUrl={appBaseUrl}
                    batch={false}
                    quality={quality}
                    pose={pose}
                    night={night}
                />,
            );
            const receipt = component.getByTestId('rigid-receipt');
            await expect(receipt).toHaveAttribute(
                'data-ready',
                `false:${pose}:${quality}:${night}`,
            );
            const original = await component.locator('canvas').screenshot();
            const before = readReceipt(
                await receipt.getAttribute('data-result'),
            );
            await component.update(
                <RigidFaunaBatchFixture
                    appBaseUrl={appBaseUrl}
                    batch
                    quality={quality}
                    pose={pose}
                    night={night}
                />,
            );
            await expect(receipt).toHaveAttribute(
                'data-ready',
                `true:${pose}:${quality}:${night}`,
            );
            const compiled = await component.locator('canvas').screenshot();
            const after = readReceipt(
                await receipt.getAttribute('data-result'),
            );
            expect(after.batchCount).toBe(7);
            expect(after.calls).toBeLessThan(before.calls);
            expect(after.shadowCount).toBe(before.shadowCount);
            expect(after.shadowCount).toBe(quality === 'low' ? 0 : 2);
            const a = await sharp(original).ensureAlpha().raw().toBuffer();
            const b = await sharp(compiled).ensureAlpha().raw().toBuffer();
            expect(b.length).toBe(a.length);
            let changed = 0;
            let maximum = 0;
            for (let i = 0; i < a.length; i += 4) {
                let difference = 0;
                for (let channel = 0; channel < 3; channel++)
                    difference = Math.max(
                        difference,
                        Math.abs(a[i + channel] - b[i + channel]),
                    );
                if (difference > 3) changed++;
                maximum = Math.max(maximum, difference);
            }
            await testInfo.attach(`${quality}-${pose}-authored.png`, {
                body: original,
                contentType: 'image/png',
            });
            await testInfo.attach(`${quality}-${pose}-batched.png`, {
                body: compiled,
                contentType: 'image/png',
            });
            expect(changed / (a.length / 4)).toBeLessThan(0.001);
            expect(maximum).toBeLessThanOrEqual(8);
            expect(errors).toEqual([]);
        }
    });
}
