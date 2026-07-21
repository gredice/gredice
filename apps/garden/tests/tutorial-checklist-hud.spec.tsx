import { expect, test } from '@playwright/experimental-ct-react';
import { TutorialChecklistHudStory } from './TutorialChecklistHudStory';

test('tutorial checklist trigger shows icon with progress count below it', async ({
    mount,
    page,
}) => {
    await mount(<TutorialChecklistHudStory />);

    const trigger = page.locator('[data-tutorial-checklist-trigger="true"]');
    const progress = page.locator('[data-tutorial-checklist-progress="true"]');
    const claimDot = page.locator('[data-tutorial-checklist-claim-dot="true"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).not.toContainText('Zadaci');
    await expect(progress).toHaveText('1/3');
    const triggerIcon = trigger.locator(
        '[data-tutorial-checklist-trigger-icon="true"]',
    );
    await expect(triggerIcon).toBeVisible();
    await expect(triggerIcon).toHaveAttribute(
        'src',
        /\/assets\/hud\/tutorial-task-list\.png/,
    );
    await expect(trigger.locator('svg')).toHaveCount(0);
    await expect(claimDot).toBeVisible();
    await expect(claimDot).toHaveText('');

    const triggerBox = await trigger.boundingBox();
    expect(Math.round(triggerBox?.width ?? 0)).toBe(40);
    expect(Math.round(triggerBox?.height ?? 0)).toBe(40);

    const iconBox = await triggerIcon.boundingBox();
    const progressBox = await progress.boundingBox();
    const dotBox = await claimDot.boundingBox();
    expect(iconBox).not.toBeNull();
    expect(iconBox?.width ?? 0).toBeGreaterThanOrEqual(30);
    expect(progressBox).not.toBeNull();
    expect(dotBox).not.toBeNull();
    expect(iconBox?.y ?? 0).toBeLessThan(triggerBox?.y ?? 0);
    expect(progressBox?.y ?? 0).toBeGreaterThan(iconBox?.y ?? 0);
    expect((iconBox?.y ?? 0) + (iconBox?.height ?? 0)).toBeLessThanOrEqual(
        (progressBox?.y ?? 0) + 1,
    );
    expect(
        (progressBox?.y ?? 0) + (progressBox?.height ?? 0),
    ).toBeLessThanOrEqual((triggerBox?.y ?? 0) + (triggerBox?.height ?? 0) + 1);
    expect(dotBox?.x ?? 0).toBeGreaterThanOrEqual(
        (triggerBox?.x ?? 0) + (triggerBox?.width ?? 0) - 10,
    );
    expect(dotBox?.y ?? 0).toBeLessThan((triggerBox?.y ?? 0) + 2);
    const progressFontSize = await progress.evaluate(
        (node) => window.getComputedStyle(node).fontSize,
    );
    expect(progressFontSize).toBe('12px');
    const triggerBorderRadius = await trigger.evaluate((node) =>
        Number.parseFloat(window.getComputedStyle(node).borderRadius),
    );
    expect(triggerBorderRadius).toBeGreaterThanOrEqual(
        Math.round((triggerBox?.width ?? 0) / 2),
    );
    await expect(claimDot.locator('.animate-ping')).toHaveCount(1);
});

test('tutorial checklist modal uses claimable checklist cards and collapses completed days', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await mount(<TutorialChecklistHudStory />);

    await page.locator('[data-tutorial-checklist-trigger="true"]').click();
    const dialog = page.getByRole('dialog', { name: 'Zadaci za novi vrt' });
    await expect(dialog).toBeVisible();

    const modalTitle = dialog.locator(
        '[data-tutorial-checklist-modal-title="true"]',
    );
    await expect(modalTitle).toHaveText('Zadaci za novi vrt');
    const modalTitleStyle = await modalTitle.evaluate(
        (node) => node.getAttribute('style') ?? '',
    );
    expect(modalTitleStyle).toContain('--font-montserrat');
    await expect(dialog).not.toContainText('3/5 gotovo');
    await expect(dialog).not.toContainText('Dostupno');
    await expect(dialog).not.toContainText('60%');
    await expect(dialog).not.toContainText(/Otvoreno|Spremno/);

    const groups = dialog.locator('[data-tutorial-checklist-group]');
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0)).toHaveAttribute(
        'data-tutorial-checklist-group',
        'day-1',
    );
    await expect(groups.nth(1)).toHaveAttribute(
        'data-tutorial-checklist-group',
        'day-2',
    );
    await expect(groups.nth(1)).toHaveAttribute('data-group-complete', 'true');
    await expect(
        dialog.locator('[data-tutorial-checklist-group-tasks="day-2"]'),
    ).toHaveCount(0);

    const activeGroupTasks = groups
        .nth(0)
        .locator('[data-tutorial-checklist-task]');
    await expect(activeGroupTasks).toHaveCount(3);
    await expect(activeGroupTasks.nth(0)).toHaveAttribute(
        'data-tutorial-checklist-task',
        'day-1-task-2',
    );
    await expect(activeGroupTasks.nth(1)).toHaveAttribute(
        'data-tutorial-checklist-task',
        'day-1-task-3',
    );
    await expect(activeGroupTasks.nth(2)).toHaveAttribute(
        'data-tutorial-checklist-task',
        'day-1-task-1',
    );

    const completedTask = dialog.locator(
        '[data-tutorial-checklist-task="day-1-task-1"]',
    );
    await expect(
        completedTask.locator('[data-tutorial-checklist-marker="completed"]'),
    ).toBeVisible();

    const claimableTask = dialog.locator(
        '[data-tutorial-checklist-task="day-1-task-2"]',
    );
    await expect(claimableTask).toHaveAttribute(
        'data-tutorial-checklist-claimable',
        'true',
    );
    await expect(claimableTask).toHaveAttribute(
        'data-tutorial-checklist-completed',
        'false',
    );
    await expect(
        claimableTask.locator('[data-tutorial-checklist-marker="pending"]'),
    ).toBeVisible();
    await expect(
        claimableTask.locator('[data-tutorial-checklist-marker="pending"] svg'),
    ).toHaveCount(0);
    await expect(
        claimableTask.getByRole('button', { name: /\+10/ }),
    ).toBeVisible();
    await expect(claimableTask).not.toContainText('Preuzmi');

    const activeGroupClassName = await groups
        .nth(0)
        .evaluate((node) => node.className);
    expect(activeGroupClassName).toContain('bg-card');
    expect(activeGroupClassName).toContain('overflow-hidden');
    const activeGroupHeader = groups
        .nth(0)
        .getByRole('button', { name: /Dan 1/ });
    await expect
        .poll(async () => {
            const activeGroupBox = await groups.nth(0).boundingBox();
            const activeGroupHeaderBox = await activeGroupHeader.boundingBox();
            if (!activeGroupBox || !activeGroupHeaderBox) {
                return Number.POSITIVE_INFINITY;
            }

            return Math.abs(activeGroupHeaderBox.x - activeGroupBox.x);
        })
        .toBeLessThanOrEqual(2);
    await expect
        .poll(async () => {
            const activeGroupBox = await groups.nth(0).boundingBox();
            const activeGroupHeaderBox = await activeGroupHeader.boundingBox();
            if (!activeGroupBox || !activeGroupHeaderBox) {
                return Number.POSITIVE_INFINITY;
            }

            return Math.abs(activeGroupHeaderBox.width - activeGroupBox.width);
        })
        .toBeLessThanOrEqual(2);
    const activeGroupProgressClassName = await groups
        .nth(0)
        .getByText('1/3')
        .evaluate((node) => node.className);
    expect(activeGroupProgressClassName).toContain('min-h-8');

    const claimableStyles = await claimableTask.evaluate((node) => {
        const style = window.getComputedStyle(node);
        const before = window.getComputedStyle(node, '::before');

        return {
            animationName: before.animationName,
            backgroundColor: style.backgroundColor,
            backgroundImage: before.backgroundImage,
            className: node.className,
        };
    });
    expect(claimableStyles.animationName).toContain('tutorial-task-glow');
    expect(claimableStyles.backgroundImage).toContain('conic-gradient');
    expect(claimableStyles.className).toContain('bg-background');
    expect(claimableStyles.className).toContain('border-green-500');

    const claimButtonClassName = await claimableTask
        .getByRole('button', { name: /\+10/ })
        .evaluate((node) => node.className);
    expect(claimButtonClassName).toContain('bg-green-600');
    expect(claimButtonClassName).toContain('font-bold');

    const unfinishedTask = dialog.locator(
        '[data-tutorial-checklist-task="day-1-task-3"]',
    );
    await expect(unfinishedTask).toHaveAttribute(
        'data-tutorial-checklist-claimable',
        'false',
    );
    const unfinishedClassName = await unfinishedTask.evaluate(
        (node) => node.className,
    );
    expect(unfinishedClassName).toContain('bg-background');
    expect(unfinishedClassName).toContain('shadow-sm');

    const openButton = unfinishedTask.getByRole('button', { name: 'Otvori' });
    await expect(openButton).toBeVisible();
    await expect(openButton.locator('svg')).toHaveCount(0);
    const openButtonClassName = await openButton.evaluate(
        (node) => node.className,
    );
    expect(openButtonClassName).toContain('bg-background');
    expect(openButtonClassName).not.toContain('bg-white');

    await groups.nth(1).getByRole('button', { name: /Dan 2/ }).click();
    await expect(
        dialog.locator(
            '[data-tutorial-checklist-group-tasks="day-2"] [data-tutorial-checklist-task]',
        ),
    ).toHaveCount(2);
});

