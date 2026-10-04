import { Container } from '@gredice/ui/Container';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

const meta = {
    title: 'packages/ui/Foundation/Container',
    component: Container,
    tags: ['autodocs'],
    parameters: {
        docs: {
            description: {
                component:
                    'Container constrains page and section width while preserving the shared horizontal padding behavior.',
            },
        },
    },
    args: {
        maxWidth: 'md',
    },
    render: (args) => (
        <Container {...args}>
            <div className="rounded-md border bg-card p-4">
                <Typography level="body2">
                    Constrained content inside a shared container.
                </Typography>
            </div>
        </Container>
    ),
} satisfies Meta<typeof Container>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MaxWidths: Story = {
    render: () => (
        <Stack className="w-[52rem]" spacing={3}>
            <Container maxWidth="xs">
                <div className="rounded-md border bg-card p-3 text-sm">xs</div>
            </Container>
            <Container maxWidth="sm">
                <div className="rounded-md border bg-card p-3 text-sm">sm</div>
            </Container>
            <Container maxWidth="md">
                <div className="rounded-md border bg-card p-3 text-sm">md</div>
            </Container>
            <Container maxWidth="lg">
                <div className="rounded-md border bg-card p-3 text-sm">lg</div>
            </Container>
            <Container maxWidth={false}>
                <div className="rounded-md border bg-card p-3 text-sm">
                    full width
                </div>
            </Container>
        </Stack>
    ),
};

export const WithoutPadding: Story = {
    args: {
        padded: false,
    },
};

export const NotCentered: Story = {
    args: {
        centered: false,
    },
};
