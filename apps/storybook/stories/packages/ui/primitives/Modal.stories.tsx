import { Button } from '@gredice/ui/Button';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Overlays/Modal',
    component: Modal,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Modal provides a Radix Dialog-backed surface with the Signalco-compatible trigger, title, and dismissible props.',
            },
        },
    },
    args: {
        title: 'Potvrdi radnju',
    },
    render: (args) => (
        <Modal {...args} trigger={<Button>Otvori modal</Button>}>
            <Stack spacing={2}>
                <Stack spacing={0.5}>
                    <Typography level="h5">Potvrdi radnju</Typography>
                    <Typography level="body2" secondary>
                        Koristi se za kratke tokove koji traze jasnu potvrdu.
                    </Typography>
                </Stack>
                <div className="flex justify-end gap-2">
                    <Button variant="outlined">Odustani</Button>
                    <Button>Potvrdi</Button>
                </div>
            </Stack>
        </Modal>
    ),
} satisfies Meta<typeof Modal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutClose: Story = {
    args: {
        hideClose: true,
    },
};

export const NotDismissible: Story = {
    args: {
        dismissible: false,
    },
};
