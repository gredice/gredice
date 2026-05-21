import { Button } from '@gredice/ui/Button';
import { Popper } from '@gredice/ui/Popper';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Overlays/Popper',
    component: Popper,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Popper provides a lightweight Radix Popover-compatible API for badges and contextual micro-surfaces.',
            },
        },
    },
    render: (args) => (
        <Popper
            {...args}
            trigger={<Button variant="outlined">Prikazi detalje</Button>}
        >
            <Stack className="p-3" spacing={2}>
                <Typography level="body2" semiBold>
                    Preporuceno vrijeme
                </Typography>
                <Typography level="body3" secondary>
                    Ovaj prikaz se otvara uz kontrolu koja ga pokrece.
                </Typography>
            </Stack>
        </Popper>
    ),
} satisfies Meta<typeof Popper>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RightAligned: Story = {
    args: {
        align: 'start',
        side: 'right',
        sideOffset: 8,
    },
};
