import { Progress } from '@gredice/ui/Progress';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Progress',
    component: Progress,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Progress shows bounded completion values for capacity, sync, and operation status bars.',
            },
        },
    },
    args: {
        'aria-label': 'Napredak sinkronizacije',
        value: 68,
    },
    render: (args) => (
        <div className="w-80">
            <Progress {...args} />
        </div>
    ),
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Values: Story = {
    render: () => (
        <Stack className="w-80" spacing={4}>
            <Progress aria-label="Cetvrtina" value={25} />
            <Progress aria-label="Polovica" value={50} />
            <Progress aria-label="Skoro dovrseno" value={88} />
        </Stack>
    ),
};

export const BoundedValues: Story = {
    render: () => (
        <Stack className="w-80" spacing={4}>
            <Stack spacing={2}>
                <Typography level="body3" secondary>
                    Negative values clamp to empty.
                </Typography>
                <Progress aria-label="Negativna vrijednost" value={-20} />
            </Stack>
            <Stack spacing={2}>
                <Typography level="body3" secondary>
                    Values above 100 clamp to full.
                </Typography>
                <Progress aria-label="Prevelika vrijednost" value={140} />
            </Stack>
        </Stack>
    ),
};

export const CustomTrack: Story = {
    render: () => (
        <div className="w-80">
            <Progress
                aria-label="Status berbe"
                trackClassName="bg-green-600"
                value={72}
            />
        </div>
    ),
};
