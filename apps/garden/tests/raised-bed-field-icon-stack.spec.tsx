import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedFieldIconStack } from '../../../packages/game/src/hud/raisedBed/RaisedBedFieldIconStack';

test('field icon stack keeps newest indicators on top and prepares spread offsets', async ({
    mount,
    page,
}) => {
    await mount(
        <div className="relative size-20" data-testid="field">
            <RaisedBedFieldIconStack>
                <button type="button" data-testid="all-history">
                    ...
                </button>
                <button type="button" data-testid="older-plant">
                    1
                </button>
                <button type="button" data-testid="cart">
                    cart
                </button>
            </RaisedBedFieldIconStack>
        </div>,
    );
    await page.getByTestId('field').evaluate((field) => {
        field.addEventListener('click', () => {
            field.setAttribute('data-opened', 'true');
        });
    });
    await page.getByTestId('cart').evaluate((cart) => {
        cart.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'touch') {
                cart.setAttribute('data-pressed', 'true');
            }
        });
    });

    await expect(page.getByTestId('all-history')).toBeVisible();
    await expect(page.getByTestId('older-plant')).toBeVisible();
    await expect(page.getByTestId('cart')).toBeVisible();

    const allHistoryWrapper = page.getByTestId('all-history').locator('..');
    const olderPlantWrapper = page.getByTestId('older-plant').locator('..');
    const cartWrapper = page.getByTestId('cart').locator('..');

    await expect(allHistoryWrapper).toHaveCSS('--field-icon-spread', '48px');
    await expect(olderPlantWrapper).toHaveCSS('--field-icon-spread', '24px');
    await expect(cartWrapper).toHaveCSS('--field-icon-spread', '0px');
    await expect(cartWrapper).toHaveCSS('z-index', '3');

    const stack = page.locator('[data-field-icon-stack]');

    const stackBox = await stack.boundingBox();
    if (!stackBox) {
        throw new Error('Expected field icon stack to be visible.');
    }

    await expect(stack).toHaveCSS('width', '88px');
    await expect(stack).toHaveAttribute('data-touch-expanded', 'false');

    const gapPoint = {
        x: stackBox.x + stackBox.width / 2,
        y: stackBox.y + 16,
    };
    const gapBelongsToStack = await page.evaluate(({ x, y }) => {
        const hoveredElement = document.elementFromPoint(x, y);
        return Boolean(hoveredElement?.closest('[data-field-icon-stack]'));
    }, gapPoint);

    expect(gapBelongsToStack).toBe(true);

    await page.getByTestId('cart').dispatchEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
    });
    await page.getByTestId('cart').click({ force: true });

    await expect(stack).toHaveAttribute('data-touch-expanded', 'true');
    await expect(page.getByTestId('cart')).not.toHaveAttribute(
        'data-pressed',
        'true',
    );
    await expect(page.getByTestId('field')).not.toHaveAttribute(
        'data-opened',
        'true',
    );

    await page.getByTestId('cart').dispatchEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
    });

    await expect(page.getByTestId('cart')).toHaveAttribute(
        'data-pressed',
        'true',
    );

    await page.dispatchEvent('body', 'pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
    });
    await expect(stack).toHaveAttribute('data-touch-expanded', 'false');
});

test('field icon stack collapses after a multi-icon child is activated', async ({
    mount,
    page,
}) => {
    await mount(
        <div className="relative size-20">
            <RaisedBedFieldIconStack>
                <button type="button" data-testid="older-plant">
                    1
                </button>
                <button type="button" data-testid="cart">
                    cart
                </button>
            </RaisedBedFieldIconStack>
        </div>,
    );

    const stack = page.locator('[data-field-icon-stack]');
    const cart = page.getByTestId('cart');

    // First touch expands the stack and swallows the activating click.
    await cart.dispatchEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
    });
    await cart.click({ force: true });
    await expect(stack).toHaveAttribute('data-touch-expanded', 'true');

    // Second touch activates the child; the stack must collapse so that the
    // document-level pointerdown listener detaches before any opened drawer
    // tries to receive swipe-to-dismiss/backdrop touches.
    await cart.dispatchEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
    });
    await cart.click({ force: true });
    await expect(stack).toHaveAttribute('data-touch-expanded', 'false');
});

test('field icon stack activates a single indicator on first touch', async ({
    mount,
    page,
}) => {
    await mount(
        <div className="relative size-20">
            <RaisedBedFieldIconStack>
                <button type="button" data-testid="cart">
                    cart
                </button>
            </RaisedBedFieldIconStack>
        </div>,
    );
    await page.getByTestId('cart').evaluate((cart) => {
        cart.addEventListener('click', () => {
            cart.setAttribute('data-clicked', 'true');
        });
        cart.addEventListener('pointerdown', (event) => {
            if (event.pointerType === 'touch') {
                cart.setAttribute('data-pressed', 'true');
            }
        });
    });

    const stack = page.locator('[data-field-icon-stack]');
    await page.getByTestId('cart').dispatchEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
    });
    await page.getByTestId('cart').click({ force: true });

    await expect(stack).toHaveAttribute('data-touch-expanded', 'false');
    await expect(page.getByTestId('cart')).toHaveAttribute(
        'data-pressed',
        'true',
    );
    await expect(page.getByTestId('cart')).toHaveAttribute(
        'data-clicked',
        'true',
    );
});
