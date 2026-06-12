import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    RaisedBedOnboardingModalEventStory as OnboardingEventStory,
    RaisedBedOnboardingModalReopenStory as OnboardingReopenStory,
    RaisedBedOnboardingModalStory as OnboardingStory,
} from './RaisedBedOnboardingModalStory';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const gardenId = 101;
const raisedBedId = 201;

async function mockShoppingCart(page: Page) {
    const posts: unknown[] = [];

    await page.route('**/api/gredice/**/shopping-cart', async (route) => {
        if (route.request().method() === 'POST') {
            posts.push(route.request().postDataJSON());
            await route.fulfill({
                body: JSON.stringify({ success: true }),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        await route.fulfill({
            body: JSON.stringify({
                allowPurchase: true,
                hasDeliverableItems: false,
                id: 1,
                items: [],
                notes: [],
                total: 0,
                totalSunflowers: 0,
            }),
            contentType: 'application/json',
            status: 200,
        });
    });

    return posts;
}

async function wizardStepAnimationName(page: Page, step: string) {
    return page
        .locator(`[data-raised-bed-onboarding-step="${step}"]`)
        .evaluate((node) => window.getComputedStyle(node).animationName);
}

test('raised-bed onboarding uses a near full-screen desktop modal', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    const dialog = page.getByRole('dialog', { name: 'Brzi plan gredice' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Tvoja nova personalizirana gredica');
    await expect(dialog).toContainText('Prva gredica');
    await expect(dialog).not.toContainText('Tvoji zadaci');
    await expect(dialog).not.toContainText('Kakav ritam želiš?');

    const layoutViewport = await page.evaluate(() => ({
        height: document.documentElement.clientHeight,
        width: document.documentElement.clientWidth,
    }));
    const dialogBox = await dialog.boundingBox();
    expect(Math.round(dialogBox?.width ?? 0)).toBeGreaterThanOrEqual(
        layoutViewport.width - 80,
    );
    expect(dialogBox?.height).toBeGreaterThan(700);

    const actions = page.locator('[data-raised-bed-onboarding-actions="true"]');
    const progress = page.locator(
        '[data-raised-bed-onboarding-progress="true"]',
    );
    await expect(actions).toBeVisible();
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute('aria-valuenow', '1');
    await expect(progress).toHaveAttribute('aria-valuemax', '4');
    await expect(actions).not.toContainText('Preskoči');
    await expect(actions).not.toContainText('Zatvori');

    const actionsBox = await actions.boundingBox();
    const progressBox = await progress.boundingBox();
    const guideBox = await page
        .getByRole('link', { name: /Detaljan vodič/ })
        .boundingBox();
    const dialogCenter = (dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) / 2;
    const actionsCenter = (actionsBox?.x ?? 0) + (actionsBox?.width ?? 0) / 2;
    const progressCenter =
        (progressBox?.x ?? 0) + (progressBox?.width ?? 0) / 2;

    expect(Math.abs(actionsCenter - dialogCenter)).toBeLessThan(8);
    expect(Math.abs(progressCenter - dialogCenter)).toBeLessThan(8);
    expect((guideBox?.y ?? 0) - (progressBox?.y ?? 0)).toBeGreaterThan(0);
    expect(
        (dialogBox?.y ?? 0) +
            (dialogBox?.height ?? 0) -
            ((actionsBox?.y ?? 0) + (actionsBox?.height ?? 0)),
    ).toBeGreaterThan(80);
});

test('raised-bed onboarding reopens from the first-bed HUD trigger', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingReopenStory />);

    await expect(
        page.getByRole('dialog', { name: 'Brzi plan gredice' }),
    ).toBeHidden();
    await page.getByRole('button', { name: 'Prva gredica' }).click();
    await expect(
        page.getByRole('dialog', { name: 'Brzi plan gredice' }),
    ).toBeVisible();
});

test('raised-bed onboarding opens from the tutorial task event without a HUD trigger', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingEventStory />);

    await expect(
        page.locator('[data-raised-bed-onboarding-hud="true"]'),
    ).toHaveCount(0);
    await expect(
        page.getByRole('dialog', { name: 'Brzi plan gredice' }),
    ).toBeHidden();
    await page.evaluate(() => {
        window.dispatchEvent(new Event('game:raised-bed-onboarding:open'));
    });
    await expect(
        page.getByRole('dialog', { name: 'Brzi plan gredice' }),
    ).toBeVisible();
});

