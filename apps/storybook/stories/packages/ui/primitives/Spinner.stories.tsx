import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Spinner',
    component: Spinner,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Spinner is the shared inline loading indicator used in buttons, rows, and compact async states.',
            },
        },
    },
    args: {
        loadingLabel: 'Ucitavanje',
    },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
    render: () => (
        <Row spacing={4}>
            <Spinner className="size-3" loadingLabel="Malo ucitavanje" />
            <Spinner className="size-4" loadingLabel="Srednje ucitavanje" />
            <Spinner className="size-5" loadingLabel="Veliko ucitavanje" />
        </Row>
    ),
};

export const InlineState: Story = {
    render: () => (
        <Row spacing={3}>
            <Spinner loadingLabel="Sinkronizacija" />
            <Typography level="body2">Sinkronizacija u tijeku</Typography>
        </Row>
    ),
};

export const NotLoading: Story = {
    render: () => (
        <Stack spacing={2}>
            <Spinner loading={false} loadingLabel="Skriveno ucitavanje" />
            <Typography level="body2" secondary>
                The component renders nothing when loading is false.
            </Typography>
        </Stack>
    ),
};