test('tutorial checklist modal uses readable dark mode surfaces', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await mount(<TutorialChecklistHudStory />);

    await page.locator('[data-tutorial-checklist-trigger="true"]').click();
    const dialog = page.getByRole('dialog', { name: 'Zadaci za novi vrt' });
    await expect(dialog).toBeVisible();

    const activeGroup = dialog.locator(
        '[data-tutorial-checklist-group="day-1"]',
    );
    const claimableTask = dialog.locator(
        '[data-tutorial-checklist-task="day-1-task-2"]',
    );
    const unfinishedTask = dialog.locator(
        '[data-tutorial-checklist-task="day-1-task-3"]',
    );
    const openButton = unfinishedTask.getByRole('button', { name: 'Otvori' });

    const dialogBackground = await dialog.evaluate(
        (node) => window.getComputedStyle(node).backgroundColor,
    );
    const groupBackground = await activeGroup.evaluate(
        (node) => window.getComputedStyle(node).backgroundColor,
    );
    const claimableBackground = await claimableTask.evaluate(
        (node) => window.getComputedStyle(node).backgroundColor,
    );
    const openButtonBackground = await openButton.evaluate(
        (node) => window.getComputedStyle(node).backgroundColor,
    );
    const titleColor = await claimableTask
        .getByText('Postavi biljku u gredicu')
        .evaluate((node) => window.getComputedStyle(node).color);
    const tokenColors = await page.evaluate(() => {
        const probe = document.createElement('div');
        document.body.append(probe);

        function readColor(value: string) {
            probe.style.color = value;
            return window.getComputedStyle(probe).color;
        }

        function readBackground(value: string) {
            probe.style.backgroundColor = value;
            return window.getComputedStyle(probe).backgroundColor;
        }

        const colors = {
            background: readBackground('hsl(var(--background))'),
            card: readBackground('hsl(var(--card))'),
            foreground: readColor('hsl(var(--foreground))'),
        };

        probe.remove();
        return colors;
    });

    expect(dialogBackground).toBe(tokenColors.background);
    expect(groupBackground).toBe(tokenColors.card);
    expect(claimableBackground).toBe(tokenColors.background);
    expect(openButtonBackground).toBe(tokenColors.background);
    expect(titleColor).toBe(tokenColors.foreground);
});

