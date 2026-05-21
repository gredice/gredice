import { Button } from '@gredice/ui/Button';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Overlays/ModalConfirm',
    component: ModalConfirm,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'ModalConfirm provides a first-party confirmation dialog for destructive or irreversible actions.',
            },
        },
    },
    args: {
        title: 'Potvrda brisanja',
        header: 'Obrisati zapis?',
        children: 'Ova radnja se ne moze ponistiti.',
    },
    render: (args) => (
        <ModalConfirm
            {...args}
            trigger={
                <Button color="danger" variant="outlined">
                    Obrisi
                </Button>
            }
        />
    ),
} satisfies Meta<typeof ModalConfirm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPrompt: Story = {
    args: {
        expectedConfirm: 'Da',
        header: 'Potvrda brisanja racuna',
        promptLabel: 'Upisi "Da" za potvrdu',
    },
};

export const RichContent: Story = {
    args: {
        children: (
            <Typography level="body2">
                Brisanjem se uklanjaju povezani podaci iz aktivnog prikaza.
            </Typography>
        ),
    },
};
