import {
    EventCalendar,
    type EventCalendarEntry,
} from '@gredice/ui/EventCalendar';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ComponentProps, useState } from 'react';

const referenceDate = new Date('2026-06-18T12:00:00.000Z');
const selectableFrom = new Date('2026-06-19T00:00:00.000Z');
const selectableTo = new Date('2026-09-19T00:00:00.000Z');

const entries: EventCalendarEntry[] = [
    {
        id: 'completed-light',
        date: '2026-06-08T08:00:00.000Z',
        label: 'Lagano zalijevanje gredice',
        meta: 'Obavljeno · 15 min',
        tone: 'completed',
        weight: 15,
    },
    {
        id: 'completed-medium',
        date: '2026-06-10T08:00:00.000Z',
        label: 'Površinsko zalijevanje gredice',
        meta: 'Obavljeno · 35 min',
        tone: 'completed',
        weight: 35,
    },
    {
        id: 'scheduled',
        date: '2026-07-08T08:00:00.000Z',
        label: 'Zakazano zalijevanje',
        meta: 'Zakazano · 45 min',
        tone: 'scheduled',
        weight: 45,
    },
    {
        id: 'cart',
        date: '2026-07-17T08:00:00.000Z',
        label: 'Zalijevanje u košari',
        meta: 'U košari · 30 min',
        tone: 'cart',
        weight: 30,
    },
    {
        id: 'preview',
        date: '2026-07-21T08:00:00.000Z',
        label: 'Novi termin zalijevanja',
        meta: 'Novi termin · 60 min',
        tone: 'preview',
        weight: 60,
    },
];

const selectedTodayEntries: EventCalendarEntry[] = [
    {
        id: 'today-completed',
        date: referenceDate,
        label: 'Obavljeno zalijevanje',
        tone: 'completed',
    },
    {
        id: 'today-scheduled',
        date: referenceDate,
        label: 'Planirano zalijevanje',
        tone: 'scheduled',
    },
    {
        id: 'today-cart',
        date: referenceDate,
        label: 'Zalijevanje u košari',
        tone: 'cart',
    },
];

function SelectableScheduleStory(args: ComponentProps<typeof EventCalendar>) {
    const [selectedDate, setSelectedDate] = useState(
        new Date('2026-06-20T00:00:00.000Z'),
    );

    return (
        <div className="min-h-screen bg-[#c7be74] p-8">
            <div className="w-[22rem] max-w-full">
                <EventCalendar
                    {...args}
                    maxSelectableDate={selectableTo}
                    minSelectableDate={selectableFrom}
                    onDateSelect={setSelectedDate}
                    selectedDate={selectedDate}
                    visibleFrom={selectableFrom}
                    visibleTo={selectableTo}
                />
            </div>
        </div>
    );
}

const meta = {
    title: 'packages/ui/EventCalendar',
    component: EventCalendar,
    tags: ['autodocs'],
    args: {
        entries,
        referenceDate,
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Shared calendar for compact operation and event timelines, including selectable scheduling dates and tap-friendly day details.',
            },
        },
    },
    render: (args) => (
        <div className="min-h-screen bg-[#c7be74] p-8">
            <div className="w-[22rem] max-w-full">
                <EventCalendar {...args} />
            </div>
        </div>
    ),
} satisfies Meta<typeof EventCalendar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Timeline: Story = {
    name: 'Timeline',
};

export const SelectableSchedule: Story = {
    name: 'Selectable schedule',
    render: SelectableScheduleStory,
};

export const SelectedTodayWithEntries: Story = {
    name: 'Selected today with entries',
    args: {
        entries: selectedTodayEntries,
        selectedDate: referenceDate,
        visibleFrom: new Date('2026-06-01T00:00:00.000Z'),
        visibleTo: new Date('2026-06-30T23:59:59.999Z'),
    },
};
