import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import { getMinimumDiaryRescheduleDateInput } from '../../../packages/game/src/hooks/useRescheduleDiaryEntry';
import { RaisedBedDiaryOverflowStory } from './RaisedBedDiaryStory';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const TABLET_VIEWPORT = { width: 1024, height: 768 };
const TEST_GARDEN_ID = 1;
const TEST_RAISED_BED_ID = 101;

type ShoppingCartPostPayload = {
    additionalData?: unknown;
    amount?: unknown;
    cartId?: unknown;
    currency?: unknown;
    entityId?: unknown;
    entityTypeName?: unknown;
    gardenId?: unknown;
    positionIndex?: unknown;
    raisedBedId?: unknown;
};

function isShoppingCartPostPayload(
    value: unknown,
): value is ShoppingCartPostPayload {
    return typeof value === 'object' && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function parseScheduledDate(payload: ShoppingCartPostPayload) {
    expect(typeof payload.additionalData).toBe('string');

    if (typeof payload.additionalData !== 'string') {
        throw new Error('Scheduled operation data is not a string');
    }

    const parsed: unknown = JSON.parse(payload.additionalData);

    expect(isRecord(parsed)).toBe(true);

    if (!isRecord(parsed)) {
        throw new Error('Scheduled operation data is not an object');
    }

    return parsed.scheduledDate;
}

async function captureShoppingCartPost(
    page: Page,
    {
        body = { success: true },
        status = 200,
    }: { body?: unknown; status?: number } = {},
) {
    let resolvePayload: ((payload: unknown) => void) | undefined;
    const payloadPromise = new Promise<unknown>((resolve) => {
        resolvePayload = resolve;
    });

    await page.route('**/*', async (route) => {
        const request = route.request();
        if (
            request.method() !== 'POST' ||
            !request.url().includes('/shopping-cart')
        ) {
            await route.fallback();
            return;
        }

        resolvePayload?.(request.postDataJSON());
        await route.fulfill({
            body: JSON.stringify(body),
            contentType: 'application/json',
            status,
        });
    });

    return { payloadPromise };
}

function expectBaseSchedulingPayload(
    payload: unknown,
    {
        entityId,
        positionIndex,
        selectedDate,
    }: {
        entityId: string;
        positionIndex?: number;
        selectedDate: string;
    },
) {
    expect(isShoppingCartPostPayload(payload)).toBe(true);

    if (!isShoppingCartPostPayload(payload)) {
        throw new Error('Shopping cart request payload is not an object');
    }

    expect(payload).toMatchObject({
        amount: 1,
        cartId: 1,
        currency: 'eur',
        entityId,
        entityTypeName: 'operation',
        gardenId: TEST_GARDEN_ID,
        raisedBedId: TEST_RAISED_BED_ID,
    });
    expect(parseScheduledDate(payload)).toBe(
        new Date(selectedDate).toISOString(),
    );

    if (typeof positionIndex === 'number') {
        expect(payload.positionIndex).toBe(positionIndex);
    } else {
        expect(payload).not.toHaveProperty('positionIndex');
    }
}

function formatDateInput(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function defaultScheduleDateInput() {
    const today = new Date();
    return formatDateInput(
        new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
    );
}

async function expectCalendarDatePicker(scheduleDialog: Locator) {
    await expect(scheduleDialog.locator('[data-event-calendar]')).toBeVisible();
    await expect(scheduleDialog.getByLabel('Željeni datum radnje')).toHaveCount(
        0,
    );

    return defaultScheduleDateInput();
}

async function expectNoHorizontalOverflow(locator: Locator) {
    const overflow = await locator.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
    }));

    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function openSavedAiDiaryEntry(page: Page) {
    const aiEntry = page.locator('[data-diary-entry]').nth(1);

    await aiEntry
        .getByRole('button', {
            name: 'Klikni za prikaz savjeta suncokreta',
        })
        .click();
}

test('raised bed diary entries stay inside a narrow mobile card', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mount(<RaisedBedDiaryOverflowStory />);

    const shell = page.getByTestId('diary-shell');
    const list = page.locator('[data-diary-list]');
    const entries = page.locator('[data-diary-entry]');

    await expect(list).toBeVisible();
    await expect(entries).toHaveCount(3);

    await expectNoHorizontalOverflow(shell);
    await expectNoHorizontalOverflow(list);

    const overflowingEntries = await entries.evaluateAll((elements) =>
        elements
            .map((element, index) => ({
                clientWidth: element.clientWidth,
                index,
                scrollWidth: element.scrollWidth,
            }))
            .filter(
                ({ clientWidth, scrollWidth }) => scrollWidth > clientWidth + 1,
            ),
    );

    expect(overflowingEntries).toEqual([]);
});

