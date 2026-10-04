import {
    GrowthCalendarPreview,
    SowingCalendarPreview,
} from '@apps/www/app/sjetva/SowingCalendarPreview';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'apps/www/Plants/CalendarPreviews',
    component: SowingCalendarPreview,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Calendar previews explain the public plant sowing and growth calendar examples shown on the sowing page.',
            },
        },
        layout: 'fullscreen',
    },
    render: () => (
        <div className="mx-auto max-w-3xl p-6">
            <SowingCalendarPreview />
        </div>
    ),
} satisfies Meta<typeof SowingCalendarPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Sowing: Story = {};

export const Growth: Story = {
    render: () => (
        <div className="mx-auto max-w-3xl p-6">
            <GrowthCalendarPreview />
        </div>
    ),
};

export const Both: Story = {
    render: () => (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <SowingCalendarPreview />
            <GrowthCalendarPreview />
        </div>
    ),
};