test('raised-bed onboarding trigger matches HUD sizing with a green border-only glow', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingReopenStory />);

    const trigger = page.locator('[data-raised-bed-onboarding-trigger="true"]');
    const hud = page.locator('[data-raised-bed-onboarding-hud="true"]');
    await expect(hud).toBeVisible();
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Prva gredica');

    const hudBox = await hud.boundingBox();
    expect(Math.round(hudBox?.height ?? 0)).toBe(48);

    const styles = await hud.evaluate((node) => {
        const button = node.querySelector<HTMLButtonElement>(
            '[data-raised-bed-onboarding-trigger="true"]',
        );
        if (!button) {
            throw new Error('Missing onboarding trigger button');
        }

        const probe = document.createElement('span');
        probe.style.color = 'hsl(var(--tertiary))';
        document.body.append(probe);
        const tertiaryColor = window.getComputedStyle(probe).color;
        probe.remove();

        const buttonStyles = window.getComputedStyle(button);
        const hudStyles = window.getComputedStyle(node);
        const glowStyles = window.getComputedStyle(node, '::before');

        return {
            buttonBorderBottomWidth: buttonStyles.borderBottomWidth,
            glowAnimationName: glowStyles.animationName,
            glowBackgroundImage: glowStyles.backgroundImage,
            glowFilter: glowStyles.filter,
            glowInset: glowStyles.inset,
            glowMaskImage:
                glowStyles.maskImage ||
                glowStyles.getPropertyValue('-webkit-mask-image'),
            glowTransform: glowStyles.transform,
            hudBorderBottomColor: hudStyles.borderBottomColor,
            tertiaryColor,
        };
    });

    expect(styles.buttonBorderBottomWidth).toBe('0px');
    expect(styles.hudBorderBottomColor).toBe(styles.tertiaryColor);
    expect(styles.glowAnimationName).not.toBe('none');
    expect(styles.glowBackgroundImage).toMatch(/34,\s*197,\s*94/u);
    expect(styles.glowFilter).toBe('none');
    expect(styles.glowInset).toBe('0px');
    expect(styles.glowMaskImage).not.toBe('none');
    expect(styles.glowTransform).toBe('none');
});

