import { AnchorPrice } from '@gredice/ui/AnchorPrice';
import { expect, test } from '@playwright/experimental-ct-react';
import { PricingDisplayTestStory } from './PricingDisplayTestStory';

for (const width of [360, 1280]) {
    test(`price list shows unchanged anchor price and date at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 800 });
        const component = await mount(<PricingDisplayTestStory />);
        await expect(
            component.getByText('5,00 €', { exact: true }),
        ).toHaveCount(1);
        await expect(
            component.getByText('Cijena 10. 9. 2026.: 5,00 €'),
        ).toBeVisible();
        await expect(component.getByText('Najniža u 30 dana')).toHaveCount(0);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
    });
}

test('other price displays still hide unchanged anchor prices', async ({
    mount,
}) => {
    const component = await mount(
        <AnchorPrice
            currentPrice={5}
            anchor={{ price: 5, date: '2026-09-10' }}
        />,
    );
    await expect(component).toBeEmpty();
});

test('changed prices show both amounts with the historical date', async ({
    mount,
}) => {
    const component = await mount(<PricingDisplayTestStory currentPrice={7} />);
    await expect(component.getByText('7,00 €', { exact: true })).toBeVisible();
    await expect(
        component.getByText('Cijena 10. 9. 2026.: 5,00 €'),
    ).toBeVisible();
});

test('unknown history does not label today’s price as an anchor', async ({
    mount,
}) => {
    const component = await mount(
        <PricingDisplayTestStory anchorPrice={null} />,
    );
    await expect(component.getByText('5,00 €', { exact: true })).toHaveCount(1);
    await expect(component.getByText('2026', { exact: false })).toHaveCount(0);
});

test('an older 30-day minimum does not duplicate an unchanged price', async ({
    mount,
}) => {
    const component = await mount(
        <PricingDisplayTestStory
            currentPrice={0.6}
            anchorPrice={0.6}
            lowestPrice={0}
        />,
    );
    await expect(component.getByText('0,60 €', { exact: true })).toHaveCount(1);
    await expect(
        component.getByText('Najniža u 30 dana', { exact: false }),
    ).toHaveCount(0);
});
