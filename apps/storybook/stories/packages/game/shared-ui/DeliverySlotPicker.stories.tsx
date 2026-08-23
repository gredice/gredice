import {
    DeliverySlotPicker,
    type DeliverySlotPickerProps,
    type DeliverySlotPickerSlot,
} from '@packages/game/shared-ui/delivery/DeliverySlotPicker';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

const deliveryDates = [
    '2026-07-06',
    '2026-07-07',
    '2026-07-08',
    '2026-07-09',
    '2026-07-10',
    '2026-07-11',
    '2026-07-13',
    '2026-07-14',
    '2026-07-15',
    '2026-07-16',
    '2026-07-17',
    '2026-07-20',
    '2026-07-21',
    '2026-07-22',
    '2026-07-23',
    '2026-07-24',
    '2026-07-27',
    '2026-07-28',
    '2026-07-29',
    '2026-07-30',
    '2026-07-31',
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
];

const pickupDates = [
    '2026-07-08',
    '2026-07-11',
    '2026-07-13',
    '2026-07-15',
    '2026-07-20',
    '2026-07-22',
    '2026-07-27',
    '2026-07-29',
    '2026-08-03',
    '2026-08-05',
];

const deliveryTimes = [
    ['15:00:00.000Z', '17:00:00.000Z'],
    ['17:00:00.000Z', '19:00:00.000Z'],
] satisfies ReadonlyArray<readonly [string, string]>;

const pickupTimes = [
    ['15:00:00.000Z', '17:00:00.000Z'],
] satisfies ReadonlyArray<readonly [string, string]>;

function createMockSlots(
    dates: readonly string[],
    times: ReadonlyArray<readonly [string, string]>,
    initialId: number,
    fulfillment: DeliverySlotPickerSlot['fulfillment'],
): DeliverySlotPickerSlot[] {
    return dates.flatMap((date, dateIndex) =>
        times.map(([startTime, endTime], timeIndex) => ({
            id: initialId + dateIndex * 10 + timeIndex + 1,
            startAt: `${date}T${startTime}`,
            endAt: `${date}T${endTime}`,
            fulfillment,
        })),
    );
}

const deliverySlots = createMockSlots(
    deliveryDates,
    deliveryTimes,
    100,
    'delivery',
);
const pickupSlots = createMockSlots(pickupDates, pickupTimes, 600, 'pickup');
const mixedSlots = [...deliverySlots, ...pickupSlots].sort(
    (first, second) =>
        new Date(first.startAt).getTime() - new Date(second.startAt).getTime(),
);
const slotsWithoutCurrentWeekAvailability = mixedSlots.filter(
    (slot) => !new Date(slot.startAt).toISOString().startsWith('2026-07-11'),
);
const slotsWithEmptyWeek = mixedSlots.filter((slot) => {
    const startAt = new Date(slot.startAt).toISOString();
    return startAt < '2026-07-20' || startAt >= '2026-07-27';
});

const meta = {
    title: 'packages/game/shared-ui/delivery/DeliverySlotPicker',
    component: DeliverySlotPicker,
    tags: ['autodocs'],
    args: {
        slots: mixedSlots,
        value: undefined,
        onValueChange: () => {},
        referenceDate: '2026-07-10T10:00:00.000Z',
    },
    argTypes: {
        onValueChange: { control: false },
        value: { control: false },
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Interactive date and time picker for in-game delivery or pickup checkout, with week navigation for longer availability windows.',
            },
        },
    },
    render: (args) => (
        <div className="w-[40rem] max-w-full rounded-xl border border-border bg-card p-5 shadow-sm">
            <ControlledDeliverySlotPicker {...args} />
        </div>
    ),
} satisfies Meta<typeof DeliverySlotPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Interactive: Story = {};

export const FourWeeks: Story = {
    args: {
        value: 161,
    },
};

export const NoSelection: Story = {
    args: {
        autoSelectFirstDeliverySlot: false,
        slots: slotsWithoutCurrentWeekAvailability,
        value: undefined,
    },
};

export const EmptyWeek: Story = {
    args: {
        slots: slotsWithEmptyWeek,
        value: 161,
    },
};

export const Pickup: Story = {
    args: {
        slots: pickupSlots,
        value: 611,
        label: 'Termin preuzimanja',
        description:
            'Odaberi dan i vrijeme osobnog preuzimanja na lokaciji Gredice HQ.',
    },
};

export const Loading: Story = {
    args: {
        loading: true,
        slots: [],
        value: undefined,
    },
};

export const Empty: Story = {
    args: {
        slots: [],
        value: undefined,
    },
};

export const Disabled: Story = {
    args: {
        disabled: true,
    },
};

export const MobileWidth: Story = {
    args: {
        value: 151,
    },
    parameters: {
        layout: 'fullscreen',
    },
    render: (args) => (
        <div className="min-h-screen w-full bg-background p-4">
            <div className="mx-auto w-full max-w-[21rem] rounded-xl border border-border bg-card p-4 shadow-sm">
                <ControlledDeliverySlotPicker {...args} />
            </div>
        </div>
    ),
};

function ControlledDeliverySlotPicker(args: DeliverySlotPickerProps) {
    const [value, setValue] = useState(args.value);

    return (
        <DeliverySlotPicker {...args} value={value} onValueChange={setValue} />
    );
}
