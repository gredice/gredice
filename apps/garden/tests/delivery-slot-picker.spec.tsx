import { expect, test } from '@playwright/experimental-ct-react';
import { DeliverySlotPickerStory } from './DeliverySlotPickerStory';

const referenceDate = '2026-07-17T10:00:00.000Z';

test('allows an open same-day slot while keeping missed days clickable', async ({
    mount,
    page,
}) => {
    await mount(
        <DeliverySlotPickerStory
            autoSelectFirstDeliverySlot={false}
            referenceDate={referenceDate}
            slots={[
                {
                    disabled: true,
                    endAt: '2026-07-16T10:00:00.000Z',
                    fulfillment: 'delivery',
                    id: 1,
                    startAt: '2026-07-16T08:00:00.000Z',
                },
                {
                    endAt: '2026-07-17T15:00:00.000Z',
                    fulfillment: 'delivery',
                    id: 2,
                    startAt: '2026-07-17T13:00:00.000Z',
                },
            ]}
        />,
    );

    const missedDay = page.getByRole('button', { name: /16\. srpnja/i });
    await expect(missedDay).toBeEnabled();
    await missedDay.click();
    await expect(
        page.getByRole('button', {
            name: /10:00 – 12:00, dostava, nije dostupno/i,
        }),
    ).toBeDisabled();

    const today = page.getByRole('button', { name: /17\. srpnja.*danas/i });
    await expect(today).toBeEnabled();
    await today.click();

    const openSameDaySlot = page.getByRole('button', {
        name: /15:00 – 17:00, dostava$/i,
    });
    await expect(openSameDaySlot).toBeEnabled();
    await openSameDaySlot.click();
    await expect(page.getByTestId('selected-delivery-slot')).toHaveText('2');
});

test('opens on the current week even when its slots are already missed', async ({
    mount,
    page,
}) => {
    await mount(
        <DeliverySlotPickerStory
            autoSelectFirstDeliverySlot
            referenceDate={referenceDate}
            slots={[
                {
                    disabled: true,
                    endAt: '2026-07-16T10:00:00.000Z',
                    fulfillment: 'delivery',
                    id: 1,
                    startAt: '2026-07-16T08:00:00.000Z',
                },
                {
                    endAt: '2026-07-20T10:00:00.000Z',
                    fulfillment: 'delivery',
                    id: 2,
                    startAt: '2026-07-20T08:00:00.000Z',
                },
            ]}
        />,
    );

    await expect(
        page.getByText('Tjedan 13. srp – 19. srp 2026.'),
    ).toBeVisible();
    await expect(page.getByTestId('selected-delivery-slot')).toHaveText('');
});

test('keeps time slots within a mobile-width container', async ({
    mount,
    page,
}) => {
    await mount(
        <DeliverySlotPickerStory
            containerClassName="w-[21rem]"
            referenceDate={referenceDate}
            slots={[
                {
                    endAt: '2026-07-17T17:00:00.000Z',
                    fulfillment: 'delivery',
                    id: 1,
                    startAt: '2026-07-17T15:00:00.000Z',
                },
                {
                    endAt: '2026-07-17T19:00:00.000Z',
                    fulfillment: 'pickup',
                    id: 2,
                    startAt: '2026-07-17T17:00:00.000Z',
                },
                {
                    endAt: '2026-07-17T21:00:00.000Z',
                    fulfillment: 'delivery',
                    id: 3,
                    startAt: '2026-07-17T19:00:00.000Z',
                },
            ]}
        />,
    );

    const timeSlots = page.getByRole('group', {
        name: /Odaberi vrijeme za/i,
    });
    await expect(timeSlots).toBeVisible();
    await expect
        .poll(() =>
            timeSlots.evaluate(
                (element) => element.scrollWidth <= element.clientWidth,
            ),
        )
        .toBe(true);
});
