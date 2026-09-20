import { RegionalCalendarTable } from '@apps/www/components/plants/RegionalCalendarTable';
import type { RegionalCalendarRow } from '@apps/www/lib/plants/regionalCalendar';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

// Illustrative fixture only. This is not regional planting advice.
const exampleRow: RegionalCalendarRow = {
    key: 'example-sowing',
    plantId: 0,
    slug: 'salata',
    plantName: 'Salata (primjer prikaza)',
    activity: 'sowing',
    label: 'Izravna sjetva',
    color: 'bg-yellow-400',
    environment: 'Na otvorenom',
    varietyNotes: 'Testni podaci za prikaz, nisu preporuka za uzgoj.',
    ranges: [{ start: 9, end: 10 }],
    months: [
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        true,
        true,
        false,
        false,
    ],
    period: 'rujan – listopad',
};

const meta = {
    title: 'apps/www/Plants/RegionalCalendarTable',
    component: RegionalCalendarTable,
    tags: ['autodocs'],
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component:
                    'Server-rendered month table with keyboard scrolling. All story dates are illustrative fixtures, not grower-reviewed recommendations.',
            },
        },
    },
    args: { rows: [exampleRow] },
    decorators: [
        (Story) => (
            <div className="p-4">
                <Story />
            </div>
        ),
    ],
} satisfies Meta<typeof RegionalCalendarTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ReviewedPeriodExample: Story = {};
export const Unspecified: Story = {
    args: {
        rows: [
            {
                ...exampleRow,
                ranges: [],
                months: Array.from({ length: 12 }, () => false),
                environment: 'Nije potvrđeno',
                period: 'Nije navedeno',
            },
        ],
    },
};
export const EmptyFilter: Story = { args: { rows: [] } };
export const Mobile: Story = {
    decorators: [
        (Story) => (
            <div className="max-w-[360px]">
                <Story />
            </div>
        ),
    ],
};