test('tutorial checklist animates only a newly completed cluster', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const component = await mount(<TutorialChecklistHudStory />);

    await page.locator('[data-tutorial-checklist-trigger="true"]').click();
    const dialog = page.getByRole('dialog', { name: 'Zadaci za novi vrt' });
    await expect(dialog).toBeVisible();

    await component.update(<TutorialChecklistHudStory variant="completed" />);

    const completeBanner = dialog.locator(
        '[data-tutorial-checklist-complete-banner="true"]',
    );
    const badge = completeBanner.locator(
        '[data-tutorial-checklist-complete-badge="true"]',
    );
    const completionCopy = completeBanner.locator(
        '[data-tutorial-checklist-complete-text="true"]',
    );
    const dismissAction = completeBanner.getByRole('button', {
        name: 'Sakrij popis',
    });

    await expect(completeBanner).toBeVisible();
    await expect(badge).toBeVisible();
    await expect(completionCopy).toBeVisible();
    await expect(dismissAction).toBeEnabled();

    const badgeAnimation = await badge.evaluate((node) => {
        const animation = node.getAnimations()[0];
        const effect = animation?.effect;
        if (!(effect instanceof KeyframeEffect)) {
            return null;
        }

        return {
            delay: effect.getTiming().delay,
            duration: effect.getTiming().duration,
            frames: effect.getKeyframes().map((frame) => ({
                opacity: frame.opacity,
                transform: frame.transform,
            })),
            timingFunction:
                window.getComputedStyle(node).animationTimingFunction,
        };
    });
    expect(badgeAnimation).toMatchObject({
        delay: 0,
        duration: 260,
        frames: [
            { opacity: '0', transform: 'scale(0.95)' },
            { opacity: '1', transform: 'scale(1)' },
        ],
        timingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    });

    const staggerDelays = await Promise.all(
        [completionCopy, dismissAction].map((part) =>
            part.evaluate((node) => {
                const effect = node.getAnimations()[0]?.effect;
                return effect instanceof KeyframeEffect
                    ? effect.getTiming().delay
                    : null;
            }),
        ),
    );
    expect(staggerDelays).toEqual([40, 80]);

    const staticRegionAnimationCounts = await Promise.all([
        completeBanner.evaluate((node) => node.getAnimations().length),
        dialog
            .locator('[data-tutorial-checklist-group]')
            .first()
            .evaluate((node) => node.getAnimations().length),
    ]);
    expect(staticRegionAnimationCounts).toEqual([0, 0]);
});

