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
            <Stack spacing={4}>
                <Stack spacing={1}>
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

export const LongContent: Story = {
    args: {
        title: 'Dugacki modal',
        className: 'max-w-5xl',
    },
    render: (args) => (
        <Modal {...args} trigger={<Button>Otvori dugacki modal</Button>}>
            <Stack spacing={5}>
                <Stack spacing={1}>
                    <Typography level="h5">Dugacki modal</Typography>
                    <Typography level="body2" secondary>
                        Modal ostaje unutar vidljivog dijela ekrana, a sadrzaj
                        se skrola unutar modala.
                    </Typography>
                </Stack>
                <div className="rounded-lg border bg-muted/20 p-6">
                    <div className="h-[44rem] rounded-md border border-dashed bg-background p-4">
                        <Typography level="body2" semiBold>
                            Visoki sadrzaj
                        </Typography>
                        <Typography level="body3" secondary>
                            Ovaj blok simulira preview, tablicu ili formu koja
                            je visa od desktop viewporta.
                        </Typography>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outlined">Odustani</Button>
                    <Button>Spremi</Button>
                </div>
            </Stack>
        </Modal>
    ),
};
