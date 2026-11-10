import { DashboardColumnChart } from '@apps/app/components/admin/dashboard/DashboardColumnChart';
import { formatDashboardNumber } from '@apps/app/components/admin/dashboard/dashboardFormat';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/app/Admin/DashboardColumnChart',
    component: DashboardColumnChart,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Daily admin metrics with hover details and a keyboard-operable data table. Future days have no values.',
            },
        },
    },
    args: {
        title: 'Registracije korisnika po danu',
        series: [
            {
                key: 'registrations',
                label: 'Registracije',
                colorClassName: 'bg-primary',
            },
        ],
        columns: [
            {
                key: 'mon',
                label: 'pon',
                description: 'Ponedjeljak',
                values: { registrations: 12 },
            },
            {
                key: 'tue',
                label: 'uto',
                description: 'Utorak',
                values: { registrations: 3 },
            },
            {
                key: 'wed',
                label: 'sri',
                description: 'Srijeda',
                values: { registrations: 0 },
            },
            { key: 'thu', label: 'čet', description: 'Četvrtak' },
            { key: 'fri', label: 'pet', description: 'Petak' },
            { key: 'sat', label: 'sub', description: 'Subota' },
            { key: 'sun', label: 'ned', description: 'Nedjelja' },
        ],
        formatValue: formatDashboardNumber,
        emptyMessage: 'Nema registracija ovaj tjedan.',
    },
    render: (args) => (
        <div className="w-full max-w-96">
            <DashboardColumnChart {...args} />
        </div>
    ),
} satisfies Meta<typeof DashboardColumnChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = {
    args: {
        columns: meta.args.columns.map((column) => ({
            ...column,
            values: column.values ? { registrations: 0 } : undefined,
        })),
    },
};
export const EarnedAndSpent: Story = {
    args: {
        title: 'Zarađeni i potrošeni suncokreti',
        series: [
            { key: 'earned', label: 'Zarađeno', colorClassName: 'bg-primary' },
            {
                key: 'spent',
                label: 'Potrošeno',
                colorClassName: 'bg-amber-600 dark:bg-amber-400',
                below: true,
            },
        ],
        columns: [
            {
                key: 'mon',
                label: 'pon',
                description: 'Ponedjeljak',
                values: { earned: 3500, spent: 1200 },
            },
            {
                key: 'tue',
                label: 'uto',
                description: 'Utorak',
                values: { earned: 500, spent: 2100 },
            },
            { key: 'wed', label: 'sri', description: 'Srijeda' },
        ],
        emptyMessage: 'Nema transakcija ovaj tjedan.',
    },
};
export const Narrow: Story = {
    render: (args) => (
        <div className="w-64">
            <DashboardColumnChart {...args} />
        </div>
    ),
};