test('tutorial checklist already completed state renders settled', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await mount(<TutorialChecklistHudStory variant="completed" />);

    const trigger = page.locator('[data-tutorial-checklist-trigger="true"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute(
        'data-tutorial-checklist-complete',
        'true',
    );
    await expect(
        trigger.locator('[data-tutorial-checklist-complete-icon="true"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-tutorial-checklist-progress="true"]'),
    ).toHaveCount(0);
    await expect(
        page.locator('[data-tutorial-checklist-claim-dot="true"]'),
    ).toHaveCount(0);

    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Zadaci za novi vrt' });
    await expect(dialog).toBeVisible();

    const completeBanner = dialog.locator(
        '[data-tutorial-checklist-complete-banner="true"]',
    );
    await expect(completeBanner).toBeVisible();
    await expect(
        completeBanner.locator(
            '[data-tutorial-checklist-complete-text="true"]',
        ),
    ).toHaveText('Svi zadaci su dovršeni.');
    const completeBannerClassName = await completeBanner.evaluate(
        (node) => node.className,
    );
    expect(completeBannerClassName).toContain('bg-green-600');

    const completionAnimationCounts = await Promise.all([
        completeBanner
            .locator('[data-tutorial-checklist-complete-badge="true"]')
            .evaluate((node) => node.getAnimations().length),
        completeBanner
            .locator('[data-tutorial-checklist-complete-text="true"]')
            .evaluate((node) => node.getAnimations().length),
        completeBanner
            .getByRole('button', { name: 'Sakrij popis' })
            .evaluate((node) => node.getAnimations().length),
    ]);
    expect(completionAnimationCounts).toEqual([0, 0, 0]);
});