test('single-image diary entries keep text close to the thumbnail', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    await mount(<RaisedBedDiaryOverflowStory />);

    const firstEntry = page.locator('[data-diary-entry]').first();
    const imageBox = await firstEntry
        .locator('[data-diary-entry-images]')
        .boundingBox();
    const contentBox = await firstEntry
        .locator('[data-diary-entry-content]')
        .boundingBox();

    expect(imageBox).not.toBeNull();
    expect(contentBox).not.toBeNull();

    const imageRight = (imageBox?.x ?? 0) + (imageBox?.width ?? 0);
    const textGap = (contentBox?.x ?? 0) - imageRight;

    expect(textGap).toBeLessThanOrEqual(24);
});

test('future planned diary entries expose the in-game reschedule action', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mount(<RaisedBedDiaryOverflowStory />);

    const rescheduleButtons = page.getByRole('button', {
        name: 'Prerasporedi',
    });
    await expect(rescheduleButtons).toHaveCount(1);

    await rescheduleButtons.first().click();

    const dateInput = page.getByLabel('Novi datum');
    await expect(dateInput).toBeVisible();
    await expect(dateInput).toHaveAttribute(
        'min',
        getMinimumDiaryRescheduleDateInput(),
    );
});

test('future planned diary entries expose cancel confirmation', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await mount(<RaisedBedDiaryOverflowStory />);

    const cancelButtons = page.getByRole('button', {
        name: 'Otkaži',
    });
    await expect(cancelButtons).toHaveCount(1);

    await cancelButtons.first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Otkaži radnju')).toBeVisible();
    await expect(
        dialog.getByText('Otkazivanje se ne može poništiti.'),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Otkaži' })).toBeVisible();
});

test('saved AI operation links render as scheduling chips', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    const { payloadPromise: scheduledPayload } =
        await captureShoppingCartPost(page);
    await mount(<RaisedBedDiaryOverflowStory />);

    await openSavedAiDiaryEntry(page);

    const dialog = page.getByRole('dialog');
    const chips = dialog.locator('[data-ai-operation-chip]');
    await expect(chips).toHaveCount(2);
    await expect(
        dialog.getByRole('button', { name: 'Malčiranje gredice' }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Zalijevanje biljke - polje 6' }),
    ).toBeVisible();

    await dialog.getByRole('button', { name: 'Malčiranje gredice' }).click();

    const scheduleDialog = page.getByRole('dialog', {
        name: 'Zakaži radnju: Malčiranje gredice',
    });
    await expect(scheduleDialog.getByText('Zakazivanje radnje')).toBeVisible();
    await expect(
        scheduleDialog.getByText('Malčiranje gredice', { exact: true }),
    ).toBeVisible();

    const selectedDate = await expectCalendarDatePicker(scheduleDialog);
    await scheduleDialog.getByRole('button', { name: 'Potvrdi' }).click();

    expectBaseSchedulingPayload(await scheduledPayload, {
        entityId: '77',
        selectedDate,
    });
});

test('saved AI plant operation chip schedules the targeted field', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    const { payloadPromise: scheduledPayload } =
        await captureShoppingCartPost(page);
    await mount(<RaisedBedDiaryOverflowStory />);

    await openSavedAiDiaryEntry(page);

    const dialog = page.getByRole('dialog');
    await dialog
        .getByRole('button', { name: 'Zalijevanje biljke - polje 6' })
        .click();

    const scheduleDialog = page.getByRole('dialog', {
        name: 'Zakaži radnju: Zalijevanje biljke',
    });
    const selectedDate = await expectCalendarDatePicker(scheduleDialog);
    await scheduleDialog.getByRole('button', { name: 'Potvrdi' }).click();

    expectBaseSchedulingPayload(await scheduledPayload, {
        entityId: '88',
        positionIndex: 5,
        selectedDate,
    });
});

test('saved AI operation scheduling failures stay recoverable', async ({
    mount,
    page,
}) => {
    await page.setViewportSize(TABLET_VIEWPORT);
    const { payloadPromise: scheduledPayload } = await captureShoppingCartPost(
        page,
        {
            body: { error: 'Failed to schedule operation' },
            status: 500,
        },
    );
    await mount(<RaisedBedDiaryOverflowStory />);

    await openSavedAiDiaryEntry(page);

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Malčiranje gredice' }).click();

    const scheduleDialog = page.getByRole('dialog', {
        name: 'Zakaži radnju: Malčiranje gredice',
    });
    const selectedDate = await expectCalendarDatePicker(scheduleDialog);
    await scheduleDialog.getByRole('button', { name: 'Potvrdi' }).click();

    expectBaseSchedulingPayload(await scheduledPayload, {
        entityId: '77',
        selectedDate,
    });
    await expect(
        scheduleDialog.getByText('Zakazivanje nije uspjelo. Pokušaj ponovno.'),
    ).toBeVisible();
    await expect(
        scheduleDialog.getByRole('button', { name: 'Potvrdi' }),
    ).toBeEnabled();
    await expect(
        scheduleDialog.getByRole('button', { name: 'Odustani' }),
    ).toBeEnabled();

    await scheduleDialog.getByRole('button', { name: 'Odustani' }).click();
    await expect(scheduleDialog).toBeHidden();
});
