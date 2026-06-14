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
    expect(
        (progressBox?.y ?? 0) + (progressBox?.height ?? 0),
    ).toBeLessThanOrEqual((triggerBox?.y ?? 0) + (triggerBox?.height ?? 0) + 1);
    expect(dotBox?.x ?? 0).toBeGreaterThan(
        (triggerBox?.x ?? 0) + (triggerBox?.width ?? 0) - 10,
    );
    expect(dotBox?.y ?? 0).toBeLessThan((triggerBox?.y ?? 0) + 2);
    const progressFontSize = await progress.evaluate(
        (node) => window.getComputedStyle(node).fontSize,
    );
    expect(progressFontSize).toBe('12px');
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
    expect(activeGroupClassName).toContain('bg-white');
    expect(activeGroupClassName).toContain('overflow-hidden');
    const activeGroupHeader = groups
        .nth(0)
        .getByRole('button', { name: /Dan 1/ });
    const activeGroupBox = await groups.nth(0).boundingBox();
    const activeGroupHeaderBox = await activeGroupHeader.boundingBox();
    expect(activeGroupBox).not.toBeNull();
    expect(activeGroupHeaderBox).not.toBeNull();
    expect(
        Math.abs((activeGroupHeaderBox?.x ?? 0) - (activeGroupBox?.x ?? 0)),
    ).toBeLessThanOrEqual(1);
    expect(
        Math.abs(
            (activeGroupHeaderBox?.width ?? 0) - (activeGroupBox?.width ?? 0),
        ),
    ).toBeLessThanOrEqual(2);
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
    expect(claimableStyles.className).toContain('bg-green-50');

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
    expect(unfinishedClassName).toContain('bg-transparent');
    expect(unfinishedClassName).toContain('shadow-sm');

    const openButton = unfinishedTask.getByRole('button', { name: 'Otvori' });
    await expect(openButton).toBeVisible();
    await expect(openButton.locator('svg')).toHaveCount(0);
    const openButtonClassName = await openButton.evaluate(
        (node) => node.className,
    );
    expect(openButtonClassName).toContain('bg-white');

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

    expect(dialogBackground).not.toBe('rgb(255, 255, 255)');
    expect(groupBackground).not.toBe('rgb(255, 255, 255)');
    expect(claimableBackground).not.toBe('rgb(240, 253, 244)');
    expect(openButtonBackground).not.toBe('rgb(255, 255, 255)');
    expect(titleColor).not.toBe('rgb(20, 83, 45)');
});
