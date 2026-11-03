import { RegionalCalendarTable } from '@apps/www/components/plants/RegionalCalendarTable';
import type {
    RegionalCalendarCrop,
    RegionalCalendarRow,
} from '@apps/www/lib/plants/regionalCalendar';
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

const exampleCrop: RegionalCalendarCrop = {
    plantId: 0,
    slug: 'salata',
    name: 'Salata (primjer prikaza)',
    image: undefined,
    status: 'reviewed',
    // The table only reads the status, so the fixture carries no review record.
    review: undefined,
    rows: [exampleRow],
    availableSorts: [],
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
                    'Server-rendered month table grouped by crop, with keyboard scrolling. All story dates are illustrative fixtures, not grower-reviewed recommendations.',
            },
        },
    },
    args: { crops: [exampleCrop], currentMonth: 9 },
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
export const SelectedMonth: Story = { args: { selectedMonth: 10 } };
export const Unspecified: Story = {
    args: {
        crops: [
            {
                ...exampleCrop,
                status: 'missing',
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
        ],
    },
};
export const EmptyFilter: Story = {
    args: { crops: [{ ...exampleCrop, rows: [] }] },
};
export const Mobile: Story = {
    decorators: [
        (Story) => (
            <div className="max-w-[360px]">
                <Story />
            </div>
        ),
    ],
};
