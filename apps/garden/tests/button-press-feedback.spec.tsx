import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { Search } from '@gredice/ui/icons';
import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';

async function pressAndReadStyles(
    page: Page,
    control: Locator,
    expectedScale: string,
) {
    const box = await control.boundingBox();
    if (!box) {
        throw new Error('Expected the button to have a bounding box.');
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect
        .poll(() =>
            control.evaluate((node) => window.getComputedStyle(node).scale),
        )
        .toBe(expectedScale);
    const styles = await control.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
            scale: style.scale,
            transitionDuration: style.transitionDuration,
            transitionProperty: style.transitionProperty,
            transitionTimingFunction: style.transitionTimingFunction,
        };
    });
    await page.mouse.up();

    return styles;
}

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
});

test('shared Button and IconButton expose exact pointer press feedback', async ({
    mount,
    page,
}) => {
    await mount(
        <div className="flex gap-4 p-8">
            <Button data-testid="button">Spremi promjenu</Button>
            <IconButton aria-label="Pretraga" data-testid="icon-button">
                <Search className="size-4" />
            </IconButton>
        </div>,
    );

    for (const testId of ['button', 'icon-button']) {
        const styles = await pressAndReadStyles(
            page,
            page.getByTestId(testId),
            '0.98',
        );
        expect(styles.scale).toBe('0.98');
        expect(styles.transitionDuration).toBe('0.15s');
        expect(styles.transitionProperty).toContain('scale');
        expect(styles.transitionTimingFunction).toBe(
            'cubic-bezier(0, 0, 0.2, 1)',
        );
    }
});

test('reduced motion uses the gentler scale and shorter duration', async ({
    mount,
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mount(
        <Button data-testid="button" variant="outlined">
            Uredi podatke
        </Button>,
    );

    const styles = await pressAndReadStyles(
        page,
        page.getByTestId('button'),
        '0.995',
    );
    expect(styles.scale).toBe('0.995');
    expect(styles.transitionDuration).toBe('0.1s');
    expect(styles.transitionTimingFunction).toBe('cubic-bezier(0, 0, 0.2, 1)');
});

test('links and unavailable buttons do not receive press feedback', async ({
    mount,
    page,
}) => {
    await mount(
        <div className="flex gap-4 p-8">
            <Button data-testid="href-link" href="#target" variant="solid">
                Otvori
            </Button>
            <Button data-testid="link-variant" variant="link">
                Saznaj vise
            </Button>
            <Button data-testid="disabled" disabled>
                Nedostupno
            </Button>
            <Button data-testid="loading" loading>
                Spremanje
            </Button>
            <Button aria-disabled data-testid="aria-disabled-boolean">
                Na cekanju
            </Button>
            <Button aria-disabled="true" data-testid="aria-disabled-string">
                Obrada
            </Button>
        </div>,
    );

    for (const testId of [
        'href-link',
        'link-variant',
        'disabled',
        'loading',
        'aria-disabled-boolean',
        'aria-disabled-string',
    ]) {
        await expect(page.getByTestId(testId)).not.toHaveClass(/active:scale-/);
    }

    for (const testId of ['aria-disabled-boolean', 'aria-disabled-string']) {
        const control = page.getByTestId(testId);
        await control.focus();
        await page.keyboard.down(' ');
        await expect(control).toHaveCSS('scale', 'none');
        await page.keyboard.up(' ');
    }
});
