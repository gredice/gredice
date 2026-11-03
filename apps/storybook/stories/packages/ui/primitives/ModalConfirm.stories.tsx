import { Button } from '@gredice/ui/Button';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Suspense } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

const meta = {
    title: 'packages/ui/Overlays/ModalConfirm',
    component: ModalConfirm,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'ModalConfirm composes Base UI Alert Dialog with Gredice confirmation, cancellation, and expected-text validation behavior.',
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

export const CustomActions: Story = {
    args: {
        cancelLabel: 'Zadrži zapis',
        confirmLabel: 'Trajno obriši',
    },
};

export const RichContent: Story = {
    args: {
        description:
            'Brisanjem se uklanjaju povezani podaci iz aktivnog prikaza.',
        children: (
            <Typography level="body2">
                Brisanjem se uklanjaju povezani podaci iz aktivnog prikaza.
            </Typography>
        ),
    },
};

// Stands in for a trigger passed from a Server Component, which can reach
// the client as a lazy node while its client modules are still loading.
const deferredTrigger = Promise.resolve(
    <Button color="danger" variant="outlined">
        Obrisi
    </Button>,
);

export const DeferredTrigger: Story = {
    parameters: {
        docs: {
            description: {
                story: 'A trigger that resolves after the first render, like an element passed from a Server Component, still renders as a single Base UI trigger button instead of being wrapped in another `<button>`.',
            },
        },
    },
    render: (args) => (
        <Suspense>
            <ModalConfirm {...args} trigger={deferredTrigger} />
        </Suspense>
    ),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const trigger = await canvas.findByRole('button', { name: 'Obrisi' });
        await expect(canvasElement.querySelector('button button')).toBeNull();
        await userEvent.click(trigger);
        await waitFor(async () => {
            await expect(
                within(document.body).getByRole('alertdialog'),
            ).toBeVisible();
        });
    },
};
