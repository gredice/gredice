import { ExpandableSearchInput } from '@gredice/ui/ExpandableSearchInput';
import { expect, test } from '@playwright/experimental-ct-react';

test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
});

test('mobile expansion escapes clipped header containers', async ({
    mount,
    page,
}) => {
    await mount(
        <div>
            <div
                style={{
                    alignItems: 'center',
                    display: 'flex',
                    height: 44,
                    justifyContent: 'flex-end',
                    overflow: 'hidden',
                    position: 'relative',
                    width: 360,
                }}
            >
                <ExpandableSearchInput
                    value=""
                    onChange={() => undefined}
                    placeholder="Pretraži zapise"
                    inputClassName="min-w-60"
                />
            </div>
            <div style={{ height: 120 }}>Sadržaj</div>
        </div>,
    );

    await page.getByRole('button', { name: 'Pretraži' }).tap();

    const search = page.getByPlaceholder('Pretraži zapise').last();
    await expect(search).toBeVisible();

    const box = await search.boundingBox();
    expect(box).not.toBeNull();

    if (!box) {
        throw new Error('Expected mobile search input to have a bounding box');
    }

    expect(box.y).toBeGreaterThan(44);
    expect(box.height).toBeGreaterThan(20);
});
