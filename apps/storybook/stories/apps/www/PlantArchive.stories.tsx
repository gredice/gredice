import { PlantsCalendar } from '@apps/www/app/biljke/PlantsCalendar';
import { PlantsGalleryItem } from '@apps/www/app/biljke/PlantsGalleryItem';
import { PlantsMonthChart } from '@apps/www/app/biljke/PlantsMonthChart';
import { PlantsSeasonPanel } from '@apps/www/app/biljke/PlantsSeasonPanel';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
    plantArchiveStoryFilters,
    plantArchiveStoryPlants,
} from './plantArchiveStoryData';

const meta = {
    title: 'apps/www/Plants/Archive',
    component: PlantsSeasonPanel,
    tags: ['autodocs'],
    args: {
        filters: plantArchiveStoryFilters(11),
        plants: plantArchiveStoryPlants,
    },
    parameters: {
        docs: {
            description: {
                component:
                    'The /biljke archive leads with the season: a month chart that filters by sowing or harvest month, and a panel for the current month that ranks plants whose sowing window closes first. Cards show a sowing/harvest strip, fixed facts and a price row whose Posadi button opens the Garden with the plant ready to sow (Nedostupno, disabled, when the store has none); the calendar shows one row per plant.',
            },
        },
        layout: 'fullscreen',
    },
    render: (args) => (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6 lg:flex-row">
            <PlantsMonthChart
                className="lg:flex-[2]"
                filters={args.filters}
                plants={args.plants}
            />
            <PlantsSeasonPanel className="lg:flex-1" {...args} />
        </div>
    ),
} satisfies Meta<typeof PlantsSeasonPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SeasonHeaderNovember: Story = {};

export const SeasonHeaderMay: Story = {
    args: { filters: plantArchiveStoryFilters(5) },
};

export const NoSowingThisMonth: Story = {
    args: { filters: plantArchiveStoryFilters(1) },
};

export const Cards: Story = {
    parameters: {
        docs: {
            description: {
                story: 'Hren is not available in the store, so its card shows a disabled Nedostupno button in place of Posadi.',
            },
        },
    },
    render: () => (
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 p-6 md:grid-cols-3">
            {plantArchiveStoryPlants.slice(0, 3).map((plant) => (
                <PlantsGalleryItem
                    key={plant.id}
                    {...plant}
                    id={plant.id.toString()}
                    currentMonth={11}
                />
            ))}
        </div>
    ),
};

export const Calendar: Story = {
    render: (args) => (
        <div className="mx-auto max-w-6xl p-6">
            <div className="rounded-lg border bg-card">
                <PlantsCalendar filters={args.filters} plants={args.plants} />
            </div>
        </div>
    ),
};