test('raised-bed onboarding previews vertical sort-image layouts', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    await page.getByRole('button', { name: 'Dalje' }).click();
    await expect(
        page.locator('[data-raised-bed-onboarding-progress="true"]'),
    ).toHaveAttribute('aria-valuenow', '2');
    await expect(page.getByText('Kakav ritam želiš?')).toBeVisible();
    await expect
        .poll(() => wizardStepAnimationName(page, 'care'))
        .toContain('wizard-step-forward');
    await page.getByRole('button', { name: 'Prikaži prijedloge' }).click();
    await expect(
        page.locator('[data-raised-bed-onboarding-progress="true"]'),
    ).toHaveAttribute('aria-valuenow', '3');
    await expect(page.getByText('Odaberi raspored')).toBeVisible();
    await expect
        .poll(() => wizardStepAnimationName(page, 'layouts'))
        .toContain('wizard-step-forward');
    await page.getByRole('button', { name: 'Natrag' }).click();
    await expect(
        page.locator('[data-raised-bed-onboarding-progress="true"]'),
    ).toHaveAttribute('aria-valuenow', '2');
    await expect
        .poll(() => wizardStepAnimationName(page, 'care'))
        .toContain('wizard-step-backward');
    await page.getByRole('button', { name: 'Prikaži prijedloge' }).click();
    await expect(
        page.locator('[data-raised-bed-onboarding-progress="true"]'),
    ).toHaveAttribute('aria-valuenow', '3');
    await expect(page.getByText('Odaberi raspored')).toBeVisible();
    const progressBox = await page
        .locator('[data-raised-bed-onboarding-progress="true"]')
        .boundingBox();
    const nextButtonBox = await page
        .getByRole('button', { name: 'Dalje' })
        .boundingBox();
    const progressCenter =
        (progressBox?.x ?? 0) + (progressBox?.width ?? 0) / 2;
    const nextButtonCenter =
        (nextButtonBox?.x ?? 0) + (nextButtonBox?.width ?? 0) / 2;
    expect(Math.abs(nextButtonCenter - progressCenter)).toBeLessThan(4);
    const backButtonBox = await page
        .getByRole('button', { name: 'Natrag' })
        .boundingBox();
    expect((backButtonBox?.x ?? 0) + (backButtonBox?.width ?? 0)).toBeLessThan(
        nextButtonBox?.x ?? 0,
    );

    const suggestionCarousel = page.locator(
        '[data-raised-bed-onboarding-suggestion-carousel="true"]',
    );
    await expect(suggestionCarousel).toBeVisible();
    await expect(suggestionCarousel).toContainText('Salatna zdjela');
    await expect(
        suggestionCarousel.getByText('1/4', { exact: true }),
    ).toHaveCount(0);
    const suggestionCard = suggestionCarousel.locator(
        '[data-raised-bed-onboarding-suggestion-card="true"]',
    );
    const previousSuggestionButton = suggestionCarousel.getByRole('button', {
        name: 'Prethodni prijedlog',
    });
    const nextSuggestionButton = suggestionCarousel.getByRole('button', {
        name: 'Sljedeći prijedlog',
    });
    const suggestionCardBox = await suggestionCard.boundingBox();
    const previousSuggestionButtonBox =
        await previousSuggestionButton.boundingBox();
    const nextSuggestionButtonBox = await nextSuggestionButton.boundingBox();
    expect(suggestionCardBox).not.toBeNull();
    expect(previousSuggestionButtonBox).not.toBeNull();
    expect(nextSuggestionButtonBox).not.toBeNull();
    expect(
        Math.round(previousSuggestionButtonBox?.width ?? 0),
    ).toBeGreaterThanOrEqual(48);
    expect(
        Math.round(previousSuggestionButtonBox?.height ?? 0),
    ).toBeGreaterThanOrEqual(48);
    expect(
        Math.round(nextSuggestionButtonBox?.width ?? 0),
    ).toBeGreaterThanOrEqual(48);
    expect(
        Math.round(nextSuggestionButtonBox?.height ?? 0),
    ).toBeGreaterThanOrEqual(48);
    expect(
        (previousSuggestionButtonBox?.x ?? 0) +
            (previousSuggestionButtonBox?.width ?? 0),
    ).toBeLessThanOrEqual((suggestionCardBox?.x ?? 0) + 1);
    expect(nextSuggestionButtonBox?.x ?? 0).toBeGreaterThanOrEqual(
        (suggestionCardBox?.x ?? 0) + (suggestionCardBox?.width ?? 0) - 1,
    );
    const neutralButtonStyles = await nextSuggestionButton.evaluate((node) => {
        const styles = window.getComputedStyle(node);
        return {
            backgroundColor: styles.backgroundColor,
            borderColor: styles.borderColor,
            color: styles.color,
        };
    });
    expect(neutralButtonStyles.borderColor).not.toMatch(/34,\s*197,\s*94/u);
    expect(neutralButtonStyles.color).not.toMatch(/34,\s*197,\s*94/u);
    await nextSuggestionButton.hover();
    await expect
        .poll(() =>
            nextSuggestionButton.evaluate(
                (node) => window.getComputedStyle(node).backgroundColor,
            ),
        )
        .not.toBe(neutralButtonStyles.backgroundColor);
    await expect
        .poll(() =>
            nextSuggestionButton.evaluate(
                (node) => window.getComputedStyle(node).borderColor,
            ),
        )
        .not.toBe(neutralButtonStyles.borderColor);
    await nextSuggestionButton.focus();
    const focusedButtonStyles = await nextSuggestionButton.evaluate((node) => {
        const styles = window.getComputedStyle(node);
        return {
            outlineOffset: styles.outlineOffset,
            outlineStyle: styles.outlineStyle,
            outlineWidth: styles.outlineWidth,
        };
    });
    expect(focusedButtonStyles.outlineStyle).toBe('solid');
    expect(focusedButtonStyles.outlineWidth).toBe('2px');
    expect(focusedButtonStyles.outlineOffset).toBe('4px');

    await suggestionCarousel
        .getByRole('button', { name: 'Sljedeći prijedlog' })
        .click();
    await expect(suggestionCarousel).toContainText('Ljetna kuhinja');
    const nextExitingSuggestionCard = suggestionCarousel.locator(
        '[data-card-motion="exit"]',
    );
    await expect(nextExitingSuggestionCard).toHaveCount(1);
    const nextExitAnimationName = await nextExitingSuggestionCard.evaluate(
        (node) => window.getComputedStyle(node).animationName,
    );
    expect(nextExitAnimationName).toContain('suggestion-card-exit-next');
    await expect
        .poll(() =>
            suggestionCard.evaluate(
                (node) => window.getComputedStyle(node).animationName,
            ),
        )
        .toBe('none');
    await expect(
        page.locator('img[alt="Rajčica saint pierre"]').first(),
    ).toBeVisible();
    await expect(
        suggestionCarousel.locator('[data-card-motion="exit"]'),
    ).toHaveCount(0);

    await previousSuggestionButton.click();
    await expect(suggestionCarousel).toContainText('Salatna zdjela');
    const previousExitingSuggestionCard = suggestionCarousel.locator(
        '[data-card-motion="exit"]',
    );
    await expect(previousExitingSuggestionCard).toHaveCount(1);
    const previousExitAnimationName =
        await previousExitingSuggestionCard.evaluate(
            (node) => window.getComputedStyle(node).animationName,
        );
    expect(previousExitAnimationName).toContain(
        'suggestion-card-exit-previous',
    );
    await expect
        .poll(() =>
            suggestionCard.evaluate(
                (node) => window.getComputedStyle(node).animationName,
            ),
        )
        .toBe('none');

    const previewBox = await page
        .locator('div[title^="Rajčica saint pierre"]')
        .first()
        .locator('xpath=ancestor::div[contains(@class, "grid-cols-3")][1]')
        .boundingBox();
    expect(previewBox).not.toBeNull();
    expect(previewBox?.height ?? 0).toBeGreaterThan(previewBox?.width ?? 0);
});

