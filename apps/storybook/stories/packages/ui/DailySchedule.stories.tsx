import { DailySchedule } from '@gredice/ui/DailySchedule';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Data Display/DailySchedule',
    component: DailySchedule,
    tags: ['autodocs'],
    args: {
        days: 5,
        startDate: new Date('2025-06-09'),
        renderDay: ({ date, isToday, index }) => (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <div className="w-10 shrink-0 text-center">
                    <Typography level="body3" className="text-muted-foreground">
                        {date.toLocaleDateString('hr-HR', { weekday: 'short' })}
                    </Typography>
                    <Typography
                        level="h5"
                        className={isToday ? 'text-primary font-bold' : ''}
                    >
                        {date.getDate()}
                    </Typography>
                </div>
                <Typography level="body2">
                    Zadatak {index + 1}: Zalijevanje
                </Typography>
            </div>
        ),
    },
    render: (args) => (
        <div className="w-96">
            <DailySchedule {...args} />
        </div>
    ),
} satisfies Meta<typeof DailySchedule>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Week: Story = {
    args: {
        days: 7,
    },
};
