import {
    type HarvestScheduleDateSelection,
    HarvestScheduleStep,
    type HarvestScheduleStepProps,
} from '@packages/game/shared-ui/delivery/HarvestScheduleStep';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

const validItems: HarvestScheduleStepProps['items'] = [
    {
        cartItemId: 41,
        operationLabel: 'Berba salate',
        raisedBedLabel: 'Gredica 12',
        plants: [
            {
                id: 101,
                label: 'Salata',
                maxHarvestDaysBeforeDelivery: 0,
            },
        ],
        scheduledDate: '2026-07-24',
        allowedFrom: '2026-07-24',
        allowedTo: '2026-07-24',
        valid: true,
    },
    {
        cartItemId: 42,
        operationLabel: 'Berba mrkve',
        raisedBedLabel: 'Gredica 8',
        plants: [
            {
                id: 102,
                label: 'Mrkva',
                maxHarvestDaysBeforeDelivery: 3,
            },
        ],
        scheduledDate: '2026-07-22',
        allowedFrom: '2026-07-21',
        allowedTo: '2026-07-24',
        valid: true,
    },
];

const meta = {
    title: 'packages/game/shared-ui/delivery/HarvestScheduleStep',
    component: HarvestScheduleStep,
    tags: ['autodocs'],
    args: {
        delivery: {
            deliveryDate: '2026-07-24',
            mode: 'delivery',
            startAt: '2026-07-24T15:00:00.000Z',
            endAt: '2026-07-24T17:00:00.000Z',
            destinationLabel: 'Dom — Ilica 1, Zagreb',
        },
        items: validItems,
        onSelectedDatesChange: () => {},
        onBack: () => {},
        onConfirm: () => {},
    },
    argTypes: {
        confirmAction: { control: false },
        onBack: { control: false },
        onConfirm: { control: false },
        onSelectedDatesChange: { control: false },
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Final checkout step that summarizes delivery and keeps every harvest date inside the freshness window of its plants.',
            },
        },
    },
    render: (args) => <HarvestScheduleStepStory {...args} />,
} satisfies Meta<typeof HarvestScheduleStep>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllDatesValid: Story = {};

export const NeedsAdjustment: Story = {
    args: {
        items: [
            {
                ...validItems[0],
                scheduledDate: '2026-07-22',
                valid: false,
                validationReason: 'before_allowed_range',
            },
            {
                ...validItems[1],
                scheduledDate: '2026-07-20',
                valid: false,
                validationReason: 'before_allowed_range',
            },
        ],
    },
};

export const Pickup: Story = {
    args: {
        delivery: {
            deliveryDate: '2026-07-24',
            mode: 'pickup',
            startAt: '2026-07-24T15:00:00.000Z',
            endAt: '2026-07-24T17:00:00.000Z',
            destinationLabel: 'Gredice HQ',
        },
    },
};

export const Confirming: Story = {
    args: {
        isConfirming: true,
    },
};

export const MobileWidth: Story = {
    parameters: {
        layout: 'fullscreen',
    },
    render: (args) => (
        <div className="min-h-screen w-full bg-background p-4">
            <div className="mx-auto w-full max-w-[22rem] rounded-xl border border-border bg-card p-4 shadow-sm">
                <HarvestScheduleStepStory {...args} />
            </div>
        </div>
    ),
};

function HarvestScheduleStepStory(args: HarvestScheduleStepProps) {
    const [selections, setSelections] = useState<
        readonly HarvestScheduleDateSelection[]
    >([]);

    return (
        <div className="w-[40rem] max-w-full rounded-xl border border-border bg-background p-5 shadow-sm">
            <HarvestScheduleStep
                {...args}
                onSelectedDatesChange={setSelections}
                onConfirm={setSelections}
            />
            <output aria-label="Odabrani datumi branja" className="sr-only">
                {JSON.stringify(selections)}
            </output>
        </div>
    );
}