test('raised-bed onboarding fills the mobile viewport', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    const dialog = page.getByRole('dialog', { name: 'Brzi plan gredice' });
    await expect(dialog).toBeVisible();

    const layoutViewport = await page.evaluate(() => ({
        height: document.documentElement.clientHeight,
        width: document.documentElement.clientWidth,
    }));
    await expect
        .poll(async () => (await dialog.boundingBox())?.width ?? 0)
        .toBeGreaterThanOrEqual(layoutViewport.width - 1);
    await expect
        .poll(async () => (await dialog.boundingBox())?.height ?? 0)
        .toBeGreaterThanOrEqual(layoutViewport.height - 1);
});

test('raised-bed onboarding suggestion stack uses dark surfaces in dark mode', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Prikaži prijedloge' }).click();

    const suggestionCarousel = page.locator(
        '[data-raised-bed-onboarding-suggestion-carousel="true"]',
    );
    const suggestionCard = suggestionCarousel.locator(
        '[data-raised-bed-onboarding-suggestion-card="true"]',
    );
    const stackBack = suggestionCarousel.locator(
        '[data-raised-bed-onboarding-stack-card="back-1"]',
    );
    const selectedGrid = suggestionCarousel.locator(
        '[data-raised-bed-onboarding-layout-grid="selected"]',
    );

    await expect(stackBack).toBeVisible();
    await expect(suggestionCard).toBeVisible();
    await expect(selectedGrid).toBeVisible();
    const cardBackground = await suggestionCard.evaluate(
        (node) => window.getComputedStyle(node).backgroundColor,
    );
    const stackBackground = await stackBack.evaluate(
        (node) => window.getComputedStyle(node).backgroundColor,
    );
    const gridBackground = await selectedGrid.evaluate(
        (node) => window.getComputedStyle(node).backgroundColor,
    );
    expect(cardBackground).not.toBe('rgb(255, 255, 255)');
    expect(stackBackground).not.toBe('rgba(255, 255, 255, 0.72)');
    expect(gridBackground).toMatch(/58,\s*36,\s*24/u);
});

