import { Accordion } from '@gredice/ui/Accordion';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Data Display/Accordion',
    component: Accordion,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Accordion provides a first-party collapsible card with Signalco-compatible open, defaultOpen, variant, and unmountOnExit props.',
            },
        },
    },
    args: {
        defaultOpen: true,
    },
    render: (args) => (
        <div className="w-[420px]">
            <Accordion {...args}>
                <Typography semiBold>Kako funkcionira sadnja?</Typography>
                <Stack spacing={2}>
                    <Typography level="body2">
                        Korisnik odabere biljku, a operativni tim dobiva jasan
                        zadatak za izvedbu u vrtu.
                    </Typography>
                    <Typography level="body3" secondary>
                        Sadrzaj ostaje montiran osim kada se ukljuci
                        unmountOnExit.
                    </Typography>
                </Stack>
            </Accordion>
        </div>
    ),
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Plain: Story = {
    args: {
        variant: 'plain',
    },
};

export const UnmountedWhenClosed: Story = {
    args: {
        defaultOpen: false,
        unmountOnExit: true,
    },
};
