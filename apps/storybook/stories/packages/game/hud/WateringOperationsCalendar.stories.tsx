import { WateringOperationsCalendar } from '@packages/game/hud/raisedBed/WateringOperationsCalendar';
import type { WateringCalendarEntry } from '@packages/game/hud/raisedBed/wateringCalendarModel';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const referenceDate = new Date('2026-06-18T12:00:00.000Z');

const entries: WateringCalendarEntry[] = [
    {
        id: 'completed-light',
        date: '2026-04-29T08:00:00.000Z',
        label: 'Lagano zalijevanje gredice',
        source: 'completed',
        weight: 15,
    },
    {
        id: 'completed-medium',
        date: '2026-05-10T08:00:00.000Z',
        label: 'Površinsko zalijevanje gredice',
        source: 'completed',
        weight: 35,
    },
    {
        id: 'completed-large',
        date: '2026-05-24T08:00:00.000Z',
        label: 'Dubinsko zalijevanje gredice',
        source: 'completed',
        weight: 90,
    },
    {
        id: 'scheduled',
        date: '2026-07-08T08:00:00.000Z',
        label: 'Zakazano zalijevanje',
        source: 'scheduled',
        weight: 45,
    },
    {
        id: 'cart',
        date: '2026-07-17T08:00:00.000Z',
        label: 'Zalijevanje u košari',
        source: 'cart',
        weight: 30,
    },
    {
        id: 'preview',
        date: '2026-07-21T08:00:00.000Z',
        label: 'Novi termin zalijevanja',
        source: 'preview',
        weight: 60,
    },
    {
        id: 'future-large',
        date: '2026-07-25T08:00:00.000Z',
        label: 'Veliko zakazano zalijevanje',
        source: 'scheduled',
        weight: 120,
    },
];

const meta = {
    title: 'packages/game/hud/raisedBed/WateringOperationsCalendar',
    component: WateringOperationsCalendar,
    tags: ['autodocs'],
    args: {
        entries,
        referenceDate,
    },
    parameters: {
        docs: {
            description: {
                component:
                    'Small raised-bed watering calendar for completed, scheduled, cart, and newly previewed watering operations.',
            },
        },
    },
    render: (args) => (
        <div className="min-h-screen bg-[#c7be74] p-8">
            <div className="w-[22rem] max-w-full">
                <WateringOperationsCalendar {...args} />
            </div>
        </div>
    ),
} satisfies Meta<typeof WateringOperationsCalendar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RaisedBedWateringTimeline: Story = {
    name: 'Raised bed watering timeline',
};
