import { DashboardChartCard } from '@apps/app/components/admin/dashboard/DashboardChartCard';
import { DashboardColumnChart } from '@apps/app/components/admin/dashboard/DashboardColumnChart';
import { formatDashboardNumber } from '@apps/app/components/admin/dashboard/dashboardFormat';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/app/Admin/DashboardChartCard',
    component: DashboardChartCard,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Admin analytics card with a linked heading, metric, context, and chart. Only the heading navigates so chart data remains interactive.',
            },
        },
    },
    args: {
        title: 'Registracije',
        href: '/admin/statistics/users',
        value: '15',
        detail: 'Ovaj tjedan · 2 dana s registracijama',
        children: (
            <DashboardColumnChart
                title="Registracije korisnika po danu"
                series={[
                    {
                        key: 'registrations',
                        label: 'Registracije',
                        colorClassName: 'bg-primary',
                    },
                ]}
                columns={[
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
                    { key: 'wed', label: 'sri', description: 'Srijeda' },
                ]}
                formatValue={formatDashboardNumber}
                emptyMessage="Nema registracija ovaj tjedan."
            />
        ),
    },
    render: (args) => (
        <div className="w-full max-w-96">
            <DashboardChartCard {...args} />
        </div>
    ),
} satisfies Meta<typeof DashboardChartCard>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const LongContent: Story = {
    args: {
        title: 'Registracije korisnika i pregled aktivnosti ovog tjedna',
        detail: 'Pregled dnevnih registracija korisnika u odabranom tjednu od ponedjeljka do nedjelje.',
    },
    render: (args) => (
        <div className="w-64">
            <DashboardChartCard {...args} />
        </div>
    ),
};
