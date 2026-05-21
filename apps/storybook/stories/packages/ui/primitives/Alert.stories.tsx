import { Alert } from '@gredice/ui/Alert';
import { Check, Info, Warning } from '@gredice/ui/icons';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Feedback/Alert',
    component: Alert,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Alert provides a compact status surface for forms, account flows, and operational warnings.',
            },
        },
    },
    args: {
        color: 'info',
        startDecorator: <Info className="size-4" />,
        children: 'Dostava za odabranu adresu dostupna je u vecernjem terminu.',
    },
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WarningState: Story = {
    args: {
        color: 'warning',
        startDecorator: <Warning className="size-4" />,
        children: 'Radnja se ne moze ponistiti nakon potvrde.',
    },
};

export const SuccessState: Story = {
    args: {
        color: 'success',
        startDecorator: <Check className="size-4" />,
        children: 'Promjene su uspjesno spremljene.',
    },
};

export const RichContent: Story = {
    render: (args) => (
        <Alert
            {...args}
            color="danger"
            startDecorator={<Warning className="size-4" />}
        >
            <Stack spacing={1}>
                <Typography level="body2" semiBold>
                    Nije moguce dovrsiti zahtjev
                </Typography>
                <Typography level="body2">
                    Provjeri unesene podatke i pokusaj ponovno.
                </Typography>
            </Stack>
        </Alert>
    ),
};