test('tutorial checklist completion dismissal is immediately actionable and persists', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const component = await mount(<TutorialChecklistHudStory />);

    await page.locator('[data-tutorial-checklist-trigger="true"]').click();
    await component.update(<TutorialChecklistHudStory variant="completed" />);

    const dismissAction = page
        .getByRole('dialog', { name: 'Zadaci za novi vrt' })
        .getByRole('button', { name: 'Sakrij popis' });
    await expect(dismissAction).toBeEnabled();
    await dismissAction.click({ force: true });

    await expect(
        page.locator('[data-tutorial-checklist-trigger="true"]'),
    ).toHaveCount(0);
    await expect
        .poll(() =>
            page.evaluate(() =>
                window.localStorage.getItem(
                    'game:tutorial-checklist:completed-dismissed-v1',
                ),
            ),
        )
        .not.toBeNull();
});

test('tutorial checklist completion uses an opacity-only reduced-motion entrance', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const component = await mount(<TutorialChecklistHudStory />);

    await page.locator('[data-tutorial-checklist-trigger="true"]').click();
    await component.update(<TutorialChecklistHudStory variant="completed" />);

    const completeBanner = page.locator(
        '[data-tutorial-checklist-complete-banner="true"]',
    );
    const completionParts = [
        completeBanner.locator(
            '[data-tutorial-checklist-complete-badge="true"]',
        ),
        completeBanner.locator(
            '[data-tutorial-checklist-complete-text="true"]',
        ),
        completeBanner.getByRole('button', { name: 'Sakrij popis' }),
    ];
    const animations = await Promise.all(
        completionParts.map((part) =>
            part.evaluate((node) => {
                const animation = node.getAnimations()[0];
                const effect = animation?.effect;
                if (!(effect instanceof KeyframeEffect)) {
                    return null;
                }

                return {
                    delay: effect.getTiming().delay,
                    duration: effect.getTiming().duration,
                    framesHaveTransform: effect
                        .getKeyframes()
                        .some((frame) => frame.transform !== undefined),
                };
            }),
        ),
    );

    expect(animations).toEqual([
        { delay: 0, duration: 120, framesHaveTransform: false },
        { delay: 40, duration: 120, framesHaveTransform: false },
        { delay: 80, duration: 120, framesHaveTransform: false },
    ]);
});

test('tutorial checklist completed dismissal returns when the task set changes', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const component = await mount(
        <TutorialChecklistHudStory variant="completed" />,
    );

    await page.locator('[data-tutorial-checklist-trigger="true"]').click();
    await page
        .getByRole('dialog', { name: 'Zadaci za novi vrt' })
        .getByRole('button', { name: 'Sakrij popis' })
        .click();
    await expect(
        page.locator('[data-tutorial-checklist-trigger="true"]'),
    ).toHaveCount(0);

    await component.update(
        <TutorialChecklistHudStory variant="completed-with-new-task" />,
    );

    const trigger = page.locator('[data-tutorial-checklist-trigger="true"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute(
        'data-tutorial-checklist-complete',
        'true',
    );
    await expect(
        trigger.locator('[data-tutorial-checklist-complete-icon="true"]'),
    ).toBeVisible();
});