test('raised-bed onboarding keeps mobile suggestion controls in the card and supports horizontal swiping', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Prikaži prijedloge' }).click();

    const suggestionCarousel = page.locator(
        '[data-raised-bed-onboarding-suggestion-carousel="true"]',
    );
    const suggestionCard = suggestionCarousel.locator(
        '[data-raised-bed-onboarding-suggestion-card="true"]',
    );
    const suggestionStage = suggestionCarousel.locator(
        '[data-raised-bed-onboarding-suggestion-stage="true"]',
    );
    const previousSuggestionButton = suggestionCarousel.getByRole('button', {
        name: 'Prethodni prijedlog',
    });
    const nextSuggestionButton = suggestionCarousel.getByRole('button', {
        name: 'Sljedeći prijedlog',
    });

    await expect(suggestionCarousel).toBeVisible();
    await expect(suggestionCard).toContainText('Salatna zdjela');
    await expect(previousSuggestionButton).toBeVisible();
    await expect(nextSuggestionButton).toBeVisible();

    const cardBox = await suggestionCard.boundingBox();
    const previousButtonBox = await previousSuggestionButton.boundingBox();
    const nextButtonBox = await nextSuggestionButton.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(previousButtonBox).not.toBeNull();
    expect(nextButtonBox).not.toBeNull();
    expect(cardBox?.width ?? 0).toBeGreaterThan(300);
    expect(previousButtonBox?.x ?? 0).toBeGreaterThanOrEqual(cardBox?.x ?? 0);
    expect(
        (nextButtonBox?.x ?? 0) + (nextButtonBox?.width ?? 0),
    ).toBeLessThanOrEqual((cardBox?.x ?? 0) + (cardBox?.width ?? 0) + 1);

    await nextSuggestionButton.click();
    await expect(suggestionCard).toContainText('Ljetna kuhinja');

    async function swipeSuggestion(deltaX: number, deltaY: number) {
        await suggestionStage.evaluate(
            (node, { x, y }) => {
                node.dispatchEvent(
                    new PointerEvent('pointerdown', {
                        bubbles: true,
                        clientX: 120,
                        clientY: 120,
                        pointerId: 1,
                        pointerType: 'touch',
                    }),
                );
                node.dispatchEvent(
                    new PointerEvent('pointerup', {
                        bubbles: true,
                        clientX: 120 + x,
                        clientY: 120 + y,
                        pointerId: 1,
                        pointerType: 'touch',
                    }),
                );
            },
            { x: deltaX, y: deltaY },
        );
    }

    await swipeSuggestion(96, 0);
    await expect(suggestionCard).toContainText('Salatna zdjela');

    await swipeSuggestion(0, -96);
    await expect(suggestionCard).toContainText('Salatna zdjela');

    await swipeSuggestion(-96, 0);
    await expect(suggestionCard).toContainText('Ljetna kuhinja');
});

