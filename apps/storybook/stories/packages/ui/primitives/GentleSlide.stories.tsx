import { GentleSlide } from '@gredice/ui/GentleSlide';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Motion/GentleSlide',
    component: GentleSlide,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'GentleSlide provides the small Signalco-compatible opacity and translate transition used for inline status feedback.',
            },
        },
    },
    args: {
        appear: true,
        direction: 'down',
        duration: 250,
    },
    render: (args) => (
        <div className="w-80">
            <GentleSlide {...args}>
                <Stack className="rounded-lg border bg-card p-3" spacing={2}>
                    <Typography semiBold>Uspjesno spremljeno</Typography>
                    <Typography level="body3" secondary>
                        Poruka koristi samo opacity i transform stilove.
                    </Typography>
                </Stack>
            </GentleSlide>
        </div>
    ),
} satisfies Meta<typeof GentleSlide>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Hidden: Story = {
    args: {
        appear: false,
        collapsedWhenHidden: true,
    },
};
