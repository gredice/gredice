import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { ShoppingCartStepTransitionStory } from './ShoppingCartStepTransitionStory';

async function getAnimationDetails(locator: Locator) {
    return locator.evaluate((node) => {
        const style = window.getComputedStyle(node);
        const keyframes = Array.from(document.styleSheets)
            .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
            .find(
                (rule) =>
                    rule instanceof CSSKeyframesRule &&
                    rule.name === style.animationName,
            );

        return {
            animationDuration: style.animationDuration,
            animationName: style.animationName,
            animationTimingFunction: style.animationTimingFunction,
            keyframes:
                keyframes instanceof CSSKeyframesRule
                    ? Array.from(keyframes.cssRules).flatMap((keyframe) =>
                          keyframe instanceof CSSKeyframeRule
                              ? [
                                    {
                                        opacity:
                                            keyframe.style.opacity || undefined,
                                        transform:
                                            keyframe.style.transform ||
                                            undefined,
                                    },
                                ]
                              : [],
                      )
                    : [],
        };
    });
}

test.describe('shopping cart step transition', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
    });

    test('keeps the initial cart content settled', async ({ mount, page }) => {
        await mount(<ShoppingCartStepTransitionStory />);

        const transition = page.locator('[data-shopping-cart-step="cart"]');
        expect(await getAnimationDetails(transition)).toEqual({
            animationDuration: '0s',
            animationName: 'none',
            animationTimingFunction: 'ease',
            keyframes: [],
        });

        await page.getByRole('button', { name: 'Ažuriraj košaricu' }).click();
        await expect(page.getByLabel('Broj ažuriranja košarice')).toHaveText(
            '1',
        );
        expect(await getAnimationDetails(transition)).toEqual({
            animationDuration: '0s',
            animationName: 'none',
            animationTimingFunction: 'ease',
            keyframes: [],
        });
    });

    test('uses the forward checkout motion without delaying controls', async ({
        mount,
        page,
    }) => {
        await mount(<ShoppingCartStepTransitionStory />);

        await page.getByRole('button', { name: 'Dostava' }).click();

        const transition = page.locator('[data-shopping-cart-step="delivery"]');
        await expect(transition).toHaveAttribute(
            'data-step-direction',
            'forward',
        );
        expect(await getAnimationDetails(transition)).toEqual({
            animationDuration: '0.26s',
            animationName: expect.stringContaining(
                'shopping-cart-step-forward',
            ),
            animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            keyframes: [
                {
                    opacity: '0',
                    transform: 'translateX(26px) scale(0.985)',
                },
                {
                    opacity: '1',
                    transform: 'translateX(0px) scale(1)',
                },
            ],
        });

        const proceed = page.getByRole('button', { name: 'Nastavi' });
        await proceed.focus();
        await expect(proceed).toBeFocused();
        await proceed.dispatchEvent('click');
        await expect(page.getByLabel('Broj nastavaka')).toHaveText('1');
    });

    test('uses the reverse motion when returning to the cart', async ({
        mount,
        page,
    }) => {
        await mount(<ShoppingCartStepTransitionStory />);
        await page.getByRole('button', { name: 'Dostava' }).click();
        await page.getByRole('button', { name: 'Natrag' }).click();

        const transition = page.locator('[data-shopping-cart-step="cart"]');
        await expect(transition).toHaveAttribute(
            'data-step-direction',
            'backward',
        );
        expect(await getAnimationDetails(transition)).toEqual({
            animationDuration: '0.26s',
            animationName: expect.stringContaining(
                'shopping-cart-step-backward',
            ),
            animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            keyframes: [
                {
                    opacity: '0',
                    transform: 'translateX(-26px) scale(0.985)',
                },
                {
                    opacity: '1',
                    transform: 'translateX(0px) scale(1)',
                },
            ],
        });
    });

    test('uses an opacity-only transition for reduced motion', async ({
        mount,
        page,
    }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mount(<ShoppingCartStepTransitionStory />);

        await page.getByRole('button', { name: 'Dostava' }).click();

        const transition = page.locator('[data-shopping-cart-step="delivery"]');
        expect(await getAnimationDetails(transition)).toEqual({
            animationDuration: '0.12s',
            animationName: expect.stringContaining('shopping-cart-step-fade'),
            animationTimingFunction: 'ease-out',
            keyframes: [
                { opacity: '0', transform: undefined },
                { opacity: '1', transform: undefined },
            ],
        });
    });
});
