import { Button } from '@gredice/ui/Button';
import { Popper } from '@gredice/ui/Popper';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Suspense, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

const meta = {
    title: 'packages/ui/Overlays/Popper',
    component: Popper,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Popper provides a library-neutral API for badges and contextual micro-surfaces rendered through the shared portal contract.',
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

function ControlledPopper() {
    const [open, setOpen] = useState(false);

    return (
        <Popper
            onOpenChange={setOpen}
            open={open}
            trigger={
                <Button variant="outlined">
                    {open ? 'Sakrij detalje' : 'Prikazi detalje'}
                </Button>
            }
        >
            <Stack className="p-3" spacing={2}>
                <Typography level="body2" semiBold>
                    Kontrolirani prikaz
                </Typography>
                <Button onClick={() => setOpen(false)} variant="plain">
                    Zatvori
                </Button>
            </Stack>
        </Popper>
    );
}

export const Controlled: Story = {
    render: () => <ControlledPopper />,
};

export const CollisionEdge: Story = {
    args: {
        align: 'end',
        defaultOpen: true,
        side: 'top',
    },
    decorators: [
        (Story) => (
            <div className="flex h-64 items-start justify-end pt-2">
                <Story />
            </div>
        ),
    ],
};

// Stands in for a trigger passed from a Server Component, which can reach
// the client as a lazy node while its client modules are still loading.
const deferredTrigger = Promise.resolve(
    <Button variant="outlined">Prikazi detalje</Button>,
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
            <Popper {...args} trigger={deferredTrigger}>
                <Stack className="p-3" spacing={2}>
                    <Typography level="body2" semiBold>
                        Odgođeni okidač
                    </Typography>
                </Stack>
            </Popper>
        </Suspense>
    ),
    play: async ({ canvasElement }) => {
        const canvas = within(canvasElement);
        const trigger = await canvas.findByRole('button', {
            name: 'Prikazi detalje',
        });
        await expect(canvasElement.querySelector('button button')).toBeNull();
        await userEvent.click(trigger);
        await waitFor(async () => {
            await expect(
                within(document.body).getByText('Odgođeni okidač'),
            ).toBeVisible();
        });
    },
};