test('raised-bed onboarding applies twelve suggested cart plants', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const posts = await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    const dialog = page.getByRole('dialog', { name: 'Brzi plan gredice' });
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Prikaži prijedloge' }).click();
    await expect(page.getByText('Odaberi raspored')).toBeVisible();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await expect(
        page.locator('[data-raised-bed-onboarding-progress="true"]'),
    ).toHaveAttribute('aria-valuenow', '4');
    await expect(page.getByText('Tvoji zadaci')).toBeVisible();
    const onboardingTaskItems = page.locator(
        '[data-raised-bed-onboarding-task-id]',
    );
    await expect(onboardingTaskItems).toHaveCount(6);
    await expect
        .poll(() =>
            onboardingTaskItems.evaluateAll((nodes) =>
                nodes.map((node) =>
                    node.getAttribute('data-raised-bed-onboarding-task-id'),
                ),
            ),
        )
        .toEqual([
            'choose-meals',
            'choose-care-rhythm',
            'review-layouts',
            'add-plan-to-cart',
            'customize-empty-fields',
            'confirm-cart',
        ]);
    await expect
        .poll(() =>
            onboardingTaskItems.evaluateAll((nodes) =>
                nodes.map((node) =>
                    node.getAttribute('data-raised-bed-onboarding-task-state'),
                ),
            ),
        )
        .toEqual([
            'complete',
            'complete',
            'complete',
            'current',
            'next',
            'next',
        ]);
    await expect(
        page.locator('[data-raised-bed-onboarding-task-state="complete"] svg'),
    ).toHaveCount(3);
    const currentOnboardingTask = page.locator(
        '[data-raised-bed-onboarding-task-state="current"]',
    );
    await expect(currentOnboardingTask).toContainText('Dodaj plan u košaru');
    const pickedLayoutStyles = await page
        .locator('[data-raised-bed-onboarding-picked-layout="true"]')
        .evaluate((node) => {
            const styles = window.getComputedStyle(node);
            return {
                backgroundColor: styles.backgroundColor,
                borderTopWidth: styles.borderTopWidth,
            };
        });
    expect(pickedLayoutStyles.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(pickedLayoutStyles.borderTopWidth).toBe('0px');
    const currentTaskStyles = await currentOnboardingTask.evaluate((node) => {
        const styles = window.getComputedStyle(node);
        return {
            backgroundColor: styles.backgroundColor,
            borderColor: styles.borderColor,
        };
    });
    const nextTaskStyles = await page
        .locator('[data-raised-bed-onboarding-task-state="next"]')
        .first()
        .evaluate((node) => {
            const styles = window.getComputedStyle(node);
            return {
                backgroundColor: styles.backgroundColor,
                borderColor: styles.borderColor,
            };
        });
    expect(currentTaskStyles.backgroundColor).not.toBe(
        nextTaskStyles.backgroundColor,
    );
    expect(currentTaskStyles.borderColor).not.toBe(nextTaskStyles.borderColor);
    await page.getByRole('button', { name: 'Dodaj plan u košaru' }).click();

    await expect.poll(() => posts.length).toBe(12);
    expect(posts).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                amount: 1,
                currency: 'eur',
                entityTypeName: 'plantSort',
                gardenId,
                raisedBedId,
            }),
        ]),
    );
    expect(
        new Set(
            posts
                .filter(
                    (post): post is { positionIndex: number } =>
                        typeof post === 'object' &&
                        post !== null &&
                        typeof Reflect.get(post, 'positionIndex') === 'number',
                )
                .map((post) => post.positionIndex),
        ).size,
    ).toBe(12);
});

test('raised-bed onboarding applies the current preference default layout', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    const posts = await mockShoppingCart(page);

    await mount(<OnboardingStory />);

    const dialog = page.getByRole('dialog', { name: 'Brzi plan gredice' });
    await expect(dialog).toBeVisible();
    await page.getByRole('button', { name: /Umaci i roštilj/ }).click();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Prikaži prijedloge' }).click();
    await expect(page.getByText('Odaberi raspored')).toBeVisible();
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Dodaj plan u košaru' }).click();

    await expect.poll(() => posts.length).toBe(12);

    const entityIds = posts
        .map((post) =>
            typeof post === 'object' && post !== null
                ? Reflect.get(post, 'entityId')
                : null,
        )
        .filter((entityId): entityId is string => typeof entityId === 'string');

    expect(entityIds).toContain('216');
    expect(entityIds).toContain('230');
    expect(entityIds).not.toContain('357');
});
